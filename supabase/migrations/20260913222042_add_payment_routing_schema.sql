-- ════════════════════════════════════════════════════════════════════════════
-- Payment routing architecture — additive schema (step 1 of the payment rebuild)
--
-- Server-authoritative payment configuration and the canonical payment order
-- table. The client requests a PRODUCT; the server selects market, provider,
-- price, currency and route, and freezes them into payment_orders.
--
-- Scope: new objects only. Does NOT touch order_generations, coin_transactions,
-- users, cv_archive, any Edge Function, WishMoney or the live Paymob flow.
-- Seeds configuration identities only. NO payment routes, NO prices, and every
-- provider / market / product is seeded inactive — nothing can be sold.
--
-- Run as a single migration (atomically). If run by hand in the SQL editor,
-- wrap the whole file in BEGIN; … COMMIT;.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. payment_providers ─────────────────────────────────────────────────────
create table public.payment_providers (
  provider    text        not null,
  active      boolean     not null default false,
  created_at  timestamptz not null default now(),
  constraint payment_providers_pkey primary key (provider),
  constraint payment_providers_provider_format check (provider ~ '^[a-z][a-z0-9_]{1,31}$')
);

comment on table public.payment_providers is
  'Server-controlled registry of payment providers. No client access.';


-- ── 2. payment_markets ───────────────────────────────────────────────────────
create table public.payment_markets (
  market         text        not null,
  active         boolean     not null default false,
  -- A "flagged" region keeps its last MaxMind-verified value. Whether that is
  -- acceptable for payments is a per-market decision; default fails closed.
  allow_flagged  boolean     not null default false,
  is_default     boolean     not null default false,
  created_at     timestamptz not null default now(),
  constraint payment_markets_pkey primary key (market),
  constraint payment_markets_market_format check (market ~ '^[A-Z][A-Z0-9_]{1,15}$')
);

-- At most one default market (used when a trusted country has no explicit mapping).
create unique index payment_markets_single_default
  on public.payment_markets (is_default)
  where is_default;

comment on table public.payment_markets is
  'Server-controlled markets. No client access.';


-- ── 3. market_countries ──────────────────────────────────────────────────────
create table public.market_countries (
  country_iso2  text        not null,
  market        text        not null,
  created_at    timestamptz not null default now(),
  constraint market_countries_pkey primary key (country_iso2),
  constraint market_countries_country_format check (country_iso2 ~ '^[A-Z]{2}$'),
  constraint market_countries_market_fkey foreign key (market)
    references public.payment_markets (market) on update restrict on delete restrict
);

create index market_countries_market_idx on public.market_countries (market);

comment on table public.market_countries is
  'Server-controlled mapping of trusted ISO country (users.region) to market. No client access.';


-- ── 4. payment_products ──────────────────────────────────────────────────────
create table public.payment_products (
  product        text        not null,
  requires_form  boolean     not null,
  active         boolean     not null default false,
  created_at     timestamptz not null default now(),
  constraint payment_products_pkey primary key (product),
  constraint payment_products_product_format check (product ~ '^[a-z][a-z0-9_]{1,31}$')
);

comment on table public.payment_products is
  'Server-controlled product catalog identities. No client access.';


-- ── 5. payment_routes ────────────────────────────────────────────────────────
-- One route = (market, product) → provider + authoritative price. Prices are
-- mandatory, so routes are only ever created once a price is decided. A price
-- change is a NEW route row; financial fields of an existing route are immutable.
create table public.payment_routes (
  id                  uuid        not null default gen_random_uuid(),
  market              text        not null,
  product             text        not null,
  provider            text        not null,
  amount_cents        integer     not null,
  currency            text        not null,
  coins_to_grant      integer     not null default 0,
  creates_generation  boolean     not null,
  discount_allowed    boolean     not null default false,
  active              boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint payment_routes_pkey primary key (id),
  constraint payment_routes_amount_positive check (amount_cents > 0),
  constraint payment_routes_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint payment_routes_coins_nonnegative check (coins_to_grant >= 0),
  constraint payment_routes_market_fkey foreign key (market)
    references public.payment_markets (market) on update restrict on delete restrict,
  constraint payment_routes_product_fkey foreign key (product)
    references public.payment_products (product) on update restrict on delete restrict,
  constraint payment_routes_provider_fkey foreign key (provider)
    references public.payment_providers (provider) on update restrict on delete restrict
);

-- Exactly one ACTIVE route per (market, product). Inactive history rows allowed.
create unique index payment_routes_one_active_per_market_product
  on public.payment_routes (market, product)
  where active;

