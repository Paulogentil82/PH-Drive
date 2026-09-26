export interface FuelEntry {
  id: string;
  user_id: string;
  vehicle_id: string;
  filled_at: string;
  odometer_km: number;
  liters: number;
  total_amount: number;
  price_per_liter: number;
  fuel_type: string;
  full_tank: boolean;
  station_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
