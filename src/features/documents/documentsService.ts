import { supabase } from '../../lib/supabase';
import { VehicleDocument } from '../../types/documents';

export const documentsService = {
  async getDocuments(vehicleId?: string): Promise<VehicleDocument[]> {
    let query = supabase.from('vehicle_documents').select('*');
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    const { data, error } = await query.order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addDocument(doc: Omit<VehicleDocument, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<VehicleDocument> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const cleanDoc = {
      ...doc,
      amount: doc.amount ?? null
    };
    const { data, error } = await supabase.from('vehicle_documents').insert([{ ...cleanDoc, user_id: user.id }]).select().single();
    if (error) throw error;
    return data as VehicleDocument;
  },

  async createDocument(doc: Omit<VehicleDocument, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<VehicleDocument> {
    return this.addDocument(doc);
  },

  async updateDocument(id: string, doc: Partial<VehicleDocument>): Promise<VehicleDocument> {
    const cleanDoc = { ...doc };
    if (doc.amount !== undefined) {
      cleanDoc.amount = doc.amount ?? null;
    }
    const { data, error } = await supabase.from('vehicle_documents').update(cleanDoc).eq('id', id).select().single();
    if (error) throw error;
    return data as VehicleDocument;
  },

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase.from('vehicle_documents').delete().eq('id', id);
    if (error) throw error;
  },
  
  async markAsPaid(id: string, paidAt: string): Promise<VehicleDocument> {
      return this.updateDocument(id, { status: 'PAID', paid_at: paidAt });
  }
};
