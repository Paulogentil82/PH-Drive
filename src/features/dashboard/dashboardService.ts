import { supabase } from '../../lib/supabase';
import { Vehicle, Trip } from '../../types';
import { FuelEntry } from '../../types/fuel_entry';
import { MaintenanceEntry } from '../../types/maintenance_entry';
import { VehicleExpense } from '../../types/vehicle_expense';
import { VehicleDocument } from '../../types/documents';
import { VehicleTire } from '../../types/tires';
import { readAllPages } from '../../lib/readAllPages';

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
      readAllPages<Trip>((from, to) => supabase
        .from('trips')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('started_at', { ascending: false })
        .order('id', { ascending: false }).range(from, to)),
      readAllPages<FuelEntry>((from, to) => supabase
        .from('fuel_entries')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('filled_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      readAllPages<MaintenanceEntry>((from, to) => supabase
        .from('maintenance_entries')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('performed_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      readAllPages<VehicleExpense>((from, to) => supabase
        .from('vehicle_expenses')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('expense_date', { ascending: false }).order('id', { ascending: false }).range(from, to)),
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

    if (documentsRes.error) throw documentsRes.error;
    if (tiresRes.error) throw tiresRes.error;

    return {
      vehicleId,
      trips: tripsRes,
      fuelEntries: fuelRes,
      maintenanceEntries: maintenanceRes,
      expenses: expensesRes,
      documents: (documentsRes.data || []) as VehicleDocument[],
      tires: (tiresRes.data || []) as VehicleTire[]
    };
  }
};
