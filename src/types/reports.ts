import type { Trip } from './index';
import type { FuelEntry } from './fuel_entry';
import type { MaintenanceEntry } from './maintenance_entry';
import type { VehicleExpense } from './vehicle_expense';

export interface ReportData {
  vehicleId: string;
  days?: number;
  consolidated: ConsolidatedItem[];
  fuel: FuelEntry[];
  maintenance: MaintenanceEntry[];
  expenses: VehicleExpense[];
  trips: Trip[];
}

export interface ConsolidatedItem {
  id: string;
  date: string;
  type: 'Abastecimento' | 'Manutenção' | 'Despesa';
  category: string;
  description: string;
  amount: number;
  vehicle_id: string;
}

export interface ReportSummary {
  totalSpent: number;
  fuelSpent: number;
  maintenanceSpent: number;
  generalSpent: number;
  totalKm: number;
  totalTrips: number;
  // ... add others as needed
}
