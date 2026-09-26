export type TirePosition = 
  | 'FRONT'
  | 'REAR'
  | 'FRONT_LEFT'
  | 'FRONT_RIGHT'
  | 'REAR_LEFT'
  | 'REAR_RIGHT'
  | 'SPARE'
  | 'OTHER';

export type TireStatus = 'ACTIVE' | 'REMOVED';

export interface VehicleTire {
  id: string;
  user_id: string;
  vehicle_id: string;
  brand: string | null;
  model: string | null;
  tire_size: string;
  position: TirePosition;
  installed_at: string;
  installed_odometer_km: number;
  expected_life_km: number | null;
  removed_at: string | null;
  removed_odometer_km: number | null;
  status: TireStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
