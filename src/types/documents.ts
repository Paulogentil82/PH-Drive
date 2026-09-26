export type DocumentType = 'IPVA' | 'LICENCIAMENTO' | 'SEGURO' | 'VISTORIA' | 'OUTRO';
export type DocumentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface VehicleDocument {
  id: string;
  user_id: string;
  vehicle_id: string;
  document_type: DocumentType;
  title: string;
  reference_year: number | null;
  issue_date: string | null;
  due_date: string | null;
  amount: number | null;
  status: DocumentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
