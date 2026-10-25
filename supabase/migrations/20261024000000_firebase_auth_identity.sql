-- Bridge Firebase customer identities to existing Supabase Auth UUIDs.
-- Run after schema.sql and mobile_account_payments.sql have been installed.

create table if not exists public.firebase_auth_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  firebase_uid text unique,
  phone_e164 text,
  email text,
  created_at timestamptz not null default now(),
  constraint firebase_auth_identities_uid_length
    check (firebase_uid is null or char_length(firebase_uid) between 1 and 128)
);

create index if not exists firebase_auth_identities_phone_idx
  on public.firebase_auth_identities (phone_e164)
  where phone_e164 is not null;
create index if not exists firebase_auth_identities_email_idx
  on public.firebase_auth_identities (email)
  where email is not null;

insert into public.firebase_auth_identities (auth_user_id, phone_e164, email)
select
  id,
  case when phone_confirmed_at is not null then phone else null end,
  case when email_confirmed_at is not null then lower(email) else null end
from auth.users
where phone_confirmed_at is not null or email_confirmed_at is not null
on conflict (auth_user_id) do update
set phone_e164 = excluded.phone_e164,
    email = excluded.email;

alter table public.firebase_auth_identities enable row level security;
revoke all on public.firebase_auth_identities from anon, authenticated;
grant all on public.firebase_auth_identities to service_role;

create or replace function public.current_customer_auth_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  subject text := auth.jwt() ->> 'sub';
  issuer text := auth.jwt() ->> 'iss';
begin
  if issuer = 'https://securetoken.google.com/saplaya-v1' then
    return (
      select auth_user_id
      from public.firebase_auth_identities
      where firebase_uid = subject
    );
  end if;

  if subject is null or subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return subject::uuid;
end;
$$;

revoke all on function public.current_customer_auth_user_id() from public, anon;
grant execute on function public.current_customer_auth_user_id() to authenticated;

drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders for select to authenticated
  using (customer_id = (select public.current_customer_auth_user_id()));

drop policy if exists "own supplier_orders status" on public.supplier_orders;
create policy "own supplier_orders status" on public.supplier_orders for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_id = (select public.current_customer_auth_user_id())
    )
  );

drop policy if exists "customers manage own profile" on public.customer_profiles;
create policy "customers manage own profile" on public.customer_profiles for all to authenticated
  using (customer_id = (select public.current_customer_auth_user_id()))
  with check (customer_id = (select public.current_customer_auth_user_id()));

drop policy if exists "customers manage own addresses" on public.customer_addresses;
create policy "customers manage own addresses" on public.customer_addresses for all to authenticated
  using (customer_id = (select public.current_customer_auth_user_id()))
  with check (customer_id = (select public.current_customer_auth_user_id()));

drop policy if exists "customers manage own reviews" on public.customer_reviews;
create policy "customers manage own reviews" on public.customer_reviews for all to authenticated
  using (customer_id = (select public.current_customer_auth_user_id()))
  with check (customer_id = (select public.current_customer_auth_user_id()));

drop policy if exists "customers read own supplier applications" on public.supplier_applications;
create policy "customers read own supplier applications" on public.supplier_applications for select to authenticated
  using (customer_id = (select public.current_customer_auth_user_id()));

drop policy if exists "customers upload own avatar" on storage.objects;
create policy "customers upload own avatar" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select public.current_customer_auth_user_id())::text
  );

drop policy if exists "customers update own avatar" on storage.objects;
create policy "customers update own avatar" on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select public.current_customer_auth_user_id())::text
  )
  with check (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select public.current_customer_auth_user_id())::text
  );

drop policy if exists "customers delete own avatar" on storage.objects;
create policy "customers delete own avatar" on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = (select public.current_customer_auth_user_id())::text
  );
