-- ==========================================
-- PH DRIVE — ETAPA 2: PONTOS DE GPS E MAPA
-- ==========================================

-- 1. ADICIONAR gps_distance_km NA TABELA TRIPS
alter table public.trips 
    add column if not exists gps_distance_km numeric(12, 2) check (gps_distance_km is null or gps_distance_km >= 0);

-- 2. TABELA TRIP_POINTS
create table if not exists public.trip_points (
    id uuid default gen_random_uuid() primary key,
    trip_id uuid references public.trips(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    latitude numeric(10, 7) not null check (latitude >= -90 and latitude <= 90),
    longitude numeric(10, 7) not null check (longitude >= -180 and longitude <= 180),
    accuracy_meters numeric(10, 2) check (accuracy_meters is null or accuracy_meters >= 0),
    speed_kmh numeric(10, 2) check (speed_kmh is null or speed_kmh >= 0),
    heading_degrees numeric(10, 2) check (heading_degrees is null or (heading_degrees >= 0 and heading_degrees < 360)),
    altitude_meters numeric(10, 2),
    captured_at timestamp with time zone not null,
    sequence_number integer not null check (sequence_number >= 0),
    source text not null check (source in ('MANUAL', 'MOBILE_GPS', 'IMPORT')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. ÍNDICE ÚNICO PARA GARANTIR ORDEM E SEQÜÊNCIA ÚNICA POR VIAGEM
create unique index if not exists trip_points_trip_seq_idx 
    on public.trip_points (trip_id, sequence_number);

-- 4. ÍNDICES DE PERFORMANCE
create index if not exists idx_trip_points_trip_id_seq on public.trip_points(trip_id, sequence_number asc);
create index if not exists idx_trip_points_user_id on public.trip_points(user_id);
create index if not exists idx_trip_points_captured_at on public.trip_points(trip_id, captured_at desc);

-- 5. TRIGGER PARA VALIDAR SE A VIAGEM PERTENCE AO USUÁRIO
create or replace function public.validate_trip_point_owner()
returns trigger as $$
begin
    if not exists (
        select 1 from public.trips 
        where id = new.trip_id and user_id = new.user_id
    ) then
        raise exception 'A viagem informada não pertence ao usuário autenticado.';
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists check_trip_point_owner_trigger on public.trip_points;
create trigger check_trip_point_owner_trigger
    before insert or update on public.trip_points
    for each row execute procedure public.validate_trip_point_owner();

-- 6. ROW LEVEL SECURITY (RLS)
alter table public.trip_points enable row level security;

drop policy if exists "Users can view own trip points" on public.trip_points;
create policy "Users can view own trip points" 
    on public.trip_points for select 
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own trip points" on public.trip_points;
create policy "Users can insert own trip points" 
    on public.trip_points for insert 
    with check (auth.uid() = user_id);
