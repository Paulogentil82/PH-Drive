CREATE TABLE public.maintenance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  odometer_km NUMERIC(12,2) NOT NULL CHECK (odometer_km >= 0),
  service_type TEXT NOT NULL CHECK (service_type <> ''),
  description TEXT NULL,
  cost_amount NUMERIC(10,2) NULL CHECK (cost_amount IS NULL OR cost_amount >= 0),
  workshop_name TEXT NULL,
  next_due_odometer_km NUMERIC(12,2) NULL,
  next_due_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_entries ADD CONSTRAINT check_next_due_odometer 
  CHECK (next_due_odometer_km IS NULL OR next_due_odometer_km >= odometer_km);

ALTER TABLE public.maintenance_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can select their own maintenance entries" ON public.maintenance_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own maintenance entries" ON public.maintenance_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own maintenance entries" ON public.maintenance_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own maintenance entries" ON public.maintenance_entries FOR DELETE USING (user_id = auth.uid());

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintenance_entries_updated_at
BEFORE UPDATE ON public.maintenance_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger function for vehicle ownership
CREATE OR REPLACE FUNCTION check_maintenance_vehicle_ownership()
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

CREATE TRIGGER trg_check_maintenance_vehicle_ownership
BEFORE INSERT OR UPDATE ON public.maintenance_entries
FOR EACH ROW EXECUTE FUNCTION check_maintenance_vehicle_ownership();

-- Indexes
CREATE INDEX idx_maintenance_user_performed ON public.maintenance_entries(user_id, performed_at DESC);
CREATE INDEX idx_maintenance_vehicle_performed ON public.maintenance_entries(vehicle_id, performed_at DESC);
CREATE INDEX idx_maintenance_vehicle_odometer ON public.maintenance_entries(vehicle_id, odometer_km DESC);
CREATE INDEX idx_maintenance_vehicle_next_km ON public.maintenance_entries(vehicle_id, next_due_odometer_km);
CREATE INDEX idx_maintenance_vehicle_next_date ON public.maintenance_entries(vehicle_id, next_due_date);

-- RPC to update vehicle odometer
CREATE OR REPLACE FUNCTION update_vehicle_odometer(v_id UUID, new_km NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE public.vehicles
  SET odometer_km = new_km
  WHERE id = v_id AND new_km > odometer_km;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
