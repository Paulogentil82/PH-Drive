-- ==========================================
-- PH DRIVE — ETAPA 0: BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- ==========================================

-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- 2. TABELA PROFILES
create table if not exists public.profiles (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null unique,
    full_name text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. TABELA VEHICLES
create table if not exists public.vehicles (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    type text not null check (type in ('CAR', 'MOTORCYCLE')),
    brand text,
    model text,
    version text,
    year integer,
    license_plate text,
    fuel_type text,
    odometer_km numeric(12, 2) not null default 0 check (odometer_km >= 0),
    tank_capacity_liters numeric(6, 2),
    average_consumption_km_l(5, 2), -- Note: syntax fix in table definition below: average_consumption_km_l numeric(5,2)
    image_url text,
    bluetooth_name text,
    active boolean not null default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Correction for average_consumption_km_l column definition:
alter table public.vehicles drop column if exists average_consumption_km_l;
alter table public.vehicles add column average_consumption_km_l numeric(5, 2);

-- 4. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;

-- 5. POLICIES PARA PROFILES
create policy "Users can view own profile" 
    on public.profiles for select 
    using (auth.uid() = user_id);

create policy "Users can insert own profile" 
    on public.profiles for insert 
    with check (auth.uid() = user_id);

create policy "Users can update own profile" 
    on public.profiles for update 
    using (auth.uid() = user_id);

-- 6. POLICIES PARA VEHICLES (Isolamento total por usuário)
create policy "Users can view own vehicles" 
    on public.vehicles for select 
    using (auth.uid() = user_id);

create policy "Users can insert own vehicles" 
    on public.vehicles for insert 
    with check (auth.uid() = user_id);

create policy "Users can update own vehicles" 
    on public.vehicles for update 
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete own vehicles" 
    on public.vehicles for delete 
    using (auth.uid() = user_id);

-- 7. TRIGGER PARA UPDATED_AT EM PROFILES E VEHICLES
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger on_profiles_updated
    before update on public.profiles
    for each row execute procedure public.handle_updated_at();

create trigger on_vehicles_updated
    before update on public.vehicles
    for each row execute procedure public.handle_updated_at();

-- 8. TRIGGER PARA CRIAR PROFILE AUTOMATICAMENTE AO CADASTRAR USUÁRIO NO AUTH
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (user_id, full_name)
    values (new.id, new.raw_user_meta_data->>'full_name');
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