create index payment_routes_provider_idx on public.payment_routes (provider);
create index payment_routes_product_idx  on public.payment_routes (product);

comment on table public.payment_routes is
  'Server-controlled authoritative routing and pricing. No client access. Price change = new row.';

create function public.payment_routes_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only activation state may change on an existing route.
  if (new.id, new.market, new.product, new.provider, new.amount_cents, new.currency,
      new.coins_to_grant, new.creates_generation, new.discount_allowed, new.created_at)
     is distinct from
     (old.id, old.market, old.product, old.provider, old.amount_cents, old.currency,
      old.coins_to_grant, old.creates_generation, old.discount_allowed, old.created_at)
  then
    raise exception 'payment_routes: financial fields are immutable; create a new route instead';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger payment_routes_before_update
  before update on public.payment_routes
  for each row execute function public.payment_routes_before_update();


-- ── 6. payment_orders ────────────────────────────────────────────────────────
-- Canonical, provider-neutral payment order. Every financial value is FROZEN
-- at creation from the route and the user's trusted region state.
--
-- Identity references (user_id, form_id, generation_id) are validated by
-- trigger rather than FK: payment records are an audit trail and must not be
-- rewritten or blocked by the existing account-deletion cascade
-- (delete-account removes order_generations, cv_archive, users, auth.users).
create table public.payment_orders (
  id                        uuid        not null default gen_random_uuid(),
  user_id                   uuid        not null,
  product                   text        not null,
  form_id                   uuid,
  submission_id             text,
  market                    text        not null,
  provider                  text        not null,
  route_id                  uuid        not null,
  region_snapshot           text        not null,
  region_status_snapshot    text        not null,
  amount_cents              integer     not null,
  currency                  text        not null,
  coins_to_grant            integer     not null,
  creates_generation        boolean     not null,
  discount_applied          boolean     not null default false,
  status                    text        not null default 'pending',
  expires_at                timestamptz not null,
  provider_checkout_ref     text,
  provider_order_ref        text,
  provider_transaction_ref  text,
  generation_id             uuid,
  paid_at                   timestamptz,
  fulfilled_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint payment_orders_pkey primary key (id),

  constraint payment_orders_product_fkey foreign key (product)
    references public.payment_products (product) on update restrict on delete restrict,
  constraint payment_orders_market_fkey foreign key (market)
    references public.payment_markets (market) on update restrict on delete restrict,
  constraint payment_orders_provider_fkey foreign key (provider)
    references public.payment_providers (provider) on update restrict on delete restrict,
  constraint payment_orders_route_fkey foreign key (route_id)
    references public.payment_routes (id) on update restrict on delete restrict,

  constraint payment_orders_status_valid
    check (status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'cancelled')),
  constraint payment_orders_amount_positive      check (amount_cents > 0),
  constraint payment_orders_currency_format      check (currency ~ '^[A-Z]{3}$'),
  constraint payment_orders_coins_nonnegative    check (coins_to_grant >= 0),
  constraint payment_orders_region_format        check (region_snapshot ~ '^[A-Z]{2}$'),
  -- An unverified region can never back a payment order.
  constraint payment_orders_region_status_trusted
    check (region_status_snapshot in ('verified', 'flagged')),
  constraint payment_orders_submission_nonblank
    check (submission_id is null or length(btrim(submission_id)) between 1 and 255),
  constraint payment_orders_checkout_ref_nonblank
    check (provider_checkout_ref is null or length(btrim(provider_checkout_ref)) between 1 and 255),
  constraint payment_orders_order_ref_nonblank
    check (provider_order_ref is null or length(btrim(provider_order_ref)) between 1 and 255),
  constraint payment_orders_transaction_ref_nonblank
    check (provider_transaction_ref is null or length(btrim(provider_transaction_ref)) between 1 and 255),
  constraint payment_orders_paid_requires_settlement
    check (status not in ('paid', 'refunded')
           or (paid_at is not null and provider_transaction_ref is not null)),
  constraint payment_orders_fulfilled_requires_paid
    check (fulfilled_at is null or paid_at is not null),
  constraint payment_orders_generation_requires_flag
    check (generation_id is null or creates_generation),
  constraint payment_orders_expiry_after_creation
    check (expires_at > created_at)
);

-- Provider-scoped global uniqueness of every provider reference.
create unique index payment_orders_provider_checkout_ref_unique
  on public.payment_orders (provider, provider_checkout_ref)
  where provider_checkout_ref is not null;

create unique index payment_orders_provider_order_ref_unique
  on public.payment_orders (provider, provider_order_ref)
  where provider_order_ref is not null;

