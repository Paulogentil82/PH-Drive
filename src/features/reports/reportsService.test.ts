import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportsService } from './reportsService';
import { calculateReportMetrics } from './reportMetrics';
import { fuelEntriesService } from '../fuel/fuelEntriesService';
import { maintenanceEntriesService } from '../maintenance/maintenanceEntriesService';
import { vehicleExpensesService } from '../expenses/vehicleExpensesService';

const mock = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>, errors: {} as Record<string, any>,
  calls: [] as { table: string; eq: [string, unknown][]; gte: [string, string][]; lt: [string, string][]; or?: string; order: string[]; range?: number[] }[],
}));
vi.mock('../../lib/supabase', () => ({ supabase: { from: (table: string) => {
  const call: typeof mock.calls[number] = { table, eq: [], gte: [], lt: [], order: [] };
  mock.calls.push(call);
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { call.eq.push([key, value]); return query; },
    gte: (key: string, value: string) => { call.gte.push([key, value]); return query; },
    lt: (key: string, value: string) => { call.lt.push([key, value]); return query; },
    or: (value: string) => { call.or = value; return query; },
    order: (key: string) => { call.order.push(key); return query; },
    range: (from: number, to: number) => {
      call.range = [from, to];
      const rows = (mock.rows[table] || []).filter(row => {
        if (!call.eq.every(([key, value]) => row[key] === value)) return false;
        if (!call.gte.every(([key, value]) => row[key] >= value)) return false;
        if (!call.lt.every(([key, value]) => row[key] < value)) return false;
        if (call.or) {
          const bounds = /ended_at\.gte\.([^,]+),ended_at\.lt\.([^)]+)/.exec(call.or)!;
          const date = new Date(row.ended_at ?? row.started_at).getTime();
          if (!(date >= Date.parse(bounds[1]) && date < Date.parse(bounds[2]))) return false;
        }
        return true;
      });
      return Promise.resolve({ data: rows.slice(from, to + 1), error: mock.errors[table] || null });
    },
  };
  return query;
} } }));

const trip = (id: string, date: string, extra = {}) => ({
  id, vehicle_id: 'titan', status: 'COMPLETED', started_at: date, ended_at: date,
  gps_distance_km: 10, distance_km: 100, ...extra,
});

