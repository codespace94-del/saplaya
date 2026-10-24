-- Apply to existing projects before enabling the live website supplier form.
alter table public.supplier_applications alter column customer_id drop not null;
alter table public.supplier_applications add column if not exists region text;
alter table public.supplier_applications add column if not exists farm_size text;
