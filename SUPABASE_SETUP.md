# Supabase Setup Guide

## Database Tables

Your Supabase project has been configured with the following tables. Run these SQL commands in your Supabase SQL Editor to set up your database.

### 1. Complete Migration (Run This)

Copy and paste the entire content from `supabase/migrations/20260311000000_initialize_cable_crm.sql` into your Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

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

create table if not exists public."paymentCorrections" (
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

create table if not exists public."paymentMethods" (
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'areas', 'packages', 'payments', 'paymentCorrections', 'dealer_recoveries', 'paymentMethods', 'advertisements']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

alter table public.users enable row level security;
alter table public.areas enable row level security;
alter table public.packages enable row level security;
alter table public.payments enable row level security;
alter table public."paymentCorrections" enable row level security;
alter table public.dealer_recoveries enable row level security;
alter table public."paymentMethods" enable row level security;
alter table public.advertisements enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'areas', 'packages', 'payments', 'paymentCorrections', 'dealer_recoveries', 'paymentMethods', 'advertisements']
  loop
    execute format('create policy "authenticated access" on public.%I for all to authenticated using (true) with check (true)', table_name);
  end loop;
end;
$$;

alter publication supabase_realtime add table public.users, public.areas, public.packages, public.payments, public."paymentCorrections", public.dealer_recoveries, public."paymentMethods", public.advertisements;
```

## Setup Instructions

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Paste the SQL above
5. Click **Run**
6. You should see messages like "CREATE TABLE" for each table

## Table Structure

Each table stores data in a JSONB format:

### users
Stores user information (admins, dealers, customers)
```json
{
  "id": "user-uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin|dealer|customer",
  "status": "active|disabled",
  "phone": "+92300...",
  "cnic": "xxxxx-xxxxxxx-x",
  "address": "...",
  "photoURL": "...",
  "createdAt": 1234567890,
  ...
}
```

### areas
Stores service areas
```json
{
  "id": "area-uuid",
  "name": "Area Name",
  "code": "A1",
  "dealerIds": ["dealer-uuid"],
  "status": "active|disabled",
  "createdAt": 1234567890,
  "latitude": 24.8607,
  "longitude": 67.0011
}
```

### packages
Stores service packages
```json
{
  "id": "pkg-uuid",
  "name": "Basic Package",
  "speed": "10 Mbps",
  "monthlyPrice": 1500,
  "installationCharges": 500,
  "status": "active|disabled",
  "createdAt": 1234567890
}
```

### payments
Stores payment records
```json
{
  "id": "payment-uuid",
  "customerId": "customer-uuid",
  "amount": 1500,
  "method": "cash|bank|jazzcash|easypaisa",
  "date": 1234567890,
  "receivedByUid": "user-uuid",
  "status": "active|reversed",
  ...
}
```

### paymentCorrections
Stores payment reversals and reassignments

### dealer_recoveries
Stores dealer recovery amounts

### paymentMethods
Stores available payment methods

### advertisements
Stores advertisement data

## Authentication Setup

1. Go to **Authentication** > **Providers**
2. Enable **Email** provider
3. Configure SMTP settings for password reset emails
4. Go to **URL Configuration**
5. Add your application URL (e.g., `http://localhost:5173` for dev, your domain for production)

## Security Policies

All tables have RLS (Row Level Security) enabled with authenticated access. You may want to customize these policies based on your needs:

```sql
-- Example: Allow users to see only their own data
create policy "Users can see own data" on public.users
  for select
  using (auth.uid() = id);
```

## Environment Variables (Already Set)

Your `.env` and `.env.local` files contain:
```
NEXT_PUBLIC_SUPABASE_URL=https://xvjsobbhtwcyelzzibym.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_B9gLfzj_XY31ceEMlFnsdw_0cRS5jmx
```

## Ready to Use!

Your application is now fully configured with Supabase. All database operations go through the Supabase client.
