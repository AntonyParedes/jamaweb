-- Apply after 202610100001. Existing profiles/products are reused.
begin;

do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'products' and policyname <> 'jama_products_public') then
    raise exception 'Review existing products policies before applying this migration';
  end if;
end $$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 120),
  zone text not null check (char_length(btrim(zone)) between 3 and 200),
  whatsapp text not null check (whatsapp ~ '^[1-9][0-9]{7,14}$'
    and (left(whatsapp, 2) <> '51' or whatsapp ~ '^519[0-9]{8}$')),
  created_at timestamptz not null default now()
);
alter table public.businesses enable row level security;
revoke all on public.businesses from anon, authenticated;
grant select, insert on public.businesses to authenticated;
grant update (name, zone, whatsapp) on public.businesses to authenticated;
create policy jama_businesses_own on public.businesses for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table public.products
  add column business_id uuid references public.businesses(id) on delete cascade,
  add column description text not null default '',
  add column category text not null default 'otros',
  add column original_price_cents integer,
  add column image_path text,
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add constraint jama_offer_identity check (business_id is null or
    id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  add constraint jama_product_category check (category in ('tortas', 'panaderia', 'postres', 'otros')),
  add constraint jama_offer_fields check (business_id is null or (
    char_length(btrim(name)) between 3 and 120
    and char_length(btrim(description)) between 3 and 2000
    and original_price_cents is not null and original_price_cents <= 100000000
    and price_cents > 0 and original_price_cents > price_cents
    and stock between 0 and 100000
    and image_path is not null and starts_at is not null and ends_at is not null
    and ends_at > starts_at
  ));
create index jama_products_business on public.products(business_id);
create index jama_products_active on public.products(ends_at, starts_at) where published and stock > 0;

drop policy jama_products_public on public.products;
create policy jama_products_public on public.products for select to anon, authenticated
  using (business_id is not null and published and stock > 0 and starts_at <= now() and ends_at > now());
create policy jama_products_owner_read on public.products for select to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy jama_products_owner_insert on public.products for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy jama_products_owner_update on public.products for update to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy jama_products_owner_delete on public.products for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert (id, business_id, name, description, category, original_price_cents, price_cents,
  stock, image_path, starts_at, ends_at, published) on public.products to authenticated;
grant update (name, description, category, original_price_cents, price_cents,
  stock, image_path, starts_at, ends_at, published) on public.products to authenticated;
grant delete on public.products to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-images', 'offer-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy jama_images_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'offer-images' and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
);
create policy jama_images_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'offer-images' and split_part(name, '/', 1) = (select auth.uid())::text
);
create policy jama_images_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'offer-images' and split_part(name, '/', 1) = (select auth.uid())::text
  and not exists (select 1 from public.products where image_path = storage.objects.name)
);
-- No UPDATE policy: uploads use new immutable object names, never overwrite photos.
-- Restrictive guards also protect this bucket if another app has permissive
-- Storage policies. Other buckets retain their existing behavior.
create policy jama_images_guard_insert on storage.objects as restrictive for insert to public with check (
  bucket_id <> 'offer-images' or (split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
create policy jama_images_guard_update on storage.objects as restrictive for update to public
  using (bucket_id <> 'offer-images') with check (bucket_id <> 'offer-images');
create policy jama_images_guard_delete on storage.objects as restrictive for delete to public using (
  bucket_id <> 'offer-images' or (split_part(name, '/', 1) = (select auth.uid())::text
    and not exists (select 1 from public.products where image_path = storage.objects.name))
);

create function public.jama_validate_offer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid; image_metadata jsonb;
begin
  if new.business_id is null then
    if auth.uid() is not null then raise exception 'Business required' using errcode = '42501'; end if;
    return new;
  end if;
  select owner_id into owner from public.businesses where id = new.business_id;
  if auth.uid() is not null and owner is distinct from auth.uid() then
    raise exception 'Owner required' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.business_id is distinct from old.business_id) then
    raise exception 'Offer identity cannot change';
  end if;
  if new.image_path is null or split_part(new.image_path, '/', 1) <> owner::text
    or split_part(new.image_path, '/', 2) <> new.id then raise exception 'Invalid image owner'; end if;
  select metadata into image_metadata from storage.objects
    where bucket_id = 'offer-images' and name = new.image_path;
  if not found or image_metadata ->> 'mimetype' not in ('image/jpeg', 'image/png', 'image/webp')
    or image_metadata ->> 'mimetype' is null
    or coalesce((image_metadata ->> 'size')::bigint, 0) not between 1 and 5242880 then
    raise exception 'Valid product image required';
  end if;
  if new.published and (tg_op = 'INSERT' or not old.published
    or new.ends_at is distinct from old.ends_at or new.starts_at is distinct from old.starts_at) then
    if new.ends_at <= now() or new.stock < 1 then raise exception 'Valid future offer required'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.jama_validate_offer() from public, anon, authenticated;
create trigger jama_validate_offer before insert or update on public.products
  for each row execute function public.jama_validate_offer();

-- Definer functions expose only explicit public projections, never private profiles.
create function public.jama_public_catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('serverNow', now(), 'items', coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'category', p.category,
    'priceCents', p.price_cents, 'originalPriceCents', p.original_price_cents,
    'stock', p.stock, 'imagePath', p.image_path, 'startsAt', p.starts_at, 'endsAt', p.ends_at,
    'store', b.name, 'zone', b.zone
  ) order by p.ends_at, p.id), '[]'::jsonb))
  from public.products p join public.businesses b on b.id = p.business_id
  where p.published and p.stock > 0 and p.starts_at <= now() and p.ends_at > now()
    and b.whatsapp ~ '^[1-9][0-9]{7,14}$';
