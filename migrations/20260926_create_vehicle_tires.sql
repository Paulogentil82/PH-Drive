CREATE TABLE public.vehicle_tires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  brand TEXT NULL,
  model TEXT NULL,
  tire_size TEXT NOT NULL,
  position TEXT NOT NULL,
  installed_at DATE NOT NULL,
  installed_odometer_km NUMERIC(12,2) NOT NULL,
  expected_life_km NUMERIC(12,2) NULL,
  removed_at DATE NULL,
  removed_odometer_km NUMERIC(12,2) NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_tire_size CHECK (length(trim(tire_size)) > 0),
  CONSTRAINT check_position CHECK (length(trim(position)) > 0),
  CONSTRAINT check_installed_odometer CHECK (installed_odometer_km >= 0),
  CONSTRAINT check_expected_life CHECK (expected_life_km IS NULL OR expected_life_km > 0),
  CONSTRAINT check_removed_odometer CHECK (removed_odometer_km IS NULL OR removed_odometer_km >= installed_odometer_km),
  CONSTRAINT check_status_removed CHECK (
    (status = 'REMOVED' AND removed_at IS NOT NULL) OR
    (status = 'ACTIVE' AND removed_at IS NULL AND removed_odometer_km IS NULL)
  ),
  CONSTRAINT check_status_value CHECK (status IN ('ACTIVE', 'REMOVED'))
);

-- RLS
ALTER TABLE public.vehicle_tires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own tires" ON public.vehicle_tires 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert tires for their own vehicles" ON public.vehicle_tires 
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND 
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update their own tires and vehicles" ON public.vehicle_tires 
  FOR UPDATE USING (
    user_id = auth.uid() AND 
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own tires" ON public.vehicle_tires 
  FOR DELETE USING (user_id = auth.uid());

-- Triggers

-- 1. Ownership validation trigger
CREATE OR REPLACE FUNCTION public.check_vehicle_tire_ownership() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles 
    WHERE id = NEW.vehicle_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Vehicle ownership mismatch or vehicle does not exist';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

CREATE TRIGGER trg_vehicle_tires_ownership
BEFORE INSERT OR UPDATE ON public.vehicle_tires
FOR EACH ROW EXECUTE FUNCTION public.check_vehicle_tire_ownership();

-- 2. Updated at trigger
CREATE OR REPLACE FUNCTION public.set_vehicle_tire_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

CREATE TRIGGER trg_vehicle_tires_updated_at
BEFORE UPDATE ON public.vehicle_tires
FOR EACH ROW EXECUTE FUNCTION public.set_vehicle_tire_updated_at();

-- Indexes
CREATE INDEX idx_vehicle_tires_user_vehicle ON public.vehicle_tires(user_id, vehicle_id);
CREATE INDEX idx_vehicle_tires_vehicle_status ON public.vehicle_tires(vehicle_id, status);
CREATE INDEX idx_vehicle_tires_vehicle_position ON public.vehicle_tires(vehicle_id, position);
CREATE INDEX idx_vehicle_tires_vehicle_installed_desc ON public.vehicle_tires(vehicle_id, installed_at DESC);

-- Unique ACTIVE position rule index
CREATE UNIQUE INDEX idx_vehicle_tires_unique_active_pos 
ON public.vehicle_tires (vehicle_id, position) 
WHERE status = 'ACTIVE';
