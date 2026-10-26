-- Enable required extensions
create extension if not exists pgcrypto;

-- Create tables
create table if not exists public.users (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.areas (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_corrections (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealer_recoveries (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advertisements (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create updated_at trigger function
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for each table
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger set_areas_updated_at before update on public.areas for each row execute function public.set_updated_at();
create trigger set_packages_updated_at before update on public.packages for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger set_payment_corrections_updated_at before update on public.payment_corrections for each row execute function public.set_updated_at();
create trigger set_dealer_recoveries_updated_at before update on public.dealer_recoveries for each row execute function public.set_updated_at();
create trigger set_payment_methods_updated_at before update on public.payment_methods for each row execute function public.set_updated_at();
create trigger set_advertisements_updated_at before update on public.advertisements for each row execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.areas enable row level security;
alter table public.packages enable row level security;
alter table public.payments enable row level security;
alter table public.payment_corrections enable row level security;
alter table public.dealer_recoveries enable row level security;
alter table public.payment_methods enable row level security;
alter table public.advertisements enable row level security;

-- Create RLS policies for authenticated users
create policy "authenticated access" on public.users for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.areas for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.packages for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.payments for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.payment_corrections for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.dealer_recoveries for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.payment_methods for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.advertisements for all to authenticated using (true) with check (true);

-- Enable Realtime for tables
alter publication supabase_realtime add table public.users, public.areas, public.packages, public.payments, public.payment_corrections, public.dealer_recoveries, public.payment_methods, public.advertisements;