create unique index payment_orders_provider_transaction_ref_unique
  on public.payment_orders (provider, provider_transaction_ref)
  where provider_transaction_ref is not null;

-- A generation row can be produced by at most one payment order.
create unique index payment_orders_generation_id_unique
  on public.payment_orders (generation_id)
  where generation_id is not null;

create index payment_orders_user_created_idx on public.payment_orders (user_id, created_at desc);
create index payment_orders_route_idx        on public.payment_orders (route_id);
create index payment_orders_pending_expiry_idx
  on public.payment_orders (expires_at)
  where status = 'pending';

comment on table public.payment_orders is
  'Canonical server-created payment orders. Clients may only SELECT their own rows (limited columns). Frozen fields are immutable.';


-- ── payment_orders: insert validation (freeze correctness) ───────────────────
create function public.payment_orders_before_insert()
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

  if not exists (
    select 1 from public.payment_providers p
    where p.provider = new.provider and p.active
  ) then
    raise exception 'payment_orders: provider missing or inactive';
  end if;

  select * into v_product from public.payment_products where product = new.product;
  if not found or not v_product.active then
    raise exception 'payment_orders: product missing or inactive';
  end if;

  -- Region snapshot must equal the user's CURRENT trusted server-side state.
  select u.region, u.region_status
    into v_user_region, v_user_status
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

create trigger payment_orders_before_insert
  before insert on public.payment_orders
  for each row execute function public.payment_orders_before_insert();


-- ── payment_orders: update guard (immutability + status machine) ─────────────
create function public.payment_orders_before_update()
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
      new.discount_applied, new.created_at, new.expires_at)
     is distinct from
     (old.id, old.user_id, old.product, old.form_id, old.submission_id, old.market,
      old.provider, old.route_id, old.region_snapshot, old.region_status_snapshot,
      old.amount_cents, old.currency, old.coins_to_grant, old.creates_generation,
      old.discount_applied, old.created_at, old.expires_at)
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

create trigger payment_orders_before_update
  before update on public.payment_orders
  for each row execute function public.payment_orders_before_update();


-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.payment_providers enable row level security;
alter table public.payment_markets   enable row level security;
alter table public.market_countries  enable row level security;
alter table public.payment_products  enable row level security;
alter table public.payment_routes    enable row level security;
alter table public.payment_orders    enable row level security;

-- Configuration tables: no policies → no access for anon/authenticated.
-- service_role bypasses RLS for server-side reads/writes.

-- payment_orders: owners may read their own rows. No write policies exist.
create policy payment_orders_select_own
  on public.payment_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Project default ACLs grant ALL on new public tables and EXECUTE on new public
-- functions to anon and authenticated. Revoke explicitly.
revoke all on table
  public.payment_providers,
  public.payment_markets,
  public.market_countries,
  public.payment_products,
  public.payment_routes,
  public.payment_orders
from public, anon, authenticated;

grant all on table
  public.payment_providers,
  public.payment_markets,
  public.market_countries,
  public.payment_products,
  public.payment_routes,
  public.payment_orders
to service_role;

-- Owners may read status-level columns of their own orders (RLS-scoped).
-- Internal fields (route_id, region snapshots, coins, discount, provider refs)
-- are not exposed. PostgREST callers must select these columns explicitly.
grant select (
  id,
  product,
  form_id,
  submission_id,
  market,
  provider,
  amount_cents,
  currency,
  status,
  generation_id,
  expires_at,
  paid_at,
  fulfilled_at,
  created_at,
  updated_at
) on public.payment_orders to authenticated;

revoke all on function public.payment_routes_before_update()  from public, anon, authenticated;
revoke all on function public.payment_orders_before_insert()  from public, anon, authenticated;
revoke all on function public.payment_orders_before_update()  from public, anon, authenticated;


-- ── Seed: configuration identities only (all inactive, no routes, no prices) ─
insert into public.payment_providers (provider, active) values
  ('paymob',    false),
  ('wishmoney', false);

insert into public.payment_markets (market, active, allow_flagged, is_default) values
  ('EG',     false, false, false),
  ('GLOBAL', false, false, true);

insert into public.market_countries (country_iso2, market) values
  ('EG', 'EG');

-- requires_form = true for all products mirrors current behavior: create-cv-order
-- requires form_id or submission_id for every plan, and CareerAnalysis submits its
-- record id. Career Analysis price and entitlement are intentionally NOT defined.
insert into public.payment_products (product, requires_form, active) values
  ('premium',         true, false),
  ('gold',            true, false),
  ('ai_search',       true, false),
  ('career_analysis', true, false);

-- payment_routes intentionally not seeded: routes require authoritative prices.
