CREATE TABLE public.vehicle_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  category TEXT NOT NULL CHECK (category <> ''),
  description TEXT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  vendor_name TEXT NULL,
  payment_method TEXT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can select their own expenses" ON public.vehicle_expenses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own expenses" ON public.vehicle_expenses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own expenses" ON public.vehicle_expenses FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own expenses" ON public.vehicle_expenses FOR DELETE USING (user_id = auth.uid());

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_expenses_updated_at
BEFORE UPDATE ON public.vehicle_expenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger function for vehicle ownership
CREATE OR REPLACE FUNCTION check_expense_vehicle_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE id = NEW.vehicle_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'O veículo não pertence ao usuário.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_expense_vehicle_ownership
BEFORE INSERT OR UPDATE ON public.vehicle_expenses
FOR EACH ROW EXECUTE FUNCTION check_expense_vehicle_ownership();

-- Indexes
CREATE INDEX idx_expenses_user_date ON public.vehicle_expenses(user_id, expense_date DESC);
CREATE INDEX idx_expenses_vehicle_date ON public.vehicle_expenses(vehicle_id, expense_date DESC);
CREATE INDEX idx_expenses_vehicle_category ON public.vehicle_expenses(vehicle_id, category);
