import { supabase } from '../../lib/supabase';
import { MaintenanceEntry } from '../../types/maintenance_entry';

export const maintenanceEntriesService = {
  async getEntries(vehicleId: string): Promise<MaintenanceEntry[]> {
    const { data, error } = await supabase
      .from('maintenance_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('performed_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
