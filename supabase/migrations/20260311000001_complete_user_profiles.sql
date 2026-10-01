create table if not exists public.users (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.users
set data = data || jsonb_build_object(
  'uid', id,
  'name', coalesce(nullif(data->>'name', ''), split_part(coalesce(data->>'email', id), '@', 1), 'User'),
  'username', coalesce(data->>'username', ''),
  'email', coalesce(data->>'email', ''),
  'phone', case
    when id = '8f27b6ef-9925-41a6-9fef-0901eb27de95' and data->>'phone' = '+92' then '+92 309 8118113'
    else coalesce(data->>'phone', '')
  end,
  'cnic', coalesce(data->>'cnic', ''),
  'address', coalesce(data->>'address', ''),
  'role', coalesce(nullif(data->>'role', ''), 'customer'),
  'status', coalesce(nullif(data->>'status', ''), 'active'),
  'photoURL', coalesce(data->>'photoURL', ''),
  'createdAt', coalesce(
    nullif(data->>'createdAt', '')::bigint,
    floor(extract(epoch from created_at) * 1000)::bigint
  ),
  'updatedAt', floor(extract(epoch from now()) * 1000)::bigint
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

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();