describe('reports: real read services with mocked transport', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 15, 12));
    mock.calls.length = 0; mock.rows = {}; mock.errors = {};
    for (const [table, field, amountField, value] of [
      ['fuel_entries', 'filled_at', 'total_amount', 10],
      ['maintenance_entries', 'performed_at', 'cost_amount', 20],
      ['vehicle_expenses', 'expense_date', 'amount', 30],
    ] as const) {
      mock.rows[table] = [
        { id: 'current', vehicle_id: 'titan', [field]: '2026-11-01T00:00:00Z', [amountField]: value },
        { id: 'old', vehicle_id: 'titan', [field]: '2026-10-16', [amountField]: 1000 },
        { id: 'future', vehicle_id: 'titan', [field]: '2026-11-16', [amountField]: 2000 },
        { id: 'other', vehicle_id: 'verona', [field]: '2026-11-01', [amountField]: 9000 },
      ];
    }
    mock.rows.trips = [
      trip('gps', '2026-11-01T12:00:00Z', { gps_distance_km: 12.5 }),
      trip('odo', '2026-11-02T12:00:00Z', { gps_distance_km: 0, distance_km: 7.5, ended_at: null }),
      trip('old', '2026-10-16T12:00:00Z'), trip('future', '2026-11-16T12:00:00Z'),
      trip('other', '2026-11-01T12:00:00Z', { vehicle_id: 'verona' }),
      trip('cancelled', '2026-11-01T12:00:00Z', { status: 'CANCELLED' }),
      trip('active', '2026-11-01T12:00:00Z', { status: 'IN_PROGRESS' }),
    ];
  });
  afterEach(() => vi.useRealTimers());

  it('filters all four sources to 30 days and the selected vehicle before computing any chart or total', async () => {
    const data = await reportsService.getConsolidatedData('titan', 30);
    expect(data.fuel.map(x => x.id)).toEqual(['current']);
    expect(data.maintenance.map(x => x.id)).toEqual(['current']);
    expect(data.expenses.map(x => x.id)).toEqual(['current']);
    expect(data.trips.map(x => x.id)).toEqual(['gps', 'odo']);
    expect(data.consolidated).toHaveLength(3);
    const metrics = calculateReportMetrics(data);
    expect(metrics.totalSpent).toBe(60); expect(metrics.totalKm).toBe(20); expect(metrics.costPerKm).toBe(3);
    expect(metrics.monthlyData).toEqual([{ month: expect.any(String), Combustível: 10, Manutenção: 20, Despesas: 30 }]);
    expect(metrics.monthlyDistance[0].km).toBe(20);
    expect(mock.calls.every(c => c.eq.some(([key, value]) => key === 'vehicle_id' && value === 'titan'))).toBe(true);
    expect(mock.calls.find(c => c.table === 'trips')!.or).toContain('ended_at.is.null,started_at.gte.');
    for (const table of ['fuel_entries', 'maintenance_entries', 'vehicle_expenses']) {
      expect(mock.calls.find(c => c.table === table)!.gte[0][1]).toBe('2026-10-17');
      expect(mock.calls.find(c => c.table === table)!.lt[0][1]).toBe('2026-11-16');
    }
  });

  it.each([30, 90, 180, 365])('uses the same %s-day period for every source', async days => {
    const data = await reportsService.getConsolidatedData('titan', days);
    expect(data.days).toBe(days);
    const financial = mock.calls.filter(c => c.table !== 'trips');
    expect(new Set(financial.map(c => c.gte[0][1])).size).toBe(1);
    expect(financial.every(c => c.lt[0][1] === '2026-11-16')).toBe(true);
  });

  it('does not mix Verona with Titan and supports Tudo without a date bound', async () => {
    const data = await reportsService.getConsolidatedData('verona');
    expect(calculateReportMetrics(data).totalSpent).toBe(27000);
    expect(data.trips.map(t => t.id)).toEqual(['other']);
    expect(mock.calls.every(c => c.gte.length === 0 && c.lt.length === 0 && !c.or)).toBe(true);
  });

  it('uses ended_at even if a trip started before the period, and excludes one completed outside it', async () => {
    mock.rows.trips = [
      trip('included', '2026-10-01T12:00:00Z', { ended_at: '2026-11-01T12:00:00Z' }),
      trip('excluded', '2026-11-01T12:00:00Z', { ended_at: '2026-11-16T12:00:00Z' }),
    ];
    expect((await reportsService.getConsolidatedData('titan', 30)).trips.map(t => t.id)).toEqual(['included']);
  });

  it('reads beyond the response cap without duplicate trips and keeps exact full pages', async () => {
    mock.rows.trips = Array.from({ length: 1200 }, (_, i) => trip(String(i), '2026-11-01T12:00:00Z'));
    const data = await reportsService.getConsolidatedData('titan', 30);
    expect(data.trips).toHaveLength(1200); expect(new Set(data.trips.map(t => t.id)).size).toBe(1200);
    expect(calculateReportMetrics(data).totalKm).toBe(12000);
    expect(mock.calls.find(c => c.table === 'trips')!.order).toEqual(['started_at', 'id']);
    expect(mock.calls.find(c => c.table === 'trips')!.range).toEqual([1200, 1699]);
    mock.rows.trips = mock.rows.trips.slice(0, 500);
    expect((await reportsService.getConsolidatedData('titan', 30)).trips).toHaveLength(500);
    expect(mock.calls.filter(c => c.table === 'trips').at(-1)!.range).toEqual([500, 999]);
  });

  it.each(['fuel_entries', 'maintenance_entries', 'vehicle_expenses', 'trips'])('propagates %s errors instead of displaying incomplete totals as success', async table => {
    const failure = { message: 'remote unavailable' }; mock.errors[table] = failure;
    await expect(reportsService.getConsolidatedData('titan', 30)).rejects.toBe(failure);
  });

  it('preserves old one-argument financial service calls', async () => {
    expect(await fuelEntriesService.getEntries('titan')).toHaveLength(3);
    expect(await maintenanceEntriesService.getEntries('titan')).toHaveLength(3);
    expect(await vehicleExpensesService.getExpenses('titan')).toHaveLength(3);
    expect(mock.calls.every(c => c.gte.length === 0 && c.lt.length === 0)).toBe(true);
  });
});
