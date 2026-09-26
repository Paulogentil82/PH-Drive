export type AlertSeverity = 'VENCIDO' | 'URGENTE' | 'PRÓXIMO' | 'INFORMATIVO';

export interface Alert {
  id: string;
  sourceType: 'maintenance' | 'expense' | 'document' | 'tire';
  sourceId: string;
  vehicleId: string;
  vehicleName: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  dueDate?: string;
  dueOdometerKm?: number;
  status: 'active';
}