$$;
revoke all on function public.jama_public_catalog() from public;
grant execute on function public.jama_public_catalog() to anon, authenticated;

create function public.jama_contact_offer(offer_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select jsonb_build_object('id', p.id, 'name', p.name, 'priceCents', p.price_cents,
    'whatsapp', b.whatsapp, 'endsAt', p.ends_at, 'serverNow', now()) into result
  from public.products p join public.businesses b on b.id = p.business_id
  where p.id = offer_id and p.published and p.stock > 0 and p.starts_at <= now() and p.ends_at > now()
    and b.whatsapp ~ '^[1-9][0-9]{7,14}$';
  if result is null then raise exception 'Offer unavailable'; end if;
  return result;
end $$;
revoke all on function public.jama_contact_offer(text) from public, anon;
grant execute on function public.jama_contact_offer(text) to authenticated;

-- Owners can see their expired offers through RLS; quotes must explicitly
-- enforce availability as well, even when the shopper is also the seller.
create or replace function public.jama_checkout_quote(requested_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare entry jsonb; product_row record; quantity integer; total bigint := 0;
  result_items jsonb := '[]'::jsonb; seen_ids text[] := array[]::text[];
  quote_expiry timestamptz := now() + interval '5 minutes';
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if requested_items is null or jsonb_typeof(requested_items) <> 'array' then raise exception 'Invalid cart'; end if;
  if jsonb_array_length(requested_items) not between 1 and 50 then raise exception 'Invalid cart'; end if;
  for entry in select value from jsonb_array_elements(requested_items) loop
    if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry -> 'productId') is distinct from 'string'
      or jsonb_typeof(entry -> 'qty') is distinct from 'number' then raise exception 'Invalid cart'; end if;
    if (entry ->> 'qty') !~ '^[1-9][0-9]{0,2}$' or char_length(entry ->> 'productId') not between 1 and 100
      or (entry ->> 'productId') = any(seen_ids)
      or exists (select 1 from jsonb_object_keys(entry) as k(key) where key not in ('productId', 'qty')) then
      raise exception 'Invalid cart'; end if;
    quantity := (entry ->> 'qty')::integer;
    if quantity > 100 then raise exception 'Invalid cart'; end if;
    seen_ids := array_append(seen_ids, entry ->> 'productId');
    select id, name, price_cents, stock, ends_at into product_row from public.products
      where id = entry ->> 'productId' and business_id is not null and published
        and stock > 0 and starts_at <= now() and ends_at > now();
    if not found or product_row.stock < quantity then raise exception 'Product unavailable'; end if;
    quote_expiry := least(quote_expiry, product_row.ends_at);
    total := total + product_row.price_cents::bigint * quantity;
    result_items := result_items || jsonb_build_array(jsonb_build_object(
      'productId', product_row.id, 'name', product_row.name, 'qty', quantity,
      'unitPriceCents', product_row.price_cents, 'subtotalCents', product_row.price_cents::bigint * quantity));
  end loop;
  return jsonb_build_object('items', result_items, 'totalCents', total, 'currency', 'PEN',
    'expiresAt', to_char(quote_expiry at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

commit;
