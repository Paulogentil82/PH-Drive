import type { ReportData } from '../../types/reports';
import { monthKey, monthLabel } from '../../utils/metricDates';
import { effectiveTripDistance, tripMetricDate } from '../../utils/tripMetrics';

export function calculateReportMetrics(data: Pick<ReportData, 'fuel' | 'maintenance' | 'expenses' | 'trips'>) {
  const finite = (value: number | undefined) => Number.isFinite(value) ? value! : 0;
  const fuelSpent = data.fuel.reduce((sum, f) => sum + finite(f.total_amount), 0);
  const maintSpent = data.maintenance.reduce((sum, m) => sum + finite(m.cost_amount), 0);
  const genSpent = data.expenses.reduce((sum, e) => sum + finite(e.amount), 0);
  const totalSpent = fuelSpent + maintSpent + genSpent;
  const totalKm = data.trips.reduce((sum, trip) => sum + effectiveTripDistance(trip), 0);

  const costs = new Map<string, { month: string; Combustível: number; Manutenção: number; Despesas: number }>();
  const addCost = (date: string, category: 'Combustível' | 'Manutenção' | 'Despesas', amount: number | undefined) => {
    const key = monthKey(date, true);
    if (!key) return;
    const row = costs.get(key) || { month: monthLabel(key), Combustível: 0, Manutenção: 0, Despesas: 0 };
    row[category] += finite(amount);
    costs.set(key, row);
  };
  data.fuel.forEach(f => addCost(f.filled_at, 'Combustível', f.total_amount));
  data.maintenance.forEach(m => addCost(m.performed_at, 'Manutenção', m.cost_amount));
  data.expenses.forEach(e => addCost(e.expense_date, 'Despesas', e.amount));
  const distances = new Map<string, { month: string; km: number }>();
  data.trips.forEach(trip => {
    const key = monthKey(tripMetricDate(trip));
    if (!key) return;
    const row = distances.get(key) || { month: monthLabel(key), km: 0 };
    row.km += effectiveTripDistance(trip);
    distances.set(key, row);
  });
  return {
    totalSpent, fuelSpent, maintSpent, genSpent, totalKm,
    costPerKm: totalKm > 0 ? totalSpent / totalKm : null,
    monthlyData: [...costs].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
    monthlyDistance: [...distances].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
  };
}
