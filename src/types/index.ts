export type VehicleType = 'CAR' | 'MOTORCYCLE';

export type FuelType = 
  | 'GASOLINE' 
  | 'ETHANOL' 
  | 'DIESEL' 
  | 'FLEX' 
  | 'ELECTRIC' 
  | 'HYBRID' 
  | 'GNV';

export type TripStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  default_vehicle_id?: string | null;
  distance_unit?: 'KM' | 'MI';
  currency_code?: 'BRL' | 'USD' | 'EUR';
  date_format?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  alert_upcoming_enabled?: boolean;
  alert_urgent_enabled?: boolean;
  alert_overdue_enabled?: boolean;
  theme_preference?: 'SYSTEM' | 'LIGHT' | 'DARK';
}

export interface Vehicle {
  id: string;
  user_id: string;
  name: string;
  type: VehicleType;
  brand: string | null;
  model: string | null;
  version: string | null;
  year: number | null;
  license_plate: string | null;
  fuel_type: FuelType | null;
  odometer_km: number;
  tank_capacity_liters: number | null;
  average_consumption_km_l: number | null;
  image_url: string | null;
  bluetooth_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehicleFormData {
  name: string;
  type: VehicleType;
  brand: string;
  model: string;
  version: string;
  year: number | null;
  license_plate: string;
  fuel_type: FuelType;
  odometer_km: number;
  tank_capacity_liters: number | null;
  average_consumption_km_l: number | null;
  image_url: string;
  bluetooth_name: string;
  active: boolean;
}

export type TripPointSource = 'MANUAL' | 'MOBILE_GPS' | 'IMPORT';

export interface TripPoint {
  id: string;
  trip_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  speed_kmh: number | null;
  heading_degrees: number | null;
  altitude_meters: number | null;
  captured_at: string;
  sequence_number: number;
  source: TripPointSource;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  vehicle_id: string;
  status: TripStatus;
  started_at: string;
  ended_at: string | null;
  start_odometer_km: number | null;
  end_odometer_km: number | null;
  distance_km: number | null;
  gps_distance_km?: number | null;
  duration_seconds: number | null;
  origin_label: string | null;
  destination_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: Vehicle;
  trip_points?: TripPoint[];
}

export interface StartTripFormData {
  vehicle_id: string;
  start_odometer_km: number;
  origin_label: string;
  notes: string;
}

export interface EndTripFormData {
  end_odometer_km: number;
  destination_label: string;
  distance_km?: number;
}

export type NavigationTab = 
  | 'dashboard'
  | 'map'
  | 'trips'
  | 'vehicles'
  | 'fuel'
  | 'maintenance'
  | 'expenses'
  | 'documents'
  | 'reports'
  | 'alerts'
  | 'tires'
  | 'profile'
  | 'settings';

