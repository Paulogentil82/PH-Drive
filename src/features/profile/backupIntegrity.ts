import type { BackupPayload } from './backupService';

export const BACKUP_ARRAYS = {
  vehicles: 'vehicles', trips: 'trips', trip_points: 'tripPoints', fuel_entries: 'fuelEntries',
  maintenance_entries: 'maintenanceEntries', vehicle_expenses: 'vehicleExpenses',
  vehicle_documents: 'vehicleDocuments', vehicle_tires: 'vehicleTires',
} as const;
export type BackupCounts = Record<keyof typeof BACKUP_ARRAYS | 'profiles', number>;
export interface BackupMetadata {
  format_version: 1;
  app: 'ph-drive';
  user_id: string;
  backup_started_at: string;
  backup_completed_at: string;
  exported_at: string;
  consistency: 'non_transactional';
  /** profiles counts only the existing preferences source, not a new personal-profile export. */
  counts: BackupCounts;
  checksum?: { algorithm: 'SHA-256'; scope: 'payload-without-checksum'; value: string };
}

/** Drop credential/session/config containers recursively. Preserve ordinary user records. */
export function sanitizeBackup(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeBackup);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => {
      const name = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return !/(token|password|passwd|secret|credential|privatekey|servicekey|servicerole|anonkey|publishablekey|apikey|supabase|session|authorization|config|cookie|connectionstring|databaseurl)/.test(name)
        && !['key', 'anon', 'settings'].includes(name);
    }).map(([key, entry]) => [key, sanitizeBackup(entry)]));
  }
  return value;
}

/** Canonical JSON encoding only; cryptography is exclusively Web Crypto SHA-256. */
export function canonicalBackupJSON(value: any): string {
  const normalize = (entry: any): any => Array.isArray(entry) ? entry.map(normalize)
    : entry && typeof entry === 'object' ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, normalize(entry[key])])) : entry;
  return JSON.stringify(normalize(value));
}

export async function backupChecksum(payload: BackupPayload): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 indisponível. Abra o PH Drive por HTTPS ou localhost para preparar um backup verificável.');
  const metadata = payload.metadata ? { ...payload.metadata } : undefined;
  if (metadata) delete metadata.checksum;
  const bytes = new TextEncoder().encode(canonicalBackupJSON({ ...payload, metadata }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function backupCounts(payload: BackupPayload, profiles: number): BackupCounts {
  const counts = { profiles } as BackupCounts;
  for (const [table, key] of Object.entries(BACKUP_ARRAYS)) {
    if (!Array.isArray(payload[key])) throw new Error(`Array ${key} ausente no backup.`);
    counts[table as keyof BackupCounts] = payload[key].length;
  }
  return counts;
}

/** Optional for old files, checked before any restore query/write when supplied. */
export async function validateBackupIntegrity(payload: BackupPayload): Promise<void> {
  if (payload.metadata === undefined) return;
  const meta = payload.metadata;
  if (!meta || typeof meta !== 'object' || meta.format_version !== 1 || meta.app !== 'ph-drive') {
    throw new Error('Metadados de backup incompatíveis.');
  }
  if (meta.counts !== undefined) {
    if (!meta.counts || !Number.isInteger(meta.counts.profiles) || meta.counts.profiles < 0 || meta.counts.profiles > 1) {
      throw new Error('Contagem de profiles inválida no backup.');
    }
    const actual = backupCounts(payload, meta.counts.profiles);
    for (const table of Object.keys(actual) as (keyof BackupCounts)[]) {
      if (actual[table] !== meta.counts[table]) throw new Error(`Contagem divergente em ${table}; arquivo de backup incompleto ou alterado.`);
    }
  }
  if (meta.checksum !== undefined) {
    if (!meta.checksum || meta.checksum.algorithm !== 'SHA-256' || meta.checksum.scope !== 'payload-without-checksum'
      || !/^[a-f0-9]{64}$/i.test(meta.checksum.value) || await backupChecksum(payload) !== meta.checksum.value.toLowerCase()) {
      throw new Error('Checksum SHA-256 divergente; arquivo de backup alterado ou corrompido.');
    }
  }
}
