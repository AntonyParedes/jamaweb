-- Designed for the new JAMA Supabase project. Inspect any existing schema first.
-- Abort incompatible schemas rather than renaming/duplicating existing tables.
begin;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public'
    and tablename in ('profiles', 'products')
    and policyname not in ('jama_profiles_select_own', 'jama_profiles_update_own', 'jama_products_public')) then
    raise exception 'Existing policies require review before adding JAMA policies.';
  end if;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 3 and 120),
  phone text check (phone is null or phone ~ '^9[0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0 and price_cents <= 100000000),
  stock integer not null default 0 check (stock >= 0),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

-- An existing schema with different fields must be adapted before proceeding.
do $$
begin
  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'id') is distinct from 'uuid'
    or (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'id') is distinct from 'text'
    or (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'price_cents') is distinct from 'integer'
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name') then
    raise exception 'Existing schema is incompatible; inspect and adapt it before applying this migration.';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke all on public.products from anon, authenticated;
grant select (id, name, price_cents, stock) on public.products to anon, authenticated;

create policy jama_profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy jama_profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy jama_products_public on public.products
  for select to anon, authenticated using (published);

create or replace function public.jama_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  display_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120);
begin
  if char_length(display_name) < 3 then display_name := 'Usuario JAMA'; end if;
  insert into public.profiles (id, full_name) values (new.id, display_name)
    on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.jama_create_profile() from public, anon, authenticated;
create trigger on_jama_user_created after insert on auth.users
  for each row execute function public.jama_create_profile();

insert into public.profiles (id, full_name)
select id, case when char_length(btrim(coalesce(raw_user_meta_data ->> 'full_name', ''))) >= 3
  then left(btrim(raw_user_meta_data ->> 'full_name'), 120) else 'Usuario JAMA' end
from auth.users on conflict (id) do nothing;

-- Only IDs and quantities enter the quote. Prices/stock come from PostgreSQL.
-- SECURITY INVOKER preserves RLS; a revoked/expired token has no auth.uid().
create or replace function public.jama_checkout_quote(requested_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  entry jsonb;
  product_row record;
  quantity integer;
  total bigint := 0;
  result_items jsonb := '[]'::jsonb;
  seen_ids text[] := array[]::text[];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if requested_items is null or jsonb_typeof(requested_items) <> 'array' then
    raise exception 'Invalid cart';
  end if;
  if jsonb_array_length(requested_items) not between 1 and 50 then raise exception 'Invalid cart'; end if;
  for entry in select value from jsonb_array_elements(requested_items) loop
    if jsonb_typeof(entry) <> 'object'
      or jsonb_typeof(entry -> 'productId') is distinct from 'string'
      or jsonb_typeof(entry -> 'qty') is distinct from 'number' then raise exception 'Invalid cart'; end if;
    if (entry ->> 'qty') !~ '^[1-9][0-9]{0,2}$'
      or char_length(entry ->> 'productId') not between 1 and 100
      or (entry ->> 'productId') = any(seen_ids)
      or exists (select 1 from jsonb_object_keys(entry) as k(key) where key not in ('productId', 'qty')) then
      raise exception 'Invalid cart';
    end if;
    quantity := (entry ->> 'qty')::integer;
    if quantity > 100 then raise exception 'Invalid cart'; end if;
    seen_ids := array_append(seen_ids, entry ->> 'productId');
    select id, name, price_cents, stock into product_row from public.products
      where id = entry ->> 'productId';
    if not found or product_row.stock < quantity then raise exception 'Product unavailable'; end if;
    total := total + product_row.price_cents::bigint * quantity;
    result_items := result_items || jsonb_build_array(jsonb_build_object(
      'productId', product_row.id, 'name', product_row.name, 'qty', quantity,
      'unitPriceCents', product_row.price_cents,
      'subtotalCents', product_row.price_cents::bigint * quantity
    ));
  end loop;
  return jsonb_build_object('items', result_items, 'totalCents', total, 'currency', 'PEN',
    'expiresAt', to_char((now() + interval '5 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end;
$$;
revoke all on function public.jama_checkout_quote(jsonb) from public, anon;
grant execute on function public.jama_checkout_quote(jsonb) to authenticated;

commit;
