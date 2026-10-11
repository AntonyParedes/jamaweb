-- Apply after 202610100002. Preserve all businesses, offers and photos.
-- Existing businesses require review too; no account becomes an administrator automatically.
begin;

create table public.jama_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.jama_admins enable row level security;
revoke all on public.jama_admins from public, anon, authenticated;

create function public.jama_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.jama_admins where user_id = auth.uid()
  );
$$;
revoke all on function public.jama_is_admin() from public, anon;
grant execute on function public.jama_is_admin() to authenticated;

-- One configurable taxonomy shared by business registration, offers and filters.
create table public.jama_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,49}$'),
  label text not null check (char_length(btrim(label)) between 2 and 80),
  emoji text not null default '🏷️' check (char_length(emoji) between 1 and 16),
  business_enabled boolean not null default true,
  offer_enabled boolean not null default true,
  active boolean not null default true,
  name_label text not null default 'Nombre del producto' check (char_length(btrim(name_label)) between 3 and 80),
  description_hint text not null default '' check (char_length(description_hint) <= 400),
  position integer not null default 100 check (position between 0 and 10000)
);
insert into public.jama_categories (id, label, emoji, business_enabled, name_label, description_hint, position) values
  ('tortas', 'Tortas', '🍰', false, 'Nombre del producto', 'Indica la porción o tamaño, ingredientes y alérgenos.', 10),
  ('panaderia', 'Panadería', '🥐', true, 'Nombre del producto', 'Indica las unidades, elaboración e ingredientes o alérgenos.', 20),
  ('postres', 'Postres', '🧁', false, 'Nombre del producto', 'Indica la porción y si requiere refrigeración, además de los alérgenos.', 30),
  ('cafeteria', 'Cafeterías', '☕', true, 'Nombre del producto o combo', 'Describe los productos incluidos, tamaños e ingredientes o alérgenos.', 40),
  ('restaurantes', 'Restaurantes', '🍽️', true, 'Nombre del plato o combo', 'Indica la porción, acompañamientos, ingredientes y conservación.', 50),
  ('alimentos', 'Tiendas de alimentos', '🥗', true, 'Nombre del producto', 'Indica cantidad o peso, conservación y fecha de consumo cuando corresponda.', 60),
  ('otros', 'Otros comercios compatibles', '🏷️', true, 'Nombre del producto', 'Describe qué incluye la oferta de cierre, su cantidad y condiciones.', 100);
alter table public.jama_categories enable row level security;
revoke all on public.jama_categories from public, anon, authenticated;
grant select on public.jama_categories to anon, authenticated;
grant insert, update on public.jama_categories to authenticated;
create policy jama_categories_public on public.jama_categories for select to anon, authenticated using (active);
create policy jama_categories_admin on public.jama_categories for all to authenticated
  using ((select public.jama_is_admin())) with check ((select public.jama_is_admin()));

alter table public.businesses
  add column category text not null default 'otros' references public.jama_categories(id),
  add column status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  add column review_note text not null default '' check (char_length(review_note) <= 1000),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete set null;
create index jama_businesses_review on public.businesses(status, created_at);
-- Revoke table-level INSERT: the owner cannot insert approval fields.
revoke insert on public.businesses from authenticated;
grant insert (id, owner_id, name, zone, whatsapp, category) on public.businesses to authenticated;
grant update (category) on public.businesses to authenticated;
create policy jama_businesses_admin_read on public.businesses for select to authenticated
  using ((select public.jama_is_admin()));

create function public.jama_validate_business() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.category is distinct from old.category or new.status = 'approved')
    and not exists (select 1 from public.jama_categories where id = new.category and active and business_enabled) then
    raise exception 'Valid business category required';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' and auth.uid() is not null and not public.jama_is_admin() then
      raise exception 'Administrator required' using errcode = '42501';
    end if;
  else
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
      raise exception 'Business identity cannot change';
    end if;
    if (new.status, new.review_note, new.reviewed_at, new.reviewed_by) is distinct from
      (old.status, old.review_note, old.reviewed_at, old.reviewed_by)
      and auth.uid() is not null and not public.jama_is_admin() then
      raise exception 'Administrator required' using errcode = '42501';
    end if;
    -- Material changes resubmit the request, preventing post-approval substitution.
    if (new.name, new.zone, new.whatsapp, new.category) is distinct from
      (old.name, old.zone, old.whatsapp, old.category) then
      new.status := 'pending'; new.review_note := ''; new.reviewed_at := null; new.reviewed_by := null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.jama_validate_business() from public, anon, authenticated;
create trigger jama_validate_business before insert or update on public.businesses
  for each row execute function public.jama_validate_business();

-- Safe boolean projection: no private business/contact data exposed to visitors.
create function public.jama_business_is_approved(business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.businesses b join public.jama_categories c on c.id = b.category
    where b.id = business and b.status = 'approved' and c.active and c.business_enabled);
