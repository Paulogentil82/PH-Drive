export interface VehicleExpense {
  id: string;
  user_id: string;
  vehicle_id: string;
  expense_date: string;
  category: string;
  description?: string;
  amount: number;
  vendor_name?: string;
  payment_method?: string;
  recurring: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}
