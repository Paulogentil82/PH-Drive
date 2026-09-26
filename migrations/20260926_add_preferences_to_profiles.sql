-- Migration: Add preferences and configuration fields to public.profiles
-- Step 1: Add columns with appropriate defaults
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS default_vehicle_id UUID NULL REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'KM',
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS alert_upcoming_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_urgent_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_overdue_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'SYSTEM';

-- Step 2: Add check constraints to enforce valid values (optional but good practice)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_distance_unit,
  DROP CONSTRAINT IF EXISTS chk_profiles_currency_code,
  DROP CONSTRAINT IF EXISTS chk_profiles_date_format,
  DROP CONSTRAINT IF EXISTS chk_profiles_theme_preference;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_distance_unit CHECK (distance_unit IN ('KM', 'MI')),
  ADD CONSTRAINT chk_profiles_currency_code CHECK (currency_code IN ('BRL', 'USD', 'EUR')),
  ADD CONSTRAINT chk_profiles_date_format CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  ADD CONSTRAINT chk_profiles_theme_preference CHECK (theme_preference IN ('SYSTEM', 'LIGHT', 'DARK'));
