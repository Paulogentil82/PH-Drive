CREATE TABLE public.vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  reference_year INTEGER NULL,
  issue_date DATE NULL,
  due_date DATE NULL,
  amount NUMERIC(10,2) NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own documents" ON public.vehicle_documents FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own documents" ON public.vehicle_documents FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid()));
CREATE POLICY "Users can update their own documents" ON public.vehicle_documents FOR UPDATE USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete their own documents" ON public.vehicle_documents FOR DELETE USING (user_id = auth.uid());

-- Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_documents_updated_at
BEFORE UPDATE ON public.vehicle_documents
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_vehicle_documents_user_due ON public.vehicle_documents(user_id, due_date);
CREATE INDEX idx_vehicle_documents_vehicle_due ON public.vehicle_documents(vehicle_id, due_date);
CREATE INDEX idx_vehicle_documents_vehicle_type ON public.vehicle_documents(vehicle_id, document_type);
CREATE INDEX idx_vehicle_documents_vehicle_status ON public.vehicle_documents(vehicle_id, status);
