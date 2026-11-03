import type { Trip } from '../../types';
import type { FuelEntry } from '../../types/fuel_entry';
import type { MaintenanceEntry } from '../../types/maintenance_entry';
import type { VehicleExpense } from '../../types/vehicle_expense';
import { civilDateKey, monthKey } from '../../utils/metricDates';
import { effectiveTripDistance, tripMetricDate } from '../../utils/tripMetrics';
import { calculateReportMetrics } from '../reports/reportMetrics';

export function calculateDashboardPeriodMetrics(data: {
  trips: Trip[]; fuelEntries: FuelEntry[]; maintenanceEntries: MaintenanceEntry[]; expenses: VehicleExpense[];
}, vehicleId: string, now = new Date()) {
  const currentMonth = civilDateKey(now).slice(0, 7);
  const completed = data.trips.filter(t => t.vehicle_id === vehicleId && t.status === 'COMPLETED');
  const trips = completed.filter(t => monthKey(tripMetricDate(t)) === currentMonth);
  const month = calculateReportMetrics({
    trips,
    fuel: data.fuelEntries.filter(f => f.vehicle_id === vehicleId && monthKey(f.filled_at, true) === currentMonth),
    maintenance: data.maintenanceEntries.filter(m => m.vehicle_id === vehicleId && monthKey(m.performed_at, true) === currentMonth),
    expenses: data.expenses.filter(e => e.vehicle_id === vehicleId && monthKey(e.expense_date, true) === currentMonth),
  });
  const recentMonthsDistances = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = civilDateKey(date).slice(0, 7);
    return {
      label: date.toLocaleDateString('pt-BR', { month: 'short' }),
      distance: completed.filter(t => monthKey(tripMetricDate(t)) === key).reduce((sum, t) => sum + effectiveTripDistance(t), 0),
    };
  });
  return {
    tripsMonthCount: trips.length, kmMonth: month.totalKm, spentMonth: month.totalSpent,
    spentByCategory: { fuel: month.fuelSpent, maintenance: month.maintSpent, general: month.genSpent },
    recentMonthsDistances,
  };
}
