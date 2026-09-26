-- ==========================================
-- PH DRIVE — ETAPA 1: MOTOR DE VIAGENS E MIGRATION
-- ==========================================

-- 1. TABELA TRIPS
create table if not exists public.trips (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    vehicle_id uuid references public.vehicles(id) on delete cascade not null,
    status text not null check (status in ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')) default 'IN_PROGRESS',
    started_at timestamp with time zone default timezone('utc'::text, now()) not null,
    ended_at timestamp with time zone,
    start_odometer_km numeric(12, 2) check (start_odometer_km is null or start_odometer_km >= 0),
    end_odometer_km numeric(12, 2) check (end_odometer_km is null or end_odometer_km >= 0),
    distance_km numeric(12, 2) check (distance_km is null or distance_km >= 0),
    duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
    origin_label text,
    destination_label text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. ÍNDICE ÚNICO PARCIAL: Apenas uma viagem IN_PROGRESS por veículo
create unique index if not exists trips_one_in_progress_per_vehicle 
    on public.trips (vehicle_id) 
    where (status = 'IN_PROGRESS');

-- 3. ÍNDICES DE PERFORMANCE
create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_trips_vehicle_id on public.trips(vehicle_id);
create index if not exists idx_trips_started_at on public.trips(started_at desc);
create index if not exists idx_trips_status on public.trips(status);

-- 4. TRIGGER PARA VALIDAR SE O VEÍCULO PERTENCE AO USUÁRIO
create or replace function public.validate_trip_vehicle_owner()
returns trigger as $$
begin
    if not exists (
        select 1 from public.vehicles 
        where id = new.vehicle_id and user_id = new.user_id
    ) then
        raise exception 'O veículo informado não pertence ao usuário autenticado.';
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists check_trip_vehicle_owner_trigger on public.trips;
create trigger check_trip_vehicle_owner_trigger
    before insert or update on public.trips
    for each row execute procedure public.validate_trip_vehicle_owner();

-- 5. TRIGGER PARA UPDATED_AT
drop trigger if exists on_trips_updated on public.trips;
create trigger on_trips_updated
    before update on public.trips
    for each row execute procedure public.handle_updated_at();

-- 6. ROW LEVEL SECURITY (RLS)
alter table public.trips enable row level security;

drop policy if exists "Users can view own trips" on public.trips;
create policy "Users can view own trips" 
    on public.trips for select 
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own trips" on public.trips;
create policy "Users can insert own trips" 
    on public.trips for insert 
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips" 
    on public.trips for update 
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
