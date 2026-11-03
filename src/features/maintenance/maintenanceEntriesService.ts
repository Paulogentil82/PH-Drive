import { supabase } from '../../lib/supabase';
import { MaintenanceEntry } from '../../types/maintenance_entry';
import { periodBounds } from '../../utils/metricDates';
import { readAllPages } from '../../lib/readAllPages';

export const maintenanceEntriesService = {
  async getEntries(vehicleId: string, days?: number, now = new Date()): Promise<MaintenanceEntry[]> {
    let query = supabase
      .from('maintenance_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('performed_at', { ascending: false })
      .order('id', { ascending: false });

    if (days !== undefined) {
      const { civilStart, civilEnd } = periodBounds(days, now);
      query = query.gte('performed_at', civilStart).lt('performed_at', civilEnd);
    }
    return readAllPages<MaintenanceEntry>((from, to) => query.range(from, to));
  },

  async addEntry(entry: Omit<MaintenanceEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<MaintenanceEntry> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('maintenance_entries')
      .insert([{ ...entry, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;

    const { error: odometerError } = await supabase.rpc('update_vehicle_odometer', {
      v_id: entry.vehicle_id,
      new_km: entry.odometer_km,
    });
    if (odometerError) throw odometerError;

    return data as MaintenanceEntry;
  },

  async updateEntry(id: string, entry: Partial<MaintenanceEntry>): Promise<MaintenanceEntry> {
    const { data, error } = await supabase
      .from('maintenance_entries')
      .update(entry)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceEntry;
  },

  async deleteEntry(id: string): Promise<void> {
    const { error } = await supabase
      .from('maintenance_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