$$;
revoke all on function public.jama_business_is_approved(uuid) from public;
grant execute on function public.jama_business_is_approved(uuid) to anon, authenticated;

create function public.jama_review_business(target_business uuid, decision text, note text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.jama_is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if decision not in ('approved', 'rejected', 'pending') or decision is null
    or note is null or char_length(note) > 1000 then raise exception 'Invalid review'; end if;
  update public.businesses set status = decision, review_note = btrim(note), reviewed_at = now(), reviewed_by = auth.uid()
    where id = target_business;
  if not found then raise exception 'Business not found'; end if;
end $$;
revoke all on function public.jama_review_business(uuid, text, text) from public, anon;
grant execute on function public.jama_review_business(uuid, text, text) to authenticated;

alter table public.products drop constraint jama_product_category;
alter table public.products add constraint jama_product_category_fk foreign key (category) references public.jama_categories(id);

create function public.jama_validate_offer_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.business_id is null then return new; end if;
  if not exists (select 1 from public.jama_categories where id = new.category and active and offer_enabled) then
    raise exception 'Valid offer category required';
  end if;
  if new.published and not public.jama_business_is_approved(new.business_id) then
    raise exception 'Approved business required' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.jama_validate_offer_approval() from public, anon, authenticated;
create trigger jama_validate_offer_approval before insert or update on public.products
  for each row execute function public.jama_validate_offer_approval();

drop policy jama_products_public on public.products;
create policy jama_products_public on public.products for select to anon, authenticated using (
  published and stock > 0 and starts_at <= now() and ends_at > now()
  and public.jama_business_is_approved(business_id)
  and exists (select 1 from public.jama_categories c where c.id = category and c.active and c.offer_enabled)
);
-- Owners keep access to their own drafts/history; extra permissive SELECT policies
-- cannot reveal ineligible offers owned by others.
-- The guard's owner lookup must not require anonymous SELECT on private businesses.
-- Use a narrowly projected definer instead of granting that table to anon.
create function public.jama_owns_business(business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.businesses where id = business and owner_id = auth.uid());
$$;
revoke all on function public.jama_owns_business(uuid) from public;
grant execute on function public.jama_owns_business(uuid) to anon, authenticated;
create policy jama_products_visibility_guard on public.products as restrictive for select to anon, authenticated using (
  (published and stock > 0 and starts_at <= now() and ends_at > now()
    and public.jama_business_is_approved(business_id)
    and exists (select 1 from public.jama_categories c where c.id = category and c.active and c.offer_enabled))
  or public.jama_owns_business(business_id)
);

create or replace function public.jama_public_catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('serverNow', now(), 'items', coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'category', p.category,
    'priceCents', p.price_cents, 'originalPriceCents', p.original_price_cents,
    'stock', p.stock, 'imagePath', p.image_path, 'startsAt', p.starts_at, 'endsAt', p.ends_at,
    'store', b.name, 'zone', b.zone
  ) order by (p.original_price_cents - p.price_cents)::numeric / p.original_price_cents desc,
      p.ends_at asc, p.id asc), '[]'::jsonb))
  from public.products p join public.businesses b on b.id = p.business_id
    join public.jama_categories c on c.id = p.category
  where p.published and p.stock > 0 and p.starts_at <= now() and p.ends_at > now()
    and p.ends_at > p.starts_at and p.price_cents > 0 and p.original_price_cents > p.price_cents
    and c.active and c.offer_enabled and public.jama_business_is_approved(b.id)
    and b.whatsapp ~ '^[1-9][0-9]{7,14}$';
$$;

create or replace function public.jama_contact_offer(offer_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select jsonb_build_object('id', p.id, 'name', p.name, 'priceCents', p.price_cents,
    'whatsapp', b.whatsapp, 'endsAt', p.ends_at, 'serverNow', now()) into result
  from public.products p join public.businesses b on b.id = p.business_id
    join public.jama_categories c on c.id = p.category
  where p.id = offer_id and p.published and p.stock > 0 and p.starts_at <= now() and p.ends_at > now()
    and c.active and c.offer_enabled and public.jama_business_is_approved(b.id)
    and b.whatsapp ~ '^[1-9][0-9]{7,14}$';
  if result is null then raise exception 'Offer unavailable'; end if;
  return result;
end $$;

-- Preserve the existing authenticated, server-priced quote and include approval.
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
    select p.id, p.name, p.price_cents, p.stock, p.ends_at into product_row from public.products p
      join public.jama_categories c on c.id = p.category
      where p.id = entry ->> 'productId' and p.published and p.stock > 0
        and p.starts_at <= now() and p.ends_at > now()
        and public.jama_business_is_approved(p.business_id) and c.active and c.offer_enabled;
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
