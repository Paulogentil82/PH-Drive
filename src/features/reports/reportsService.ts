import { supabase } from '../../lib/supabase';
import { fuelEntriesService } from '../fuel/fuelEntriesService';
import { maintenanceEntriesService } from '../maintenance/maintenanceEntriesService';
import { vehicleExpensesService } from '../expenses/vehicleExpensesService';
import { ConsolidatedItem } from '../../types/reports';
import type { ReportData } from '../../types/reports';
import type { Trip } from '../../types';
import { readAllPages } from '../../lib/readAllPages';
import { isInPeriod, metricDate, periodBounds } from '../../utils/metricDates';
import { tripMetricDate } from '../../utils/tripMetrics';

export const reportsService = {
  async getConsolidatedData(vehicleId: string, days?: number): Promise<ReportData> {
    // Freeze one reference clock for all four sources, even across midnight.
    const now = new Date();
    let query = supabase.from('trips').select('*').eq('vehicle_id', vehicleId).eq('status', 'COMPLETED')
      .order('started_at', { ascending: false }).order('id', { ascending: false });
    if (days !== undefined) {
      const { start, end } = periodBounds(days, now);
      const lower = start.toISOString();
      const upper = end.toISOString();
      query = query.or(`and(ended_at.gte.${lower},ended_at.lt.${upper}),and(ended_at.is.null,started_at.gte.${lower},started_at.lt.${upper})`);
    }
    const [fuelRows, maintenanceRows, expenseRows, tripRows] = await Promise.all([
      fuelEntriesService.getEntries(vehicleId, days, now),
      maintenanceEntriesService.getEntries(vehicleId, days, now),
      vehicleExpensesService.getExpenses(vehicleId, days, now),
      readAllPages<Trip>((from, to) => query.range(from, to)),
    ]);
    const fuel = fuelRows.filter(f => f.vehicle_id === vehicleId && isInPeriod(f.filled_at, days, now, true));
    const maintenance = maintenanceRows.filter(m => m.vehicle_id === vehicleId && isInPeriod(m.performed_at, days, now, true));
    const expenses = expenseRows.filter(e => e.vehicle_id === vehicleId && isInPeriod(e.expense_date, days, now, true));
    const trips = tripRows.filter(t => t.vehicle_id === vehicleId && t.status === 'COMPLETED' && isInPeriod(tripMetricDate(t), days, now));

    const consolidated: ConsolidatedItem[] = [
      ...fuel.map((f: any) => ({ id: f.id, date: f.filled_at, type: 'Abastecimento' as const, category: 'Combustível', description: 'Abastecimento', amount: f.total_amount, vehicle_id: f.vehicle_id })),
      ...maintenance.map((m: any) => ({ id: m.id, date: m.performed_at, type: 'Manutenção' as const, category: m.service_type, description: m.description || '', amount: m.cost_amount || 0, vehicle_id: m.vehicle_id })),
      ...expenses.map((e: any) => ({ id: e.id, date: e.expense_date, type: 'Despesa' as const, category: e.category, description: e.description || '', amount: e.amount, vehicle_id: e.vehicle_id }))
    ];

    return {
        vehicleId, days,
        consolidated: consolidated.sort((a, b) => metricDate(b.date, true)!.getTime() - metricDate(a.date, true)!.getTime()),
        fuel,
        maintenance,
        expenses,
        trips
    };
  }
};
