-- Saplaya migration 002: supplier entry, team roles and restrictions.
-- Run AFTER schema.sql in the Supabase SQL editor.

-- ---------- Supplier profile + lifecycle ----------
alter table suppliers
  add column if not exists status text not null default 'active'
    check (status in ('pending','active','suspended')),
  add column if not exists region text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists commission_pct numeric not null default 8;

-- ---------- Team members and roles ----------
-- platform_owner    Saplaya owner: everything
-- platform_manager  Operations: approves farms, watches all orders, cannot change settings
-- supplier_owner    Farm owner: own farm's products, prices, stock, orders and team
-- supplier_staff    Farm packer: own farm's orders and stock, cannot change prices or team
-- driver            Delivery: sees orders on the road, can only mark en_route / delivered
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,  -- null until the invite is accepted
  supplier_id uuid references suppliers(id) on delete cascade,        -- null for platform roles
  full_name text not null,
  email text not null unique,
  role text not null check (role in
    ('platform_owner','platform_manager','supplier_owner','supplier_staff','driver')),
  status text not null default 'invited' check (status in ('invited','active','suspended')),
  created_at timestamptz default now(),
  -- supplier roles MUST belong to a farm, platform roles must NOT
  constraint role_scope check (
    (role in ('supplier_owner','supplier_staff') and supplier_id is not null)
    or (role in ('platform_owner','platform_manager','driver') and supplier_id is null)
  )
);

-- ---------- Supplier applications (the "Become a supplier" form on the landing page) ----------
create table if not exists supplier_applications (
  id uuid primary key default gen_random_uuid(),
  farm_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  customer_id uuid references auth.users(id) on delete cascade,
  location text,
  products text,
  region text,
  produce text,                     -- e.g. "tomatoes, onions, spinach"
  farm_size text,
  status text not null default 'new' check (status in ('new','approved','rejected')),
  created_at timestamptz default now()
);

-- mobile_account_payments.sql may have created this table first: make it accept both the
-- landing-page form (no signed-in user) and the in-app form.
alter table supplier_applications
  add column if not exists region text,
  add column if not exists produce text,
  add column if not exists farm_size text;
alter table supplier_applications
  alter column customer_id drop not null,
  alter column phone drop not null,
  alter column location drop not null,
  alter column products drop not null,
  alter column status set default 'new';
alter table supplier_applications drop constraint if exists supplier_applications_status_check;
alter table supplier_applications add constraint supplier_applications_status_check
  check (status in ('new','pending','reviewing','approved','declined','rejected'));

-- ---------- Helper used by row level security ----------
create or replace function my_supplier_ids() returns setof uuid
language sql stable security definer
set search_path = pg_catalog, public as $$
  select supplier_id from team_members
  where user_id = (select public.current_supabase_auth_user_id())
    and status = 'active' and supplier_id is not null
$$;
revoke all on function my_supplier_ids() from public, anon;
grant execute on function my_supplier_ids() to authenticated;

-- ---------- Replace the old single-admin policies ----------
drop policy if exists "supplier own products" on products;
drop policy if exists "supplier own orders" on supplier_orders;
drop policy if exists "supplier own items" on order_items;
drop policy if exists "supplier own movements" on inventory_movements;
alter table suppliers drop column if exists admin_user_id;

alter table team_members enable row level security;
alter table supplier_applications enable row level security;   -- no policies: backend only

create policy "see own team record" on team_members for select
  using (user_id = (select public.current_supabase_auth_user_id()));
create policy "farm sees own record" on suppliers for select using (id in (select my_supplier_ids()));

create policy "farm products" on products for select using (supplier_id in (select my_supplier_ids()));
create policy "farm orders" on supplier_orders for select using (supplier_id in (select my_supplier_ids()));
create policy "farm items" on order_items for select using (supplier_id in (select my_supplier_ids()));
create policy "farm movements" on inventory_movements for select using (supplier_id in (select my_supplier_ids()));
-- Writes (prices, stock, status, team) go through the Node backend, which checks the role first.

-- ---------- Paused farms disappear from the customer shop ----------
create or replace view storefront_products as
  select p.id, p.name, p.category, p.unit, p.retail_price, p.wholesale_price,
         p.wholesale_min_qty, p.stock, p.image_url, p.harvested_at
  from products p
  join suppliers s on s.id = p.supplier_id
  where p.active and p.stock > 0 and s.status = 'active';

-- ---------- Initial platform owner (replace the email, then invite from Supabase Auth) ----------
-- insert into team_members (full_name, email, role, status)
-- values ('Saplaya Owner', 'you@example.com', 'platform_owner', 'invited');
