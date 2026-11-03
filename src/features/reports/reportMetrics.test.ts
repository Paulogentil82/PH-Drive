import { describe, expect, it } from 'vitest';
import { calculateReportMetrics } from './reportMetrics';
import { calculateDashboardPeriodMetrics } from '../dashboard/dashboardMetrics';
import type { Trip } from '../../types';
import type { ReportData } from '../../types/reports';

const empty = (): ReportData => ({ vehicleId: 'titan', trips: [], fuel: [], maintenance: [], expenses: [], consolidated: [] });
const trip = (id: string, started: Date, ended?: Date | null, overrides = {}): Trip => ({
  id, vehicle_id: 'titan', status: 'COMPLETED', started_at: started.toISOString(),
  ended_at: ended?.toISOString() || null, distance_km: 100, gps_distance_km: 10, ...overrides,
} as Trip);

describe('report monthly aggregation and dashboard consistency', () => {
  it('aggregates by completion month rather than start and supports a missing ended_at', () => {
    const data = empty();
    data.trips = [
      trip('cross-month', new Date(2026, 9, 31, 23), new Date(2026, 10, 1, 1)),
      trip('no-end', new Date(2026, 9, 30, 12)),
    ];
    expect(calculateReportMetrics(data).monthlyDistance).toEqual([
      { month: new Date(2026, 9, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), km: 10 },
      { month: new Date(2026, 10, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), km: 10 },
    ]);
  });
  it('orders multiple years chronologically and preserves civil midnight financial dates', () => {
    const data = empty();
    data.fuel = [
      { filled_at: '2026-01-01T00:00:00Z', total_amount: 20 },
      { filled_at: '2025-12-31', total_amount: 10 },
    ] as any;
    data.maintenance = [{ performed_at: '2026-01-01T00:00:00Z', cost_amount: 30 }] as any;
    data.expenses = [{ expense_date: '2026-01-01', amount: 40 }] as any;
    const result = calculateReportMetrics(data);
    expect(result.monthlyData.map(m => m.Combustível)).toEqual([10, 20]);
    expect(result.monthlyData[1]).toMatchObject({ Manutenção: 30, Despesas: 40 });
    expect(result.totalSpent).toBe(100);
  });
  it('uses null for cost/km when distance is absent instead of NaN/Infinity', () => {
    const data = empty(); data.fuel = [{ total_amount: 200, filled_at: '2026-11-01' }] as any;
    expect(calculateReportMetrics(data)).toMatchObject({ totalKm: 0, costPerKm: null, totalSpent: 200 });
  });
  it('does not round intermediate distances or costs', () => {
    const data = empty(); data.trips = [trip('precise', new Date(), null, { gps_distance_km: 0.123456 })];
    data.expenses = [{ expense_date: '2026-11-01', amount: 1.23 }] as any;
    expect(calculateReportMetrics(data).costPerKm).toBe(1.23 / 0.123456);
  });
  it('dashboard month uses the same completion date, GPS and cost rules as reports', () => {
    const data = empty();
    data.trips = [
      trip('finished-this-month', new Date(2026, 9, 31, 23), new Date(2026, 10, 1, 1)),
      trip('finished-last-month', new Date(2026, 9, 31, 12)),
      trip('other-car', new Date(2026, 10, 1), null, { vehicle_id: 'verona' }),
      trip('cancelled', new Date(2026, 10, 1), null, { status: 'CANCELLED' }),
      trip('active', new Date(2026, 10, 1), null, { status: 'IN_PROGRESS' }),
    ];
    data.fuel = [{ vehicle_id: 'titan', filled_at: '2026-11-01T00:00:00Z', total_amount: 10 }] as any;
    data.maintenance = [
      { vehicle_id: 'titan', performed_at: '2026-11-01', cost_amount: 20 },
      { vehicle_id: 'titan', performed_at: '2026-10-31', cost_amount: 2000 },
    ] as any;
    data.expenses = [
      { vehicle_id: 'titan', expense_date: '2026-11-01', amount: 30 },
      { vehicle_id: 'verona', expense_date: '2026-11-01', amount: 3000 },
    ] as any;
    const result = calculateDashboardPeriodMetrics({ trips: data.trips, fuelEntries: data.fuel, maintenanceEntries: data.maintenance, expenses: data.expenses }, 'titan', new Date(2026, 10, 15));
    expect(result).toMatchObject({ tripsMonthCount: 1, kmMonth: 10, spentMonth: 60 });
    expect(result.recentMonthsDistances.at(-1)?.distance).toBe(10);
    expect(result.recentMonthsDistances.at(-2)?.distance).toBe(10);
  });
});
