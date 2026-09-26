import { supabase } from '../../lib/supabase';
import { VehicleExpense } from '../../types/vehicle_expense';

export const vehicleExpensesService = {
  async getExpenses(vehicleId: string): Promise<VehicleExpense[]> {
    const { data, error } = await supabase
      .from('vehicle_expenses')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('expense_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addExpense(expense: Omit<VehicleExpense, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<VehicleExpense> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('vehicle_expenses')
      .insert([{ ...expense, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data as VehicleExpense;
  },

  async updateExpense(id: string, expense: Partial<VehicleExpense>): Promise<VehicleExpense> {
    const { data, error } = await supabase
      .from('vehicle_expenses')
      .update(expense)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as VehicleExpense;
  },

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('vehicle_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
