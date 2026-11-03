import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backupService } from '../backupService';
import { BACKUP_TABLES, readBackupTable } from '../backupPagination';
import { BACKUP_ARRAYS, backupChecksum, canonicalBackupJSON, validateBackupIntegrity } from '../backupIntegrity';
import { supabase } from '../../../lib/supabase';

const mock = vi.hoisted(() => ({
  user: 'user-a' as string | null,
  rows: {} as Record<string, any[]>, cap: 500, busy: 0, maxBusy: 0,
  errorAt: {} as Record<string, number>, countFailure: false, ignoreOwnershipFilter: false,
  queries: [] as { table: string; user?: string; order: string[]; from?: number; to?: number }[],
}));
vi.mock('../../../lib/supabase', () => ({ supabase: {
  auth: { getUser: vi.fn(async () => ({ data: { user: mock.user ? { id: mock.user } : null }, error: null })) },
  from: (table: string) => {
    const call: typeof mock.queries[number] = { table, order: [] }; mock.queries.push(call);
    let head = false;
    const query = {
      select: (_: string, options?: any) => { head = !!options?.head; return query; },
      eq: (_: string, user: string) => { call.user = user; return query; },
      order: (field: string) => { call.order.push(field); return query; },
      range: async (from: number, to: number) => {
        call.from = from; call.to = to;
        mock.maxBusy = Math.max(mock.maxBusy, ++mock.busy);
        try {
          await Promise.resolve();
          if (mock.errorAt[table] === from) return { data: null, error: { message: 'simulated remote failure' } };
          const rows = [...(mock.rows[table] || [])].filter(row => mock.ignoreOwnershipFilter || row.user_id === call.user);
          rows.sort((a, b) => {
            for (const key of call.order) {
              if (a[key] === b[key]) continue;
              return a[key] < b[key] ? -1 : 1;
            }
            return 0;
          });
          return { data: rows.slice(from, Math.min(to + 1, from + mock.cap)), error: null };
        } finally { mock.busy--; }
      },
      then: (resolve: any, reject: any) => Promise.resolve({
        data: [], count: head ? (mock.rows[table] || []).filter(row => row.user_id === call.user).length : null,
        error: mock.countFailure ? { message: 'count unavailable' } : null,
      }).then(resolve, reject),
    };
    return query;
  },
} }));

const row = (id: string, extra = {}) => ({ id, user_id: 'user-a', ...extra });
const point = (sequence: number, trip = 'trip-a') => row(`${trip}-point-${String(sequence).padStart(6, '0')}`, { trip_id: trip, sequence_number: sequence, latitude: -20, longitude: -40 });

