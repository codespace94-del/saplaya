-- Keep supplier/team RLS scoped to UUID subjects issued by this Supabase Auth project.
-- Firebase UID subjects are never cast to UUIDs or treated as team identities.

create or replace function public.current_supabase_auth_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, auth
as $$
declare
  subject text := auth.jwt() ->> 'sub';
begin
  if (auth.jwt() ->> 'iss') is distinct from 'https://gycjliqtcstomzegfcbz.supabase.co/auth/v1'
    or subject is null
    or subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return null;
  end if;
  return subject::uuid;
end;
$$;

revoke all on function public.current_supabase_auth_user_id() from public, anon;
grant execute on function public.current_supabase_auth_user_id() to authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'suppliers' and column_name = 'admin_user_id'
  ) then
    drop policy if exists "supplier own products" on public.products;
    create policy "supplier own products" on public.products for all to authenticated
      using (
        supplier_id in (
          select id from public.suppliers
          where admin_user_id = (select public.current_supabase_auth_user_id())
        )
      )
      with check (
        supplier_id in (
          select id from public.suppliers
          where admin_user_id = (select public.current_supabase_auth_user_id())
        )
      );

    drop policy if exists "supplier own orders" on public.supplier_orders;
    create policy "supplier own orders" on public.supplier_orders for all to authenticated
      using (
        supplier_id in (
          select id from public.suppliers
          where admin_user_id = (select public.current_supabase_auth_user_id())
        )
      )
      with check (
        supplier_id in (
          select id from public.suppliers
          where admin_user_id = (select public.current_supabase_auth_user_id())
        )
      );

    drop policy if exists "supplier own items" on public.order_items;
    create policy "supplier own items" on public.order_items for select to authenticated
      using (
        supplier_id in (
          select id from public.suppliers
          where admin_user_id = (select public.current_supabase_auth_user_id())
        )
      );

    drop policy if exists "supplier own movements" on public.inventory_movements;
    create policy "supplier own movements" on public.inventory_movements for select to authenticated
      using (
        supplier_id in (
          select id from public.suppliers
          where admin_user_id = (select public.current_supabase_auth_user_id())
        )
      );
  end if;

  if to_regclass('public.team_members') is not null then
    execute $function$
      create or replace function public.my_supplier_ids()
      returns setof uuid
      language sql stable security definer
      set search_path = pg_catalog, public
      as $body$
        select supplier_id from public.team_members
        where user_id = (select public.current_supabase_auth_user_id())
          and status = 'active'
          and supplier_id is not null
      $body$
    $function$;
    revoke all on function public.my_supplier_ids() from public, anon;
    grant execute on function public.my_supplier_ids() to authenticated;

    drop policy if exists "see own team record" on public.team_members;
    create policy "see own team record" on public.team_members for select to authenticated
      using (user_id = (select public.current_supabase_auth_user_id()));
  end if;
end;
$$;
