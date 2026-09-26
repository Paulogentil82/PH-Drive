import { supabase } from '../../lib/supabase';
import { fuelEntriesService } from '../fuel/fuelEntriesService';
import { maintenanceEntriesService } from '../maintenance/maintenanceEntriesService';
import { vehicleExpensesService } from '../expenses/vehicleExpensesService';
import { ConsolidatedItem } from '../../types/reports';

export const reportsService = {
  async getConsolidatedData(vehicleId: string, days?: number) {
    const [fuel, maintenance, expenses, trips] = await Promise.all([
      fuelEntriesService.getEntries(vehicleId, days),
      maintenanceEntriesService.getEntries(vehicleId),
      vehicleExpensesService.getExpenses(vehicleId),
      supabase.from('trips').select('*').eq('vehicle_id', vehicleId).eq('status', 'COMPLETED')
    ]);

    const consolidated: ConsolidatedItem[] = [
      ...fuel.map((f: any) => ({ id: f.id, date: f.filled_at, type: 'Abastecimento' as const, category: 'Combustível', description: 'Abastecimento', amount: f.total_amount, vehicle_id: f.vehicle_id })),
      ...maintenance.map((m: any) => ({ id: m.id, date: m.performed_at, type: 'Manutenção' as const, category: m.service_type, description: m.description || '', amount: m.cost_amount || 0, vehicle_id: m.vehicle_id })),
      ...expenses.map((e: any) => ({ id: e.id, date: e.expense_date, type: 'Despesa' as const, category: e.category, description: e.description || '', amount: e.amount, vehicle_id: e.vehicle_id }))
    ];

    // Filter consolidated by days
    const filteredConsolidated = days ? consolidated.filter(i => {
        const d = new Date(i.date);
        const limit = new Date();
        limit.setDate(limit.getDate() - days);
        return d >= limit;
    }) : consolidated;

    return {
        consolidated: filteredConsolidated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        fuel,
        maintenance,
        expenses,
        trips: trips.data || []
    };
  }
};
