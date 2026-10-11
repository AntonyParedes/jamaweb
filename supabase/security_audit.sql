-- Read-only inventory for Supabase SQL Editor. Run after migrations 001, 002, 003.
-- Does not return user records, contacts, object names or credential values.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_table_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_table_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_table_update
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and ((n.nspname = 'public' and c.relname in
  ('profiles', 'businesses', 'products', 'jama_categories', 'jama_admins'))
  or (n.nspname = 'storage' and c.relname = 'objects'))
order by n.nspname, c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in
  ('profiles', 'businesses', 'products', 'jama_categories', 'jama_admins'))
  or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in
  ('profiles', 'businesses', 'products', 'jama_categories', 'jama_admins')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, column_name, privilege_type;

select p.proname as function_name, p.prosecdef as security_definer, p.proconfig as settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'jama_%'
order by p.proname;
