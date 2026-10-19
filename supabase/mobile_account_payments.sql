-- Run after schema.sql to enable customer accounts, reviews, supplier applications,
-- secure Flutterwave checkout, and idempotent paid-order creation.

create table if not exists public.customer_profiles (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists customer_addresses_owner_idx
  on public.customer_addresses (customer_id, created_at desc);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_reviews_owner_idx
  on public.customer_reviews (customer_id, created_at desc);

create table if not exists public.supplier_applications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  farm_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  location text not null,
  products text not null,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'approved', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists supplier_applications_owner_idx
  on public.supplier_applications (customer_id, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.supplier_applications enable row level security;

drop policy if exists "customers manage own profile" on public.customer_profiles;
create policy "customers manage own profile" on public.customer_profiles
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

drop policy if exists "customers manage own addresses" on public.customer_addresses;
create policy "customers manage own addresses" on public.customer_addresses
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

drop policy if exists "customers manage own reviews" on public.customer_reviews;
create policy "customers manage own reviews" on public.customer_reviews
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

drop policy if exists "customers read own supplier applications" on public.supplier_applications;
create policy "customers read own supplier applications" on public.supplier_applications
  for select to authenticated
  using (customer_id = (select auth.uid()));

-- Applications are submitted through the authenticated backend route only.
revoke insert, update, delete on public.supplier_applications from anon, authenticated;

create table if not exists public.checkout_payments (
  transaction_ref text primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('retail', 'wholesale')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  delivery_fee integer not null check (delivery_fee >= 0),
  distance_km numeric not null check (distance_km >= 0),
  dest_lat double precision not null check (dest_lat between -90 and 90),
  dest_lng double precision not null check (dest_lng between -180 and 180),
  customer_email text not null,
  customer_name text not null,
  customer_phone text not null,
  amount integer not null check (amount > 0),
  currency text not null check (currency = 'TZS'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  gateway_transaction_id text unique,
  order_id uuid unique references public.orders(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.checkout_payments enable row level security;
revoke all on public.checkout_payments from anon, authenticated;
grant all on public.checkout_payments to service_role;

-- Prevent mobile clients from bypassing payment by invoking the legacy order RPC directly.
revoke all on function public.place_order(uuid, text, jsonb, integer, numeric, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.place_order(uuid, text, jsonb, integer, numeric, double precision, double precision)
  to service_role;

create or replace function public.place_paid_order(
  p_customer uuid,
  p_mode text,
  p_items jsonb,
  p_fee integer,
  p_distance numeric,
  p_lat double precision,
  p_lng double precision
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_item jsonb;
  v_prod public.products%rowtype;
  v_supplier_order uuid;
  v_price integer;
  v_subtotal integer := 0;
  v_qty numeric;
begin
  insert into public.orders (customer_id, mode, subtotal, delivery_fee, distance_km, dest_lat, dest_lng)
  values (p_customer, p_mode, 0, p_fee, p_distance, p_lat, p_lng)
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod
      from public.products
      where id = (v_item->>'product_id')::uuid
      for update;
    v_qty := (v_item->>'qty')::numeric;
    v_price := (v_item->>'unit_price')::integer;

    if not found or v_prod.stock < v_qty then
      raise exception 'Not enough stock for %', coalesce(v_prod.name, 'item');
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Invalid checkout price';
    end if;
    if p_mode = 'wholesale' and v_qty < v_prod.wholesale_min_qty then
      raise exception 'Wholesale minimum for % is %', v_prod.name, v_prod.wholesale_min_qty;
    end if;

    v_subtotal := v_subtotal + round(v_price * v_qty);

    insert into public.supplier_orders (order_id, supplier_id)
    values (v_order, v_prod.supplier_id)
    on conflict (order_id, supplier_id) do update set updated_at = now()
    returning id into v_supplier_order;

    insert into public.order_items (order_id, supplier_order_id, product_id, supplier_id, qty, unit_price)
    values (v_order, v_supplier_order, v_prod.id, v_prod.supplier_id, v_qty, v_price);

    update public.products set stock = stock - v_qty where id = v_prod.id;
    insert into public.inventory_movements (supplier_id, product_id, order_id, kind, qty_change, stock_after)
    values (v_prod.supplier_id, v_prod.id, v_order, 'sale', -v_qty, v_prod.stock - v_qty);
  end loop;

  update public.orders set subtotal = v_subtotal where id = v_order;
  return v_order;
end;
$$;

revoke all on function public.place_paid_order(uuid, text, jsonb, integer, numeric, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.place_paid_order(uuid, text, jsonb, integer, numeric, double precision, double precision)
  to service_role;

create or replace function public.complete_flutterwave_payment(
  p_transaction_ref text,
  p_gateway_transaction_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.checkout_payments%rowtype;
  v_order_id uuid;
  v_order_subtotal integer;
begin
  select * into v_payment
    from public.checkout_payments
    where transaction_ref = p_transaction_ref
    for update;

  if not found then
    raise exception 'Payment reference not found';
  end if;

  if v_payment.order_id is not null then
    if v_payment.gateway_transaction_id <> p_gateway_transaction_id then
      raise exception 'Payment transaction does not match';
    end if;
    return v_payment.order_id;
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Payment is not pending';
  end if;

  v_order_id := public.place_paid_order(
    v_payment.customer_id,
    v_payment.mode,
    v_payment.items,
    v_payment.delivery_fee,
    v_payment.distance_km,
    v_payment.dest_lat,
    v_payment.dest_lng
  );

  select subtotal into v_order_subtotal
    from public.orders
    where id = v_order_id;
  if v_order_subtotal + v_payment.delivery_fee <> v_payment.amount then
    raise exception 'Paid amount does not match the order total';
  end if;

  update public.checkout_payments
    set status = 'paid',
        gateway_transaction_id = p_gateway_transaction_id,
        order_id = v_order_id,
        paid_at = now()
    where transaction_ref = p_transaction_ref;

  return v_order_id;
end;
$$;

revoke all on function public.complete_flutterwave_payment(text, text) from public, anon, authenticated;
grant execute on function public.complete_flutterwave_payment(text, text) to service_role;

insert into storage.buckets (id, name, public)
values ('customer-avatars', 'customer-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "customers upload own avatar" on storage.objects;
create policy "customers upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "customers update own avatar" on storage.objects;
create policy "customers update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "customers delete own avatar" on storage.objects;
create policy "customers delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
