-- ════════════════════════════════════════════════════════════════════════════
-- Invoices + payment evidence + immutable customer snapshot (payment rebuild, step 2)
--
-- Adds, without activating anything:
--   1. payment_orders: immutable customer snapshot (frozen at order creation) and
--      set-once verified payment evidence (written only at settlement).
--   2. invoices: one immutable invoice per paid payment order, numbered from a
--      gapless counter that is consumed only inside a successful invoice insert.
--   3. Payment environment ('test' | 'live'): configured per provider, frozen on
--      every payment order as audit metadata. It does not change payment
--      behavior: test and live orders follow the same flow, including invoicing.
--
-- Does NOT: insert prices or routes, activate providers/markets/products,
-- implement fulfilment, or touch users, profiles, cv_archive or order_generations.
--
-- Apply as ONE migration (atomically) via apply_migration / SQL editor.
-- Do not use `supabase db push` (migration history is divergent).
-- ════════════════════════════════════════════════════════════════════════════


-- ── 0. Preconditions ─────────────────────────────────────────────────────────
-- New NOT NULL snapshot columns have no correct value for pre-existing orders.
do $$
begin
  if exists (select 1 from public.payment_orders) then
    raise exception 'migration aborted: payment_orders is not empty; snapshot backfill required';
  end if;
end;
$$;


