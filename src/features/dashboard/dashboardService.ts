import { supabase } from '../../lib/supabase';
import { Vehicle, Trip } from '../../types';
import { FuelEntry } from '../../types/fuel_entry';
import { MaintenanceEntry } from '../../types/maintenance_entry';
import { VehicleExpense } from '../../types/vehicle_expense';
import { VehicleDocument } from '../../types/documents';
import { VehicleTire } from '../../types/tires';

export const dashboardService = {
  async getDashboardData(vehicleId: string) {
    const [
      tripsRes,
      fuelRes,
      maintenanceRes,
      expensesRes,
      documentsRes,
      tiresRes
    ] = await Promise.all([
      supabase
        .from('trips')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('started_at', { ascending: false })
        .limit(100),
      supabase
        .from('fuel_entries')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('filled_at', { ascending: false }),
      supabase
        .from('maintenance_entries')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('performed_at', { ascending: false }),
      supabase
        .from('vehicle_expenses')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('expense_date', { ascending: false }),
      supabase
        .from('vehicle_documents')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('due_date', { ascending: true }),
      supabase
        .from('vehicle_tires')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('installed_at', { ascending: false })
    ]);

    if (tripsRes.error) throw tripsRes.error;
    if (fuelRes.error) throw fuelRes.error;
    if (maintenanceRes.error) throw maintenanceRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (documentsRes.error) throw documentsRes.error;
    if (tiresRes.error) throw tiresRes.error;

    return {
      trips: (tripsRes.data || []) as Trip[],
      fuelEntries: (fuelRes.data || []) as FuelEntry[],
      maintenanceEntries: (maintenanceRes.data || []) as MaintenanceEntry[],
      expenses: (expensesRes.data || []) as VehicleExpense[],
      documents: (documentsRes.data || []) as VehicleDocument[],
      tires: (tiresRes.data || []) as VehicleTire[]
    };
  }
};