describe('complete, scoped and verifiable JSON backup', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T15:00:00Z'));
    mock.user = 'user-a'; mock.rows = {}; mock.cap = 500; mock.busy = 0; mock.maxBusy = 0;
    mock.errorAt = {}; mock.countFailure = false; mock.ignoreOwnershipFilter = false; mock.queries.length = 0;
    mock.rows.profiles = [row('profile-a', { full_name: 'Personal name intentionally not exported', distance_unit: 'MI' })];
    mock.rows.vehicles = [row('vehicle-a', { name: 'Titan', odometer_km: 1000 })];
    mock.rows.trips = [row('trip-a', { vehicle_id: 'vehicle-a', started_at: '2026-11-01T12:00:00Z' })];
    mock.rows.trip_points = [];
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('A: exports a partial page and then confirms EOF', async () => {
    mock.rows.trip_points = Array.from({ length: 12 }, (_, i) => point(i));
    const backup = await backupService.exportBackupJSON('user-a');
    expect(backup.tripPoints).toHaveLength(12);
    expect(mock.queries.filter(q => q.table === 'trip_points').map(q => q.from)).toEqual([0, 12]);
  });
  it('B: reads the next page after exactly 500 rows', async () => {
    mock.rows.trip_points = Array.from({ length: 500 }, (_, i) => point(i));
    expect((await backupService.exportBackupJSON('user-a')).tripPoints).toHaveLength(500);
    expect(mock.queries.filter(q => q.table === 'trip_points').map(q => q.from)).toEqual([0, 500]);
  });
  it.each(BACKUP_TABLES.filter(t => t !== 'profiles' && t !== 'trip_points'))('C: pages the whole %s table with stable ordering', async table => {
    mock.rows[table] = Array.from({ length: 1001 }, (_, i) => row(`${table}-${String(i).padStart(5, '0')}`, { vehicle_id: 'vehicle-a' })).reverse();
    const data = await readBackupTable(table, 'user-a');
    expect(data).toHaveLength(1001);
    expect(data[0].id).toBe(`${table}-00000`); expect(data.at(-1).id).toBe(`${table}-01000`);
    expect(mock.queries.every(q => q.order.join(',') === 'id')).toBe(true);
  });
  it('C: continues when a server caps a requested page to fewer than 500 records', async () => {
    mock.cap = 100; mock.rows.trip_points = Array.from({ length: 1083 }, (_, i) => point(i));
    const backup = await backupService.exportBackupJSON('user-a');
    expect(backup.tripPoints).toHaveLength(1083);
    expect(new Set(backup.tripPoints.map(p => p.id)).size).toBe(1083);
    expect(mock.queries.filter(q => q.table === 'trip_points').at(-1)?.from).toBe(1083);
  });
  it.each(BACKUP_TABLES)('D: any failure in %s prevents a successful backup', async table => {
    mock.errorAt[table] = 0;
    await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('Nenhum backup foi concluído');
  });
  it('D: a middle-page error rejects the entire export, not merely that page', async () => {
    mock.rows.trip_points = Array.from({ length: 1001 }, (_, i) => point(i)); mock.errorAt.trip_points = 500;
    await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('registro 500');
    expect(mock.queries.some(q => q.table === 'fuel_entries')).toBe(false);
  });
  it('E: 25,000 points across trips keep deterministic trip/sequence order and unique IDs', async () => {
    mock.rows.trips!.push(row('trip-b', { vehicle_id: 'vehicle-a' }));
    mock.rows.trip_points = Array.from({ length: 25000 }, (_, i) => point(i % 12500, i < 12500 ? 'trip-b' : 'trip-a')).reverse();
    const backup = await backupService.exportBackupJSON('user-a');
    expect(backup.tripPoints).toHaveLength(25000);
    expect(new Set(backup.tripPoints.map(p => p.id)).size).toBe(25000);
    expect(backup.tripPoints[0]).toMatchObject({ trip_id: 'trip-a', sequence_number: 0 });
    expect(backup.tripPoints[12499].sequence_number).toBe(12499);
    expect(backup.tripPoints[12500]).toMatchObject({ trip_id: 'trip-b', sequence_number: 0 });
    expect(mock.maxBusy).toBe(1);
    expect(mock.queries.filter(q => q.table === 'trip_points').every(q => q.order.join(',') === 'trip_id,sequence_number,id')).toBe(true);
  });
  it('F: counts match all eight arrays; profiles counts only the existing preference source', async () => {
    mock.rows.trip_points = [point(0)];
    mock.rows.fuel_entries = [row('fuel-a', { vehicle_id: 'vehicle-a', total_amount: 50 })];
    const backup = await backupService.exportBackupJSON('user-a');
    for (const [table, key] of Object.entries(BACKUP_ARRAYS)) expect(backup.metadata?.counts[table as keyof typeof BACKUP_ARRAYS]).toBe(backup[key].length);
    expect(backup.metadata?.counts.profiles).toBe(1);
    expect(backup.user.preferences.distance_unit).toBe('MI');
    expect(JSON.stringify(backup)).not.toContain('Personal name intentionally not exported');
    expect(backup.metadata).toMatchObject({ app: 'ph-drive', format_version: 1, user_id: 'user-a', consistency: 'non_transactional' });
    expect(Date.parse(backup.metadata!.backup_started_at)).toBeLessThanOrEqual(Date.parse(backup.metadata!.backup_completed_at));
    expect(backup.metadata?.exported_at).toBe(backup.exportedAt);
    expect(backup.metadata?.checksum?.value).toBe(await backupChecksum(backup));
  });
  it('G: every read has explicit user_id filtering; another user never appears', async () => {
    for (const table of BACKUP_TABLES) (mock.rows[table] ||= []).push({ id: 'foreign', user_id: 'user-b', private_data: 'not-for-export' });
    const backup = await backupService.exportBackupJSON('user-a');
    expect(mock.queries.every(q => q.user === 'user-a')).toBe(true);
    expect(JSON.stringify(backup)).not.toContain('not-for-export');
  });
  it.each([null, 'user-b'])('G: unauthenticated or mismatched session %s rejects before table reads', async user => {
    mock.user = user;
    await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('Sessão inválida');
    expect(mock.queries).toHaveLength(0);
  });
  it('G: fails closed if a response includes foreign data despite the explicit filter', async () => {
    mock.ignoreOwnershipFilter = true;
    mock.rows.vehicles.push(row('foreign', { user_id: 'user-b' }));
    await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('ownership divergente');
  });
  it('G: a changed authentication session during the read prevents finalization', async () => {
    const getUser = vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({ data: { user: { id: 'user-a' } }, error: null } as any)
      .mockResolvedValueOnce({ data: { user: { id: 'user-b' } }, error: null } as any);
    try { await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('Sessão inválida'); }
    finally { getUser.mockRestore(); }
  });
  it('H/I: old files without metadata and new files with metadata both pass the existing restore preview', async () => {
    const current = await backupService.exportBackupJSON('user-a');
    const old = { ...current }; delete old.metadata;
    expect((await backupService.previewBackup(old, 'user-a')).valid).toBe(true);
    expect((await backupService.previewBackup(current, 'user-a')).valid).toBe(true);
    expect((await backupService.previewBackup(current, 'user-b')).valid).toBe(true);
    const optional = { ...old, metadata: { format_version: 1, app: 'ph-drive' } } as any;
    await expect(validateBackupIntegrity(optional)).resolves.toBeUndefined();
  });
  it('I: metadata hash/count corruption prevents preview and import before any database access', async () => {
    const backup = await backupService.exportBackupJSON('user-a'); mock.queries.length = 0;
    backup.metadata!.counts.trips++;
    expect((await backupService.previewBackup(backup, 'user-a')).valid).toBe(false);
    await expect(backupService.executeImport(backup, 'user-a', {} as any)).rejects.toThrow('Contagem divergente');
    expect(mock.queries).toHaveLength(0);
  });
  it('I: a modified field with unchanged counts is rejected by SHA-256', async () => {
    const backup = await backupService.exportBackupJSON('user-a');
    backup.vehicles[0].name = 'Changed after export';
    await expect(validateBackupIntegrity(backup)).rejects.toThrow('Checksum SHA-256 divergente');
  });
  it('J: all-empty tables are a valid backup with zero counts and existing default preferences', async () => {
    mock.rows = {};
    const backup = await backupService.exportBackupJSON('user-a');
    expect(Object.values(backup.metadata!.counts).every(count => count === 0)).toBe(true);
    await expect(validateBackupIntegrity(backup)).resolves.toBeUndefined();
  });
  it('K: stable row ordering and canonical JSON produce repeatable hashes at the same clock', async () => {
    mock.rows.trip_points = [point(1), point(0)];
    const one = await backupService.exportBackupJSON('user-a');
    mock.rows.trip_points.reverse();
    const two = await backupService.exportBackupJSON('user-a');
    expect(one.metadata!.checksum!.value).toBe(two.metadata!.checksum!.value);
    expect(canonicalBackupJSON({ b: 1, a: { y: 2, x: 3 } })).toBe(canonicalBackupJSON({ a: { x: 3, y: 2 }, b: 1 }));
  });
  it('K: Web Crypto checksum matches an independent standard SHA-256 implementation', async () => {
    expect(await backupChecksum({} as any)).toBe(createHash('sha256').update('{}').digest('hex'));
  });
  it('L: strips secrets recursively and never reads browser config/session storage', async () => {
    Object.assign(mock.rows.vehicles[0], {
      access_token: 'fixture-access', refreshToken: 'fixture-refresh', password_hash: 'fixture-hash',
      config: { url: 'fixture-private-url' }, supabase_anon_key: 'fixture-anon', service_role_key: 'fixture-role',
      nested: { authorization: 'fixture-auth', innocent: { privateKey: 'fixture-private-key', color: 'blue' } },
    });
    const storage = vi.spyOn(Storage.prototype, 'getItem');
    const backup = await backupService.exportBackupJSON('user-a');
    expect(JSON.stringify(backup)).not.toContain('fixture-');
    expect(backup.vehicles[0].nested.innocent.color).toBe('blue');
    expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
  });
  it('rejects duplicate IDs rather than exporting duplicates or looping forever', async () => {
    mock.rows.trip_points = [point(0), point(0)];
    await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('Registro duplicado');
  });
  it('rejects orphaned vehicle/trip references instead of silently dropping records', async () => {
    mock.rows.trip_points = [point(0, 'not-exported-trip')];
    await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('Referência de viagem ausente');
  });
  it('does not silently omit the checksum when Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    await expect(backupService.exportBackupJSON('user-a')).rejects.toThrow('SHA-256 indisponível');
  });
  it('propagates count-query errors instead of presenting zero as a successful count', async () => {
    mock.countFailure = true;
    await expect(backupService.getBackupSummary('user-a')).rejects.toThrow('confirmar as contagens');
  });
});
