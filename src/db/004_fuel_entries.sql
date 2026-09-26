-- ==========================================
-- PH DRIVE — ETAPA 4A.1: ABASTECIMENTOS
-- ==========================================

-- 1. TABELA FUEL_ENTRIES
create table if not exists public.fuel_entries (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    vehicle_id uuid references public.vehicles(id) on delete cascade not null,
    filled_at timestamp with time zone default timezone('utc'::text, now()) not null,
    odometer_km numeric(12, 2) not null check (odometer_km >= 0),
    liters numeric(8, 3) not null check (liters > 0),
    total_amount numeric(10, 2) not null check (total_amount > 0),
    price_per_liter numeric(8, 3) not null check (price_per_liter > 0),
    fuel_type text not null,
    full_tank boolean not null default false,
    station_name text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. TRIGGER PARA UPDATED_AT
create trigger on_fuel_entries_updated
    before update on public.fuel_entries
    for each row execute procedure public.handle_updated_at();

-- 3. ÍNDICES DE PERFORMANCE
create index if not exists idx_fuel_entries_user_id_filled_at on public.fuel_entries(user_id, filled_at desc);
create index if not exists idx_fuel_entries_vehicle_id_filled_at on public.fuel_entries(vehicle_id, filled_at desc);
create index if not exists idx_fuel_entries_vehicle_id_odometer on public.fuel_entries(vehicle_id, odometer_km desc);

-- 4. ROW LEVEL SECURITY (RLS)
alter table public.fuel_entries enable row level security;

-- POLICIES
create policy "Users can view own fuel entries" 
    on public.fuel_entries for select 
    using (auth.uid() = user_id);

create policy "Users can insert own fuel entries" 
    on public.fuel_entries for insert 
    with check (auth.uid() = user_id and exists (
        select 1 from public.vehicles 
        where id = vehicle_id and user_id = auth.uid()
    ));

create policy "Users can update own fuel entries" 
    on public.fuel_entries for update 
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete own fuel entries" 
    on public.fuel_entries for delete 
    using (auth.uid() = user_id);

-- 5. TRIGGER PARA VALIDAR SE O VEÍCULO PERTENCE AO USUÁRIO AO INSERIR/ATUALIZAR
create or replace function public.validate_fuel_entry_vehicle_owner()
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

drop trigger if exists check_fuel_entry_vehicle_owner_trigger on public.fuel_entries;
create trigger check_fuel_entry_vehicle_owner_trigger
    before insert or update on public.fuel_entries
    for each row execute procedure public.validate_fuel_entry_vehicle_owner();

-- 6. TRIGGER PARA ATUALIZAR ODOMETRO DO VEÍCULO
create or replace function public.update_vehicle_odometer_on_fuel()
returns trigger as $$
begin
    if new.odometer_km > (select odometer_km from public.vehicles where id = new.vehicle_id) then
        update public.vehicles 
        set odometer_km = new.odometer_km,
            updated_at = timezone('utc'::text, now())
        where id = new.vehicle_id;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists update_vehicle_odometer_trigger on public.fuel_entries;
create trigger update_vehicle_odometer_trigger
    after insert or update on public.fuel_entries
    for each row execute procedure public.update_vehicle_odometer_on_fuel();
