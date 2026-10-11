-- Apply once after 003. Enable direct publication without changing offer intent.
-- Preserve administrator suspensions/rejections, drafts, paused offers and all data.
begin;

alter table public.businesses alter column status set default 'approved';

create or replace function public.jama_validate_business() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.category is distinct from old.category or new.status = 'approved')
    and not exists (select 1 from public.jama_categories where id = new.category and active and business_enabled) then
    raise exception 'Valid business category required';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'approved' and auth.uid() is not null and not public.jama_is_admin() then
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
    -- Editing ordinary business fields keeps publication enabled and cannot
    -- lift an administrator suspension or rejection.
  end if;
  return new;
end $$;

-- Resolve the previous approval queue. Only compatible, active categories qualify.
-- A rejection remains blocked, as does an incompatible/inactive category.
update public.businesses b
set status = 'approved', review_note = '', reviewed_at = null, reviewed_by = null
where b.status = 'pending' and exists (
  select 1 from public.jama_categories c
  where c.id = b.category and c.active and c.business_enabled
);

-- Keep all existing RLS, column grants, private contacts and offer validations.
-- published=false is an intentional draft/pause; never publish those in bulk.
commit;
