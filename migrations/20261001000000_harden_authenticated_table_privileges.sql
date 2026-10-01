-- Hardening dos privilégios diretos de authenticated nas tabelas abaixo.
-- Pré-requisito: as cinco tabelas já devem existir.
-- Correção aplicada manualmente via Supabase SQL Editor em 01/10/2026.
-- Validado: authenticated manteve somente SELECT, INSERT, UPDATE e DELETE.
-- TRUNCATE, REFERENCES e TRIGGER foram confirmados como false.
-- Essa aplicação manual NÃO está registrada em supabase_migrations.
-- O arquivo permanece no repositório como registro/reprodutibilidade.
-- Privilégios herdados de outros papéis ou de PUBLIC exigem validação separada.
-- Reaplicar mantém os mesmos privilégios diretos, sem ampliá-los.


REVOKE ALL PRIVILEGES ON TABLE
  public.fuel_entries,
  public.maintenance_entries,
  public.vehicle_documents,
  public.vehicle_expenses,
  public.vehicle_tires
FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.fuel_entries,
  public.maintenance_entries,
  public.vehicle_documents,
  public.vehicle_expenses,
  public.vehicle_tires
TO authenticated;

