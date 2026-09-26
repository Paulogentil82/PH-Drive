export interface MaintenanceEntry {
  id: string;
  user_id: string;
  vehicle_id: string;
  performed_at: string;
  odometer_km: number;
  service_type: string;
  description?: string;
  cost_amount?: number;
  workshop_name?: string;
  next_due_odometer_km?: number;
  next_due_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type MaintenanceStatus = 'OK' | 'PRÓXIMA' | 'VENCIDA' | 'SEM_REVISAO';
