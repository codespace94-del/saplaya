-- Apply after mobile_account_payments.sql to migrate existing deployments to Pesapal.
create table if not exists public.payment_provider_config (
  provider text primary key check (provider = 'pesapal'),
  ipn_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.payment_provider_config enable row level security;
revoke all on public.payment_provider_config from anon, authenticated;
grant all on public.payment_provider_config to service_role;

create or replace function public.complete_pesapal_payment(
  p_transaction_ref text,
  p_order_tracking_id text
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
    if v_payment.gateway_transaction_id is distinct from p_order_tracking_id then
      raise exception 'Payment tracking ID does not match';
    end if;
    return v_payment.order_id;
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Payment is not pending';
  end if;
  if v_payment.gateway_transaction_id is distinct from p_order_tracking_id then
    raise exception 'Payment tracking ID does not match';
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
        order_id = v_order_id,
        paid_at = now()
    where transaction_ref = p_transaction_ref;

  return v_order_id;
end;
$$;

revoke all on function public.complete_pesapal_payment(text, text) from public, anon, authenticated;
grant execute on function public.complete_pesapal_payment(text, text) to service_role;
drop function if exists public.complete_flutterwave_payment(text, text);
