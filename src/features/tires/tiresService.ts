import { supabase } from '../../lib/supabase';
import { VehicleTire } from '../../types/tires';

export const tiresService = {
  async getTires(vehicleId?: string): Promise<VehicleTire[]> {
    let query = supabase.from('vehicle_tires').select('*');
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    const { data, error } = await query.order('installed_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addTire(tire: Omit<VehicleTire, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'removed_at' | 'removed_odometer_km'>): Promise<VehicleTire> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const cleanTire = {
      ...tire,
      user_id: user.id,
      expected_life_km: tire.expected_life_km || null,
      notes: tire.notes || null,
      status: 'ACTIVE' as const,
      removed_at: null,
      removed_odometer_km: null
    };

    const { data, error } = await supabase
      .from('vehicle_tires')
      .insert([cleanTire])
      .select()
      .single();

    if (error) throw error;
    return data as VehicleTire;
  },

  async updateTire(id: string, tire: Partial<VehicleTire>): Promise<VehicleTire> {
    const { data, error } = await supabase
      .from('vehicle_tires')
      .update(tire)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as VehicleTire;
  },

  async removeTire(id: string, removedAt: string, removedOdometer: number): Promise<VehicleTire> {
    const { data, error } = await supabase
      .from('vehicle_tires')
      .update({
        status: 'REMOVED',
        removed_at: removedAt,
        removed_odometer_km: removedOdometer
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as VehicleTire;
  },

  async deleteTire(id: string): Promise<void> {
    const { error } = await supabase
      .from('vehicle_tires')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const mapTireErrorToFriendlyMessage = (err: any, position: string): string => {
  const errMessage = typeof err === 'string' ? err : err?.message || '';
  const errDetails = err?.details || '';
  const errCode = String(err?.code || '');

  const isUniqueViolation = 
    errCode === '23505' || 
    errMessage.includes('23505') ||
    errMessage.includes('idx_vehicle_tires_unique_active_pos') ||
    errDetails.includes('idx_vehicle_tires_unique_active_pos');

  if (isUniqueViolation) {
    const positionLabels: Record<string, string> = {
      FRONT: 'Dianteiro',
      REAR: 'Traseiro',
      FRONT_LEFT: 'Dianteiro esquerdo',
      FRONT_RIGHT: 'Dianteiro direito',
      REAR_LEFT: 'Traseiro esquerdo',
      REAR_RIGHT: 'Traseiro direito',
      SPARE: 'Estepe',
      OTHER: 'Outro'
    };
    const posLabel = positionLabels[position] || 'Outro';
    return `Já existe um pneu ativo na posição ${posLabel}. Remova ou substitua o pneu atual antes de cadastrar outro.`;
  }

  return errMessage || 'Erro ao salvar o pneu.';
};
