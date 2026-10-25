-- Saplaya schema. Run in the Supabase SQL editor.
-- Customers see ONE storefront. Suppliers are internal: they only appear in
-- supplier_id columns and are never returned by the customer-facing views.

create extension if not exists "pgcrypto";

-- ---------- Core tables ----------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  admin_user_id uuid references auth.users(id),   -- the farm's admin-panel login
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  name text not null,
  category text,
  unit text not null default 'kg',
  retail_price integer not null,                  -- TZS per unit
  wholesale_price integer not null,               -- TZS per unit, bulk
  wholesale_min_qty integer not null default 10,
  stock numeric not null default 0,
  low_stock_at numeric not null default 10,
  image_url text,
  harvested_at timestamptz default now(),
  active boolean default true,
  created_at timestamptz default now()
);

create table promos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  kind text check (kind in ('farm_box','cooking_kit')),
  image_url text not null,
  sort_order int default 0,
  active boolean default true
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id),
  mode text not null check (mode in ('retail','wholesale')),
  status text not null default 'pending'
    check (status in ('pending','packing','en_route','delivered','cancelled')),
  subtotal integer not null,
  delivery_fee integer not null default 0,
  distance_km numeric,
  dest_lat double precision,
  dest_lng double precision,
  created_at timestamptz default now()
);

-- One row per supplier per order: what the farm admin panel works on.
create table supplier_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  status text not null default 'pending'
    check (status in ('pending','packing','en_route','delivered','cancelled')),
  updated_at timestamptz default now(),
  unique (order_id, supplier_id)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  supplier_order_id uuid not null references supplier_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  supplier_id uuid not null references suppliers(id),
  qty numeric not null check (qty > 0),
  unit_price integer not null
);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  product_id uuid not null references products(id),
  order_id uuid references orders(id),
  kind text not null check (kind in ('sale','restock','adjustment','cancel_return')),
  qty_change numeric not null,                    -- negative = stock out
  stock_after numeric not null,
  created_at timestamptz default now()
);
create index on inventory_movements (supplier_id, created_at desc);

-- ---------- Place an order atomically (called by the Node backend) ----------
create or replace function place_order(
  p_customer uuid, p_mode text, p_items jsonb,
  p_fee integer, p_distance numeric, p_lat double precision, p_lng double precision
) returns uuid language plpgsql security definer as $$
declare
  v_order uuid; v_item jsonb; v_prod products%rowtype;
  v_so uuid; v_price integer; v_subtotal integer := 0; v_qty numeric;
begin
  insert into orders (customer_id, mode, subtotal, delivery_fee, distance_km, dest_lat, dest_lng)
  values (p_customer, p_mode, 0, p_fee, p_distance, p_lat, p_lng)
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (v_item->>'product_id')::uuid for update;
    v_qty := (v_item->>'qty')::numeric;
    if not found or v_prod.stock < v_qty then
      raise exception 'Not enough stock for %', coalesce(v_prod.name, 'item');
    end if;
    if p_mode = 'wholesale' and v_qty < v_prod.wholesale_min_qty then
      raise exception 'Wholesale minimum for % is %', v_prod.name, v_prod.wholesale_min_qty;
    end if;

    v_price := case when p_mode = 'wholesale' then v_prod.wholesale_price else v_prod.retail_price end;
    v_subtotal := v_subtotal + round(v_price * v_qty);

    insert into supplier_orders (order_id, supplier_id)
    values (v_order, v_prod.supplier_id)
    on conflict (order_id, supplier_id) do update set updated_at = now()
    returning id into v_so;

    insert into order_items (order_id, supplier_order_id, product_id, supplier_id, qty, unit_price)
    values (v_order, v_so, v_prod.id, v_prod.supplier_id, v_qty, v_price);

    update products set stock = stock - v_qty where id = v_prod.id;
    insert into inventory_movements (supplier_id, product_id, order_id, kind, qty_change, stock_after)
    values (v_prod.supplier_id, v_prod.id, v_order, 'sale', -v_qty, v_prod.stock - v_qty);
  end loop;

  update orders set subtotal = v_subtotal where id = v_order;
  return v_order;
end $$;

-- ---------- Keep the customer-facing order status in sync ----------
-- The customer sees the LEAST advanced supplier status (all must be ready to move on).
create or replace function sync_order_status() returns trigger language plpgsql as $$
declare v_rank int; v_new text;
begin
  select min(case status when 'cancelled' then 99 when 'pending' then 1 when 'packing' then 2
                         when 'en_route' then 3 when 'delivered' then 4 end)
    into v_rank from supplier_orders where order_id = new.order_id and status <> 'cancelled';
  v_new := case v_rank when 1 then 'pending' when 2 then 'packing' when 3 then 'en_route'
                       when 4 then 'delivered' else 'cancelled' end;
  update orders set status = v_new where id = new.order_id and status <> v_new;
  return new;
end $$;

create trigger trg_sync_order_status
after insert or update of status on supplier_orders
for each row execute function sync_order_status();

-- Return stock when a supplier cancels
create or replace function return_stock_on_cancel() returns trigger language plpgsql as $$
declare r record;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    for r in select * from order_items where supplier_order_id = new.id loop
      update products set stock = stock + r.qty where id = r.product_id;
      insert into inventory_movements (supplier_id, product_id, order_id, kind, qty_change, stock_after)
      select r.supplier_id, r.product_id, new.order_id, 'cancel_return', r.qty, stock
      from products where id = r.product_id;
    end loop;
  end if;
  return new;
end $$;

create trigger trg_return_stock
after update of status on supplier_orders
for each row execute function return_stock_on_cancel();

-- ---------- Customer-safe view: NO supplier_id ----------
create view storefront_products as
  select id, name, category, unit, retail_price, wholesale_price,
         wholesale_min_qty, stock, image_url, harvested_at
  from products where active and stock > 0;

-- ---------- Row Level Security ----------
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

alter table suppliers enable row level security;
alter table products enable row level security;
alter table promos enable row level security;
alter table orders enable row level security;
alter table supplier_orders enable row level security;
alter table order_items enable row level security;
alter table inventory_movements enable row level security;

create policy "promos readable" on promos for select using (active);

-- Customers can read only their own orders (and the order's status rows).
create policy "own orders" on orders for select using (customer_id = auth.uid());
create policy "own supplier_orders status" on supplier_orders for select
  using (exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Suppliers see only their own rows (admin panel).
create policy "supplier own products" on products for all
  using (supplier_id in (select id from suppliers where admin_user_id = (select public.current_supabase_auth_user_id())))
  with check (supplier_id in (select id from suppliers where admin_user_id = (select public.current_supabase_auth_user_id())));
create policy "supplier own orders" on supplier_orders for all
  using (supplier_id in (select id from suppliers where admin_user_id = (select public.current_supabase_auth_user_id())))
  with check (supplier_id in (select id from suppliers where admin_user_id = (select public.current_supabase_auth_user_id())));
create policy "supplier own items" on order_items for select
  using (supplier_id in (select id from suppliers where admin_user_id = (select public.current_supabase_auth_user_id())));
create policy "supplier own movements" on inventory_movements for select
  using (supplier_id in (select id from suppliers where admin_user_id = (select public.current_supabase_auth_user_id())));

grant select on storefront_products to anon, authenticated;

-- ---------- Realtime for the tracking screen ----------
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table supplier_orders;
