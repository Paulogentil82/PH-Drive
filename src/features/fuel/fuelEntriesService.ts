import { supabase } from '../../lib/supabase';
import { FuelEntry } from '@/types/fuel_entry';

export const fuelEntriesService = {
  async addEntry(entry: Omit<FuelEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<FuelEntry> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('fuel_entries')
      .insert([{ ...entry, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data as FuelEntry;
  },

  async updateEntry(id: string, entry: Partial<FuelEntry>): Promise<FuelEntry> {
    const { data, error } = await supabase
      .from('fuel_entries')
      .update(entry)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as FuelEntry;
  },

  async getLatestEntry(vehicleId: string): Promise<FuelEntry | null> {
    const { data, error } = await supabase
      .from('fuel_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('odometer_km', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as FuelEntry | null;
  },

  async deleteEntry(id: string): Promise<void> {
    const { error } = await supabase
      .from('fuel_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getEntries(vehicleId: string, days?: number): Promise<FuelEntry[]> {
    let query = supabase
      .from('fuel_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('filled_at', { ascending: false });

    if (days) {
      const date = new Date();
      date.setDate(date.getDate() - days);
      query = query.gte('filled_at', date.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as FuelEntry[]) || [];
  },

  calculateConsumption(entries: FuelEntry[]): { lastConsumption: number | null, averageConsumption: number | null, totalSpent: number, totalLiters: number } {
    const cycles = this.getValidConsumptionCycles(entries);
    
    let totalSpent = 0;
    let totalLiters = 0;
    entries.forEach(e => {
      totalSpent += e.total_amount;
      totalLiters += e.liters;
    });

    if (cycles.length === 0) {
      return { lastConsumption: null, averageConsumption: null, totalSpent, totalLiters };
    }

    const lastCycle = cycles[cycles.length - 1];
    const lastConsumption = lastCycle.distance / lastCycle.liters;

    const totalDistance = cycles.reduce((sum, c) => sum + c.distance, 0);
    const totalCycleLiters = cycles.reduce((sum, c) => sum + c.liters, 0);
    const averageConsumption = totalCycleLiters > 0 ? totalDistance / totalCycleLiters : null;

    return { lastConsumption, averageConsumption, totalSpent, totalLiters };
  },

  getValidConsumptionCycles(entries: FuelEntry[]) {
    const sorted = [...entries].sort((a, b) => new Date(a.filled_at).getTime() - new Date(b.filled_at).getTime());
    const cycles = [];
    let previousFullTank: FuelEntry | null = null;
    let accumulatedLitersForCycle = 0;

    for (const entry of sorted) {
      if (entry.full_tank) {
        if (previousFullTank) {
          const distance = entry.odometer_km - previousFullTank.odometer_km;
          const liters = accumulatedLitersForCycle + entry.liters;
          if (distance > 0 && liters > 0) {
            cycles.push({ date: entry.filled_at, distance, liters, consumption: distance / liters });
          }
        }
        previousFullTank = entry;
        accumulatedLitersForCycle = 0;
      } else {
        accumulatedLitersForCycle += entry.liters;
      }
    }
    return cycles;
  }
};
