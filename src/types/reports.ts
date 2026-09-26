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