-- ── 1. Trusted auth email lookup ─────────────────────────────────────────────
-- service_role has no privilege on auth.users; this is the single, narrow
-- read path used to validate the frozen customer email.
create function public.payment_customer_auth_email(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text from auth.users u where u.id = p_user_id;
$$;

revoke all on function public.payment_customer_auth_email(uuid) from public, anon, authenticated;
grant execute on function public.payment_customer_auth_email(uuid) to service_role;


-- ── 1b. payment_providers: server-controlled payment environment ─────────────
-- The environment a provider's credentials operate in. Switching a provider from
-- test to live is a configuration change on this row (plus its server secrets);
-- orders freeze the value at creation, so history stays distinguishable forever.
-- Existing providers start as 'test' (their current credentials are test
-- credentials); the default is then dropped so every future provider must
-- declare its value.
alter table public.payment_providers
  add column environment text not null default 'test';

alter table public.payment_providers
  alter column environment drop default,
  add constraint payment_providers_environment_valid
    check (environment in ('test', 'live'));


-- ── 2. payment_orders: customer snapshot + payment evidence ──────────────────
alter table public.payment_orders
  -- Provider environment frozen at order creation as audit metadata; must equal
  -- the provider's configured environment. Does not change payment behavior.
  add column payment_environment           text not null,
  -- Immutable customer identity at order creation (Resumation data, never Paymob).
  add column customer_email_snapshot       text not null,
  add column customer_first_name_snapshot  text not null,
  add column customer_last_name_snapshot   text not null,
  add column customer_username_snapshot    text,
  -- Verified provider evidence, set once at settlement. Never card numbers,
  -- CVV, full wallet numbers or payer billing data.
  add column paid_amount_cents             integer,
  add column paid_currency                 text,
  add column provider_payment_method       text,
  add column provider_payment_subtype      text,
  add column provider_masked_identifier    text;

alter table public.payment_orders
  add constraint payment_orders_payment_environment_valid
    check (payment_environment in ('test', 'live')),
  add constraint payment_orders_customer_email_format
    check (length(customer_email_snapshot) between 3 and 320
           and customer_email_snapshot ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  add constraint payment_orders_customer_first_name_nonblank
    check (length(btrim(customer_first_name_snapshot)) between 1 and 100),
  add constraint payment_orders_customer_last_name_nonblank
    check (length(btrim(customer_last_name_snapshot)) between 1 and 100),
  add constraint payment_orders_customer_username_nonblank
    check (customer_username_snapshot is null
           or length(btrim(customer_username_snapshot)) between 1 and 64),
  add constraint payment_orders_paid_amount_positive
    check (paid_amount_cents is null or paid_amount_cents > 0),
  add constraint payment_orders_paid_currency_format
    check (paid_currency is null or paid_currency ~ '^[A-Z]{3}$'),
  -- A settled order's verified payment must equal the frozen price exactly.
  add constraint payment_orders_paid_matches_frozen_price
    check (status not in ('paid', 'refunded')
           or (paid_amount_cents is not null
               and paid_currency is not null
               and paid_amount_cents = amount_cents
               and paid_currency = currency)),
  add constraint payment_orders_payment_method_format
    check (provider_payment_method is null
           or provider_payment_method ~ '^[a-z][a-z0-9_]{0,31}$'),
  add constraint payment_orders_payment_subtype_nonblank
    check (provider_payment_subtype is null
           or length(btrim(provider_payment_subtype)) between 1 and 64),
  -- Masked identifiers only: at most 6 consecutive digits (blocks full PANs
  -- and full wallet numbers; allows last-4 or BIN+last-4 masks).
  add constraint payment_orders_masked_identifier_safe
    check (provider_masked_identifier is null
           or (length(btrim(provider_masked_identifier)) between 1 and 32
               and provider_masked_identifier !~ '[0-9]{7,}'));


-- ── 3. payment_orders: insert validation (replaces step-1 function) ──────────
-- Identical to the applied version, plus: evidence must be empty on insert,
-- the customer snapshot must match trusted server-side identity, and the
-- payment environment must equal the provider's configured environment.
create or replace function public.payment_orders_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_route            public.payment_routes%rowtype;
  v_market           public.payment_markets%rowtype;
  v_product          public.payment_products%rowtype;
  v_user_region      text;
  v_user_status      text;
  v_user_first_name  text;
  v_user_last_name   text;
  v_user_username    text;
  v_auth_email       text;
  v_provider_env     text;
  v_expected_market  text;
begin
  -- New orders start unsettled.
  if new.status is distinct from 'pending' then
    raise exception 'payment_orders: new orders must be pending';
  end if;

  if new.paid_at is not null
     or new.fulfilled_at is not null
     or new.generation_id is not null
     or new.provider_transaction_ref is not null then
    raise exception 'payment_orders: settlement fields must be empty on insert';
  end if;

  if new.paid_amount_cents is not null
     or new.paid_currency is not null
     or new.provider_payment_method is not null
     or new.provider_payment_subtype is not null
     or new.provider_masked_identifier is not null then
    raise exception 'payment_orders: payment evidence must be empty on insert';
  end if;

  if new.expires_at is null or new.expires_at <= now() then
    raise exception 'payment_orders: expires_at must be in the future';
  end if;

  -- Route must exist, be active, and match every frozen value.
  select * into v_route from public.payment_routes where id = new.route_id;
  if not found or not v_route.active then
    raise exception 'payment_orders: route missing or inactive';
  end if;

  if v_route.market             is distinct from new.market
     or v_route.product            is distinct from new.product
     or v_route.provider           is distinct from new.provider
     or v_route.currency           is distinct from new.currency
     or v_route.coins_to_grant     is distinct from new.coins_to_grant
     or v_route.creates_generation is distinct from new.creates_generation then
    raise exception 'payment_orders: order does not match its route';
  end if;

  -- Discounts are not implemented: no order may be discounted, whatever the
  -- route's discount_allowed says, and the amount must equal the route price.
  if new.discount_applied is distinct from false then
    raise exception 'payment_orders: discounts are not supported';
  end if;

  if new.amount_cents is distinct from v_route.amount_cents then
    raise exception 'payment_orders: amount does not match route price';
  end if;

  -- Market, provider and product must all be active.
  select * into v_market from public.payment_markets where market = new.market;
  if not found or not v_market.active then
    raise exception 'payment_orders: market missing or inactive';
  end if;

  select p.environment into v_provider_env
    from public.payment_providers p
   where p.provider = new.provider and p.active;

  if not found then
    raise exception 'payment_orders: provider missing or inactive';
  end if;

  -- Environment is server configuration, never caller choice.
  if new.payment_environment is distinct from v_provider_env then
    raise exception 'payment_orders: payment environment does not match provider configuration';
  end if;

  select * into v_product from public.payment_products where product = new.product;
  if not found or not v_product.active then
    raise exception 'payment_orders: product missing or inactive';
  end if;

  -- Region snapshot must equal the user's CURRENT trusted server-side state.
  select u.region, u.region_status, u.first_name, u.last_name, u.username
    into v_user_region, v_user_status, v_user_first_name, v_user_last_name, v_user_username
    from public.users u
   where u.id = new.user_id;

  if not found then
    raise exception 'payment_orders: user not found';
  end if;

  if v_user_region is distinct from new.region_snapshot
     or v_user_status is distinct from new.region_status_snapshot then
    raise exception 'payment_orders: region snapshot does not match trusted user region';
  end if;

  if new.region_status_snapshot = 'flagged' and not v_market.allow_flagged then
    raise exception 'payment_orders: flagged region not permitted for this market';
  end if;

  -- Customer snapshot must match trusted server-side identity at creation.
  v_auth_email := public.payment_customer_auth_email(new.user_id);

  if v_auth_email is null or new.customer_email_snapshot is distinct from v_auth_email then
    raise exception 'payment_orders: customer email snapshot does not match account email';
  end if;

  -- When the account has a name, the snapshot must be that name. Only an
  -- account with no stored name may carry a server-derived fallback.
  if nullif(btrim(v_user_first_name), '') is not null
     and new.customer_first_name_snapshot is distinct from btrim(v_user_first_name) then
    raise exception 'payment_orders: customer first name snapshot does not match account';
  end if;

  if nullif(btrim(v_user_last_name), '') is not null
     and new.customer_last_name_snapshot is distinct from btrim(v_user_last_name) then
    raise exception 'payment_orders: customer last name snapshot does not match account';
  end if;

  if new.customer_username_snapshot is distinct from v_user_username then
    raise exception 'payment_orders: customer username snapshot does not match account';
  end if;

  -- Market must be the one the server mapping selects for the trusted country.
  select mc.market into v_expected_market
    from public.market_countries mc
   where mc.country_iso2 = new.region_snapshot;

  if not found then
    select pm.market into v_expected_market
      from public.payment_markets pm
     where pm.is_default;
  end if;

  if v_expected_market is distinct from new.market then
    raise exception 'payment_orders: market does not match trusted region mapping';
  end if;

  -- Form requirement and ownership.
  if v_product.requires_form and new.form_id is null and new.submission_id is null then
    raise exception 'payment_orders: product requires an owned form';
  end if;

  if new.form_id is not null and not exists (
    select 1 from public.cv_archive c
     where c.form_id = new.form_id
       and c.user_id = new.user_id
       and (new.submission_id is null or c.submission_id = new.submission_id)
  ) then
    raise exception 'payment_orders: form not found or not owned by user';
  end if;

  if new.form_id is null and new.submission_id is not null and not exists (
    select 1 from public.cv_archive c
     where c.submission_id = new.submission_id
       and c.user_id = new.user_id
  ) then
    raise exception 'payment_orders: submission not found or not owned by user';
  end if;

  -- Server clock is authoritative for timestamps.
  new.created_at := now();
  new.updated_at := new.created_at;

  return new;
end;
$$;


-- ── 4. payment_orders: update guard (replaces step-1 function) ───────────────
-- Identical to the applied version, plus: payment environment and customer
-- snapshot are frozen, payment evidence is set at most once and only on a paid
-- order, and paid_at / provider_transaction_ref are first set only on a paid order.
create or replace function public.payment_orders_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Frozen fields never change.
  if (new.id, new.user_id, new.product, new.form_id, new.submission_id, new.market,
      new.provider, new.route_id, new.region_snapshot, new.region_status_snapshot,
      new.amount_cents, new.currency, new.coins_to_grant, new.creates_generation,
      new.discount_applied, new.created_at, new.expires_at, new.payment_environment,
      new.customer_email_snapshot, new.customer_first_name_snapshot,
      new.customer_last_name_snapshot, new.customer_username_snapshot)
     is distinct from
     (old.id, old.user_id, old.product, old.form_id, old.submission_id, old.market,
      old.provider, old.route_id, old.region_snapshot, old.region_status_snapshot,
      old.amount_cents, old.currency, old.coins_to_grant, old.creates_generation,
      old.discount_applied, old.created_at, old.expires_at, old.payment_environment,
      old.customer_email_snapshot, old.customer_first_name_snapshot,
      old.customer_last_name_snapshot, old.customer_username_snapshot)
  then
    raise exception 'payment_orders: frozen fields are immutable';
  end if;

  -- Provider references and settlement markers are set at most once.
  if old.provider_checkout_ref is not null
     and new.provider_checkout_ref is distinct from old.provider_checkout_ref then
    raise exception 'payment_orders: provider_checkout_ref is immutable once set';
  end if;

  if old.provider_order_ref is not null
     and new.provider_order_ref is distinct from old.provider_order_ref then
    raise exception 'payment_orders: provider_order_ref is immutable once set';
  end if;

  if old.provider_transaction_ref is not null
     and new.provider_transaction_ref is distinct from old.provider_transaction_ref then
    raise exception 'payment_orders: provider_transaction_ref is immutable once set';
  end if;

  if old.paid_at is not null and new.paid_at is distinct from old.paid_at then
    raise exception 'payment_orders: paid_at is immutable once set';
  end if;

  if old.fulfilled_at is not null and new.fulfilled_at is distinct from old.fulfilled_at then
    raise exception 'payment_orders: fulfilled_at is immutable once set';
  end if;

  if old.generation_id is not null and new.generation_id is distinct from old.generation_id then
    raise exception 'payment_orders: generation_id is immutable once set';
  end if;

  -- Payment evidence is set at most once.
  if (old.paid_amount_cents is not null and new.paid_amount_cents is distinct from old.paid_amount_cents)
     or (old.paid_currency is not null and new.paid_currency is distinct from old.paid_currency)
     or (old.provider_payment_method is not null
         and new.provider_payment_method is distinct from old.provider_payment_method)
     or (old.provider_payment_subtype is not null
         and new.provider_payment_subtype is distinct from old.provider_payment_subtype)
     or (old.provider_masked_identifier is not null
         and new.provider_masked_identifier is distinct from old.provider_masked_identifier)
  then
    raise exception 'payment_orders: payment evidence is immutable once set';
  end if;

  -- Allowed status transitions only.
  if new.status is distinct from old.status then
    if not (
         (old.status = 'pending'             and new.status in ('paid', 'failed', 'expired', 'cancelled'))
      or (old.status in ('failed', 'expired') and new.status = 'paid')
      or (old.status = 'paid'                and new.status = 'refunded')
    ) then
      raise exception 'payment_orders: illegal status transition % -> %', old.status, new.status;
    end if;
  end if;

  -- Payment evidence may only be recorded on a paid order.
  if new.status <> 'paid'
     and ((old.paid_amount_cents is null and new.paid_amount_cents is not null)
          or (old.paid_currency is null and new.paid_currency is not null)
          or (old.provider_payment_method is null and new.provider_payment_method is not null)
          or (old.provider_payment_subtype is null and new.provider_payment_subtype is not null)
          or (old.provider_masked_identifier is null and new.provider_masked_identifier is not null))
  then
    raise exception 'payment_orders: payment evidence requires a paid order';
  end if;

  -- Settlement markers may first be recorded only on a paid order.
  if new.status <> 'paid'
     and ((old.paid_at is null and new.paid_at is not null)
          or (old.provider_transaction_ref is null and new.provider_transaction_ref is not null))
  then
    raise exception 'payment_orders: paid_at and provider_transaction_ref require a paid order';
  end if;

  -- Fulfilment may only be recorded on a paid order.
  if old.fulfilled_at is null and new.fulfilled_at is not null and new.status <> 'paid' then
    raise exception 'payment_orders: fulfilment requires a paid order';
  end if;

  -- A linked generation must be paid and belong to the same user.
  if old.generation_id is null and new.generation_id is not null then
    if new.status <> 'paid' then
      raise exception 'payment_orders: generation can only be linked to a paid order';
    end if;

    if not exists (
      select 1 from public.order_generations g
       where g.generation_id = new.generation_id
         and g.user_id = new.user_id
    ) then
      raise exception 'payment_orders: generation not found or not owned by order user';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


-- ── 5. payment_orders: settled orders are audit records ──────────────────────
create function public.payment_orders_before_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.paid_at is not null or old.status in ('paid', 'refunded') then
    raise exception 'payment_orders: settled orders cannot be deleted';
  end if;

  return old;
end;
$$;

create trigger payment_orders_before_delete
  before delete on public.payment_orders
  for each row execute function public.payment_orders_before_delete();

-- TRUNCATE bypasses row triggers.
revoke truncate on table public.payment_orders from service_role;

revoke all on function public.payment_orders_before_delete() from public, anon, authenticated;


-- ── 6. Invoice number counter (gapless, transactional) ───────────────────────
-- A single locked row, incremented inside the invoice insert. A rolled-back
-- insert rolls the increment back, so failed attempts never consume a number.
create table public.invoice_number_counter (
  singleton   boolean     not null default true,
  last_value  bigint      not null default 0,
  updated_at  timestamptz not null default now(),
  constraint invoice_number_counter_pkey primary key (singleton),
  constraint invoice_number_counter_singleton check (singleton),
  constraint invoice_number_counter_nonnegative check (last_value >= 0)
);

insert into public.invoice_number_counter (singleton, last_value) values (true, 0);

alter table public.invoice_number_counter enable row level security;

-- No role may read or write the counter directly; only the SECURITY DEFINER
-- invoice trigger (owned by the migration role) advances it.
revoke all on table public.invoice_number_counter from public, anon, authenticated, service_role;

comment on table public.invoice_number_counter is
  'Gapless invoice number source. Advanced only by invoices_before_insert. No client or service_role access.';


-- ── 7. invoices ──────────────────────────────────────────────────────────────
-- One immutable invoice per paid payment order. Every value is copied from the
-- frozen payment order by trigger; callers supply only payment_order_id.
-- No FK to users/auth.users: invoices are retained audit records and must not
-- be cascaded away by account deletion.
create table public.invoices (
  id                        uuid        not null default gen_random_uuid(),
  invoice_number            bigint      not null,
  payment_order_id          uuid        not null,
  user_id                   uuid        not null,
  customer_email            text        not null,
  customer_first_name       text        not null,
  customer_last_name        text        not null,
  customer_username         text,
  country_iso2              text        not null,
  market                    text        not null,
  product                   text        not null,
  amount_cents              integer     not null,
  currency                  text        not null,
  provider                  text        not null,
  provider_order_ref        text,
  provider_transaction_ref  text        not null,
  paid_at                   timestamptz not null,
  issued_at                 timestamptz not null default now(),
  created_at                timestamptz not null default now(),

  constraint invoices_pkey primary key (id),
  constraint invoices_invoice_number_unique unique (invoice_number),
  constraint invoices_payment_order_unique unique (payment_order_id),

  constraint invoices_payment_order_fkey foreign key (payment_order_id)
    references public.payment_orders (id) on update restrict on delete restrict,
  constraint invoices_market_fkey foreign key (market)
    references public.payment_markets (market) on update restrict on delete restrict,
  constraint invoices_product_fkey foreign key (product)
    references public.payment_products (product) on update restrict on delete restrict,
  constraint invoices_provider_fkey foreign key (provider)
    references public.payment_providers (provider) on update restrict on delete restrict,

  constraint invoices_invoice_number_positive check (invoice_number > 0),
  constraint invoices_amount_positive         check (amount_cents > 0),
  constraint invoices_currency_format         check (currency ~ '^[A-Z]{3}$'),
  constraint invoices_country_format          check (country_iso2 ~ '^[A-Z]{2}$')
);

create index invoices_user_issued_idx on public.invoices (user_id, issued_at desc);

comment on table public.invoices is
  'Immutable invoices, exactly one per paid payment order. Insert-only via service_role; owners may read their own.';


-- ── invoices: issuance (numbering + snapshot copy) ───────────────────────────
create function public.invoices_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.payment_orders%rowtype;
  v_number  bigint;
begin
  if new.payment_order_id is null then
    raise exception 'invoices: payment_order_id is required';
  end if;

  -- Everything except payment_order_id is derived here, never supplied.
  if new.invoice_number is not null
     or new.user_id is not null
     or new.customer_email is not null
     or new.customer_first_name is not null
     or new.customer_last_name is not null
     or new.customer_username is not null
     or new.country_iso2 is not null
     or new.market is not null
     or new.product is not null
     or new.amount_cents is not null
     or new.currency is not null
     or new.provider is not null
     or new.provider_order_ref is not null
     or new.provider_transaction_ref is not null
     or new.paid_at is not null then
    raise exception 'invoices: only payment_order_id may be supplied';
  end if;

  -- Serialize issuance per order. A concurrent second delivery waits here,
  -- then sees the committed invoice below and fails before any number is taken.
  select * into v_order
    from public.payment_orders
   where id = new.payment_order_id
   for update;

  if not found then
    raise exception 'invoices: payment order not found';
  end if;

  if exists (select 1 from public.invoices i where i.payment_order_id = new.payment_order_id) then
    raise exception 'invoices: invoice already issued for payment order %', new.payment_order_id
      using errcode = 'unique_violation';
  end if;

  if v_order.status <> 'paid'
     or v_order.paid_at is null
     or v_order.provider_transaction_ref is null
     or v_order.paid_amount_cents is distinct from v_order.amount_cents
     or v_order.paid_currency is distinct from v_order.currency then
    raise exception 'invoices: payment order is not verifiably paid at its frozen price';
  end if;

  update public.invoice_number_counter
     set last_value = last_value + 1,
         updated_at = now()
   where singleton
  returning last_value into v_number;

  if v_number is null then
    raise exception 'invoices: invoice number counter missing';
  end if;

  new.invoice_number           := v_number;
  new.user_id                  := v_order.user_id;
  new.customer_email           := v_order.customer_email_snapshot;
  new.customer_first_name      := v_order.customer_first_name_snapshot;
  new.customer_last_name       := v_order.customer_last_name_snapshot;
  new.customer_username        := v_order.customer_username_snapshot;
  new.country_iso2             := v_order.region_snapshot;
  new.market                   := v_order.market;
  new.product                  := v_order.product;
  new.amount_cents             := v_order.amount_cents;
  new.currency                 := v_order.currency;
  new.provider                 := v_order.provider;
  new.provider_order_ref       := v_order.provider_order_ref;
  new.provider_transaction_ref := v_order.provider_transaction_ref;
  new.paid_at                  := v_order.paid_at;
  new.issued_at                := now();
  new.created_at               := new.issued_at;

  return new;
end;
$$;

create trigger invoices_before_insert
  before insert on public.invoices
  for each row execute function public.invoices_before_insert();


-- ── invoices: immutability ───────────────────────────────────────────────────
create function public.invoices_prevent_modification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'invoices: issued invoices are immutable';
end;
$$;

create trigger invoices_prevent_update
  before update on public.invoices
  for each row execute function public.invoices_prevent_modification();

create trigger invoices_prevent_delete
  before delete on public.invoices
  for each row execute function public.invoices_prevent_modification();

create trigger invoices_prevent_truncate
  before truncate on public.invoices
  for each statement execute function public.invoices_prevent_modification();


-- ── invoices: RLS + privileges ───────────────────────────────────────────────
alter table public.invoices enable row level security;

create policy invoices_select_own
  on public.invoices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Project default ACLs grant ALL on new public tables to anon/authenticated.
revoke all on table public.invoices from public, anon, authenticated, service_role;

grant select on table public.invoices to authenticated;
grant select, insert on table public.invoices to service_role;

revoke all on function public.invoices_before_insert()         from public, anon, authenticated;
revoke all on function public.invoices_prevent_modification()  from public, anon, authenticated;
