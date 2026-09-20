-- ════════════════════════════════════════════════════════════════════════════
-- Payment foundation, step 1: product versioning, versioned benefits and the
-- server-authoritative entitlement layer.
--
-- Adds, without making any purchase possible:
--   1. benefit_types / product_versions / product_version_benefits (catalog).
--   2. product_version_id on payment_routes, payment_orders and invoices, with
--      the benefit set frozen onto every order.
--   3. entitlements / entitlement_consumptions (granted in step 2, never by a
--      client).
--   4. The first product, career_package v1, seeded as DRAFT with INACTIVE
--      routes for Egypt (Paymob) and Lebanon (WishMoney).
--
-- Does NOT: implement settlement/fulfilment, touch profiles, usernames, the
-- career form, generate-cv, any Edge Function, or any legacy payment field.
--
-- Apply as ONE migration (atomically) via apply_migration / SQL editor.
-- Do not use `supabase db push` (migration history is divergent).
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. benefit_types — server-controlled registry of what a product can grant ─
-- kind drives quantity semantics, enforced declaratively wherever a benefit is
-- referenced (see the composite foreign keys below):
--   consumable : quantity is required and is consumed by server actions
--   lifetime   : no quantity, no expiry
create table public.benefit_types (
  code         text        not null,
  kind         text        not null,
  description  text        not null,
  created_at   timestamptz not null default now(),
  constraint benefit_types_pkey primary key (code),
  -- Lets referencing tables carry (benefit_type, benefit_kind) as a composite
  -- FK, so a copied kind can never disagree with this registry.
  constraint benefit_types_code_kind_unique unique (code, kind),
  constraint benefit_types_code_format check (code ~ '^[a-z][a-z0-9_]{1,47}$'),
  constraint benefit_types_kind_valid  check (kind in ('consumable', 'lifetime')),
  constraint benefit_types_description_nonblank
    check (length(btrim(description)) between 1 and 200)
);

comment on table public.benefit_types is
  'Server-controlled catalog of grantable benefits. No client access.';

insert into public.benefit_types (code, kind, description) values
  ('cv_generation',             'consumable', 'One ATS CV document generation'),
  ('cover_letter_generation',   'consumable', 'One cover letter document generation'),
  ('professional_profile',      'lifetime',   'Full professional profile unlocked'),
  ('profile_qr',                'lifetime',   'Profile QR code unlocked');

-- code and kind are the contract every server handler and composite FK relies on.
create function public.benefit_types_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.code is distinct from old.code or new.kind is distinct from old.kind then
    raise exception 'benefit_types: code and kind are immutable';
  end if;
  return new;
end;
$$;

create trigger benefit_types_before_update
  before update on public.benefit_types
  for each row execute function public.benefit_types_before_update();


-- ── 2. product_versions — immutable priced/benefit-bearing version of a product
-- A product keeps a stable code forever; everything that can change (name,
-- benefits, price) belongs to a version, so historical orders stay accurate.
create table public.product_versions (
  id             uuid        not null default gen_random_uuid(),
  product        text        not null,
  version_no     integer     not null,
  display_name   text        not null,
  billing_model  text        not null,
  status         text        not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint product_versions_pkey primary key (id),
  constraint product_versions_product_fkey foreign key (product)
    references public.payment_products (product) on update restrict on delete restrict,
  constraint product_versions_product_version_unique unique (product, version_no),
  -- Lets payment_routes / payment_orders / invoices carry a composite FK that
  -- proves the version really belongs to the row's product.
  constraint product_versions_id_product_unique unique (id, product),
  constraint product_versions_version_positive check (version_no > 0),
  constraint product_versions_display_name_nonblank
    check (length(btrim(display_name)) between 1 and 120),
  constraint product_versions_billing_model_valid check (billing_model in ('one_time')),
  constraint product_versions_status_valid check (status in ('draft', 'active', 'retired'))
);

comment on table public.product_versions is
  'Immutable product versions. Benefits and display name freeze once sold. Retirement is final. No client access.';

create function public.product_versions_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.id, new.product, new.version_no, new.billing_model, new.created_at)
     is distinct from
     (old.id, old.product, old.version_no, old.billing_model, old.created_at)
  then
    raise exception 'product_versions: identity and billing model are immutable';
  end if;

  if new.display_name is distinct from old.display_name
     and public.product_version_is_used(old.id) then
    raise exception 'product_versions: display name is immutable once the version has been sold';
  end if;

  -- Lifecycle is one-way: draft -> active -> retired. Retirement is final;
  -- selling changed benefits or pricing requires a NEW version.
  if new.status is distinct from old.status then
    if not (
         (old.status = 'draft'  and new.status = 'active')
      or (old.status = 'active' and new.status = 'retired')
    ) then
      raise exception 'product_versions: illegal status transition % -> %', old.status, new.status;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger product_versions_before_update
  before update on public.product_versions
  for each row execute function public.product_versions_before_update();


-- ── 3. product_version_benefits — exactly what a version grants ──────────────
-- benefit_kind is a server-derived copy of benefit_types.kind, tied by a
-- composite FK, so the quantity rule below is a plain declarative CHECK:
--   consumable -> quantity > 0
--   lifetime   -> quantity is null   (no fake "quantity 1 forever")
create table public.product_version_benefits (
  product_version_id  uuid        not null,
  benefit_type        text        not null,
  benefit_kind        text        not null,
  quantity            integer,
  created_at          timestamptz not null default now(),

  constraint product_version_benefits_pkey primary key (product_version_id, benefit_type),
  constraint product_version_benefits_version_fkey foreign key (product_version_id)
    references public.product_versions (id) on update restrict on delete restrict,
  constraint product_version_benefits_type_fkey foreign key (benefit_type, benefit_kind)
    references public.benefit_types (code, kind) on update restrict on delete restrict,
  constraint product_version_benefits_quantity_matches_kind
    check ((benefit_kind = 'consumable' and quantity is not null and quantity > 0)
        or (benefit_kind = 'lifetime'   and quantity is null))
);

comment on table public.product_version_benefits is
  'Benefit lines of a product version. Immutable once the version has been sold. No client access.';

-- Derives benefit_kind from the registry (callers never pass it) and enforces
-- immutability once the version has been sold. Quantity rules are declarative.
create function public.product_version_benefits_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text;
begin
  if tg_op = 'DELETE' then
    if public.product_version_is_used(old.product_version_id) then
      raise exception 'product_version_benefits: benefits are immutable once the version has been sold';
    end if;
    return old;
  end if;

  if public.product_version_is_used(new.product_version_id) then
    raise exception 'product_version_benefits: benefits are immutable once the version has been sold';
  end if;

  if tg_op = 'UPDATE' and public.product_version_is_used(old.product_version_id) then
    raise exception 'product_version_benefits: benefits are immutable once the version has been sold';
  end if;

  select bt.kind into v_kind
    from public.benefit_types bt
   where bt.code = new.benefit_type;

  if not found then
    raise exception 'product_version_benefits: unknown benefit type %', new.benefit_type;
  end if;

  -- Server-derived: anything the caller supplied here is replaced.
  new.benefit_kind := v_kind;

  return new;
end;
$$;

create trigger product_version_benefits_guard
  before insert or update or delete on public.product_version_benefits
  for each row execute function public.product_version_benefits_guard();


-- ── 4. payment_routes: price a specific product version ──────────────────────
-- payment_routes is empty, so the column is added NOT NULL with no backfill.
alter table public.payment_routes
  add column product_version_id uuid not null;

alter table public.payment_routes
  add constraint payment_routes_product_version_fkey
    foreign key (product_version_id, product)
    references public.product_versions (id, product)
    on update restrict on delete restrict;

-- Same guard as before, plus product_version_id in the immutable set.
-- Legacy coins_to_grant / creates_generation stay frozen and unused.
create or replace function public.payment_routes_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only activation state may change on an existing route.
  if (new.id, new.market, new.product, new.provider, new.amount_cents, new.currency,
      new.coins_to_grant, new.creates_generation, new.discount_allowed, new.created_at,
      new.product_version_id)
     is distinct from
     (old.id, old.market, old.product, old.provider, old.amount_cents, old.currency,
      old.coins_to_grant, old.creates_generation, old.discount_allowed, old.created_at,
      old.product_version_id)
  then
    raise exception 'payment_routes: financial fields are immutable; create a new route instead';
  end if;

  new.updated_at := now();
  return new;
end;
$$;


-- ── 5. payment_orders: freeze the version and its benefits ───────────────────
-- payment_orders is empty, so both columns are added NOT NULL with no backfill.
alter table public.payment_orders
  add column product_version_id uuid    not null,
  add column benefits_snapshot  jsonb   not null;

alter table public.payment_orders
  add constraint payment_orders_product_version_fkey
    foreign key (product_version_id, product)
    references public.product_versions (id, product)
    on update restrict on delete restrict,
  add constraint payment_orders_benefits_snapshot_shape
    check (jsonb_typeof(benefits_snapshot) = 'array'
           and jsonb_array_length(benefits_snapshot) >= 1);

-- The legacy route flag no longer decides whether a generation may be linked;
-- the frozen benefit set does. creates_generation itself is left untouched.
alter table public.payment_orders
  drop constraint payment_orders_generation_requires_flag;

alter table public.payment_orders
  add constraint payment_orders_generation_requires_benefit
    check (generation_id is null
           or benefits_snapshot @> '[{"benefit_type": "cv_generation"}]'::jsonb);

-- "Used" = at least one payment order froze this version. After that nothing
-- that describes what was sold may change; only the lifecycle status moves.
-- Defined here, after payment_orders.product_version_id exists, because a SQL
-- function body is validated at creation time (check_function_bodies = on).
create function public.product_version_is_used(p_product_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payment_orders o
     where o.product_version_id = p_product_version_id
  );
$$;

revoke all on function public.product_version_is_used(uuid) from public, anon, authenticated;


-- ── 6. invoices: freeze the version and its display name ─────────────────────
-- invoices is empty, so both columns are added NOT NULL with no backfill.
alter table public.invoices
  add column product_version_id   uuid not null,
  add column product_display_name text not null;

alter table public.invoices
  add constraint invoices_product_version_fkey
    foreign key (product_version_id, product)
    references public.product_versions (id, product)
    on update restrict on delete restrict,
  add constraint invoices_product_display_name_nonblank
    check (length(btrim(product_display_name)) between 1 and 120);


-- ── 7. entitlements — server-authoritative record of what a user may use ─────
-- No FK to users/auth.users: entitlements are retained audit records, like
-- payment_orders and invoices, and must survive account deletion policy.
-- benefit_kind is a server-derived copy of benefit_types.kind (composite FK),
-- which makes the consumable/lifetime invariants declarative CHECKs.
create table public.entitlements (
  id                 uuid        not null default gen_random_uuid(),
  user_id            uuid        not null,
  benefit_type       text        not null,
  benefit_kind       text        not null,
  source_type        text        not null,
  source_id          uuid        not null,
  quantity_granted   integer,
  quantity_consumed  integer     not null default 0,
  status             text        not null default 'active',
  granted_at         timestamptz not null default now(),
  expires_at         timestamptz,
  revoked_at         timestamptz,
  revoke_reason      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint entitlements_pkey primary key (id),
  constraint entitlements_benefit_type_fkey foreign key (benefit_type, benefit_kind)
    references public.benefit_types (code, kind) on update restrict on delete restrict,
  -- One grant per (source, benefit): replaying a webhook grants nothing extra.
  constraint entitlements_source_benefit_unique unique (source_type, source_id, benefit_type),
  constraint entitlements_source_type_valid
    check (source_type in ('payment_order', 'legacy_order_generation', 'admin_grant')),
  constraint entitlements_status_valid
    check (status in ('active', 'exhausted', 'revoked')),
  constraint entitlements_quantity_consumed_nonnegative check (quantity_consumed >= 0),
  -- The financial boundary, enforced declaratively on INSERT and UPDATE:
  --   consumable : positive granted quantity, consumption never exceeds it
  --   lifetime   : no quantity, never consumed, never expires
  constraint entitlements_quantity_matches_kind
    check ((benefit_kind = 'consumable'
            and quantity_granted is not null
            and quantity_granted > 0
            and quantity_consumed <= quantity_granted)
        or (benefit_kind = 'lifetime'
            and quantity_granted is null
            and quantity_consumed = 0
            and expires_at is null)),
  constraint entitlements_revoked_shape
    check ((status = 'revoked') = (revoked_at is not null)),
  constraint entitlements_revoke_reason_nonblank
    check (revoke_reason is null or length(btrim(revoke_reason)) between 1 and 200)
);

create index entitlements_user_benefit_idx
  on public.entitlements (user_id, benefit_type)
  where status = 'active';

create index entitlements_source_idx on public.entitlements (source_type, source_id);

comment on table public.entitlements is
  'Server-granted entitlements. Owners may read their own; only the server writes.';

-- Derives benefit_kind and pins the starting state. Quantity semantics are
-- enforced by entitlements_quantity_matches_kind, not here.
create function public.entitlements_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text;
begin
  select bt.kind into v_kind
    from public.benefit_types bt
   where bt.code = new.benefit_type;

  if not found then
    raise exception 'entitlements: unknown benefit type %', new.benefit_type;
  end if;

  -- Server-derived: anything the caller supplied here is replaced.
  new.benefit_kind := v_kind;

  if new.quantity_consumed <> 0 then
    raise exception 'entitlements: quantity_consumed must start at 0';
  end if;

  if new.status <> 'active' then
    raise exception 'entitlements: new entitlements must be active';
  end if;

  new.granted_at := now();
  new.created_at := new.granted_at;
  new.updated_at := new.granted_at;

  return new;
end;
$$;

create trigger entitlements_before_insert
  before insert on public.entitlements
  for each row execute function public.entitlements_before_insert();

create function public.entitlements_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Identity, source and granted amount are frozen for audit.
  if (new.id, new.user_id, new.benefit_type, new.benefit_kind, new.source_type,
      new.source_id, new.quantity_granted, new.granted_at, new.created_at)
     is distinct from
     (old.id, old.user_id, old.benefit_type, old.benefit_kind, old.source_type,
      old.source_id, old.quantity_granted, old.granted_at, old.created_at)
  then
    raise exception 'entitlements: identity and grant fields are immutable';
  end if;

  if new.quantity_consumed < old.quantity_consumed then
    raise exception 'entitlements: quantity_consumed can only increase';
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'active'    and new.status in ('exhausted', 'revoked'))
      or (old.status = 'exhausted' and new.status = 'revoked')
    ) then
      raise exception 'entitlements: illegal status transition % -> %', old.status, new.status;
    end if;
  end if;

  if old.status = 'revoked' and new.quantity_consumed <> old.quantity_consumed then
    raise exception 'entitlements: a revoked entitlement cannot be consumed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger entitlements_before_update
  before update on public.entitlements
  for each row execute function public.entitlements_before_update();

create function public.entitlements_before_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'entitlements: entitlements are audit records and cannot be deleted';
end;
$$;

create trigger entitlements_before_delete
  before delete on public.entitlements
  for each row execute function public.entitlements_before_delete();


-- ── 8. entitlement_consumptions — append-only record of every use ────────────
create table public.entitlement_consumptions (
  id                uuid        not null default gen_random_uuid(),
  entitlement_id    uuid        not null,
  user_id           uuid        not null,
  consumed_for_type text        not null,
  consumed_for_id   uuid        not null,
  quantity          integer     not null default 1,
  created_at        timestamptz not null default now(),

  constraint entitlement_consumptions_pkey primary key (id),
  constraint entitlement_consumptions_entitlement_fkey foreign key (entitlement_id)
    references public.entitlements (id) on update restrict on delete restrict,
  -- Replay safety: the same target can never consume the same entitlement twice.
  constraint entitlement_consumptions_target_unique
    unique (entitlement_id, consumed_for_type, consumed_for_id),
  constraint entitlement_consumptions_target_type_valid
    check (consumed_for_type in ('generation_job')),
  constraint entitlement_consumptions_quantity_positive check (quantity > 0)
);

create index entitlement_consumptions_entitlement_idx
  on public.entitlement_consumptions (entitlement_id);

comment on table public.entitlement_consumptions is
  'Append-only consumption ledger. Advances entitlements.quantity_consumed. No client access.';

-- Consumption is only valid against a live, sufficient, consumable entitlement,
-- and the counter is advanced here so it can never drift from the ledger.
create function public.entitlement_consumptions_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ent public.entitlements%rowtype;
begin
  select * into v_ent
    from public.entitlements
   where id = new.entitlement_id
   for update;

  if not found then
    raise exception 'entitlement_consumptions: entitlement not found';
  end if;

  if v_ent.user_id is distinct from new.user_id then
    raise exception 'entitlement_consumptions: entitlement belongs to another user';
  end if;

  if v_ent.status <> 'active' then
    raise exception 'entitlement_consumptions: entitlement is %', v_ent.status;
  end if;

  if v_ent.expires_at is not null and v_ent.expires_at <= now() then
    raise exception 'entitlement_consumptions: entitlement has expired';
  end if;

  if v_ent.benefit_kind <> 'consumable' then
    raise exception 'entitlement_consumptions: benefit % is not consumable', v_ent.benefit_type;
  end if;

  if v_ent.quantity_consumed + new.quantity > v_ent.quantity_granted then
    raise exception 'entitlement_consumptions: insufficient remaining quantity';
  end if;

  update public.entitlements
     set quantity_consumed = v_ent.quantity_consumed + new.quantity,
         status = case
                    when v_ent.quantity_consumed + new.quantity >= v_ent.quantity_granted
                    then 'exhausted' else v_ent.status
                  end
   where id = v_ent.id;

  new.created_at := now();
  return new;
end;
$$;

create trigger entitlement_consumptions_before_insert
  before insert on public.entitlement_consumptions
  for each row execute function public.entitlement_consumptions_before_insert();

create function public.entitlement_consumptions_prevent_modification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'entitlement_consumptions: the consumption ledger is append-only';
end;
$$;

create trigger entitlement_consumptions_prevent_update
  before update on public.entitlement_consumptions
  for each row execute function public.entitlement_consumptions_prevent_modification();

create trigger entitlement_consumptions_prevent_delete
  before delete on public.entitlement_consumptions
  for each row execute function public.entitlement_consumptions_prevent_modification();

create trigger entitlement_consumptions_prevent_truncate
  before truncate on public.entitlement_consumptions
  for each statement execute function public.entitlement_consumptions_prevent_modification();


-- ── 9. Read helpers ──────────────────────────────────────────────────────────
-- The single definition of "does this user currently hold this benefit".
-- SECURITY DEFINER so server-side definer functions (e.g. get_public_profile in
-- a later step) can ask without granting clients read access to other users.
create function public.has_entitlement(p_user_id uuid, p_benefit_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.entitlements e
     where e.user_id = p_user_id
       and e.benefit_type = p_benefit_type
       and e.status = 'active'
       and (e.expires_at is null or e.expires_at > now())
       and (e.quantity_granted is null or e.quantity_consumed < e.quantity_granted)
  );
$$;

revoke all on function public.has_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function public.has_entitlement(uuid, text) to service_role;

-- Owner-scoped read for the app. SECURITY INVOKER: it relies on RLS below.
create function public.get_my_entitlements()
returns table (
  benefit_type       text,
  kind               text,
  status             text,
  quantity_granted   integer,
  quantity_consumed  integer,
  quantity_remaining integer,
  granted_at         timestamptz,
  expires_at         timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.benefit_type,
         e.benefit_kind,
         e.status,
         e.quantity_granted,
         e.quantity_consumed,
         case when e.quantity_granted is null then null
              else e.quantity_granted - e.quantity_consumed end,
         e.granted_at,
         e.expires_at
    from public.entitlements e
   where e.user_id = (select auth.uid())
   order by e.granted_at desc;
$$;

revoke all on function public.get_my_entitlements() from public, anon;
grant execute on function public.get_my_entitlements() to authenticated, service_role;


-- ── 10. RLS + privileges ─────────────────────────────────────────────────────
alter table public.benefit_types             enable row level security;
alter table public.product_versions          enable row level security;
alter table public.product_version_benefits  enable row level security;
alter table public.entitlements              enable row level security;
alter table public.entitlement_consumptions  enable row level security;

-- Catalog tables: RLS on with no policies → no anon/authenticated access at all.
-- Project default ACLs grant ALL on new public tables to anon/authenticated.
revoke all on table
  public.benefit_types,
  public.product_versions,
  public.product_version_benefits,
  public.entitlements,
  public.entitlement_consumptions
from public, anon, authenticated, service_role;

-- The server reads the catalog when creating orders; catalog writes stay with
-- migrations (table owner) so no key in circulation can change what is sold.
grant select on table
  public.benefit_types,
  public.product_versions,
  public.product_version_benefits
to service_role;

-- Fulfilment (step 2) grants and updates entitlements and appends consumptions.
grant select, insert, update on table public.entitlements to service_role;
grant select, insert on table public.entitlement_consumptions to service_role;

-- Owners may read their own entitlements (used by get_my_entitlements).
grant select on table public.entitlements to authenticated;

create policy entitlements_select_own
  on public.entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Defensive assertion of the existing invariant: clients never write payment
-- state. These are NO-OPS against the live schema (verified: anon and
-- authenticated already hold no write privilege on any of these tables, and no
-- column-level write grants exist); they are stated here so the guarantee is
-- explicit in the migration history and survives a stray future grant.
revoke insert, update, delete, truncate on table
  public.payment_routes,
  public.payment_orders,
  public.invoices,
  public.payment_products,
  public.payment_markets,
  public.payment_providers,
  public.market_countries,
  public.invoice_number_counter
from anon, authenticated;

revoke all on function public.product_versions_before_update()            from public, anon, authenticated;
revoke all on function public.product_version_benefits_guard()            from public, anon, authenticated;
revoke all on function public.benefit_types_before_update()               from public, anon, authenticated;
revoke all on function public.entitlements_before_insert()                from public, anon, authenticated;
revoke all on function public.entitlements_before_update()                from public, anon, authenticated;
revoke all on function public.entitlements_before_delete()                from public, anon, authenticated;
revoke all on function public.entitlement_consumptions_before_insert()    from public, anon, authenticated;
revoke all on function public.entitlement_consumptions_prevent_modification() from public, anon, authenticated;


-- ── 11. payment_orders insert validation: freeze version + benefits ──────────
-- Identical to the applied version, plus: the product version must be active
-- and is taken from the route, and the benefit snapshot is built server-side.
-- Anything the caller supplied in product_version_id / benefits_snapshot is
-- overwritten, never trusted.
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
  v_version          public.product_versions%rowtype;
  v_benefits         jsonb;
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

  -- Product version and benefits are server configuration, never caller input.
  select * into v_version
    from public.product_versions
   where id = v_route.product_version_id;

  if not found or v_version.status <> 'active' then
    raise exception 'payment_orders: product version missing or not active';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_strip_nulls(
               jsonb_build_object('benefit_type', b.benefit_type, 'quantity', b.quantity)
             )
             order by b.benefit_type
           ),
           '[]'::jsonb
         )
    into v_benefits
    from public.product_version_benefits b
   where b.product_version_id = v_version.id;

  if jsonb_array_length(v_benefits) < 1 then
    raise exception 'payment_orders: product version has no benefits';
  end if;

  new.product_version_id := v_version.id;
  new.benefits_snapshot  := v_benefits;

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


-- ── 12. payment_orders update guard: version + benefits are frozen ───────────
-- Identical to the applied version, plus product_version_id and
-- benefits_snapshot in the frozen field set.
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
      new.product_version_id, new.benefits_snapshot,
      new.customer_email_snapshot, new.customer_first_name_snapshot,
      new.customer_last_name_snapshot, new.customer_username_snapshot)
     is distinct from
     (old.id, old.user_id, old.product, old.form_id, old.submission_id, old.market,
      old.provider, old.route_id, old.region_snapshot, old.region_status_snapshot,
      old.amount_cents, old.currency, old.coins_to_grant, old.creates_generation,
      old.discount_applied, old.created_at, old.expires_at, old.payment_environment,
      old.product_version_id, old.benefits_snapshot,
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


-- ── 13. invoices issuance: also freeze the version and its display name ──────
-- Identical to the applied version, plus product_version_id and
-- product_display_name are derived here and rejected if supplied.
create or replace function public.invoices_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.payment_orders%rowtype;
  v_number  bigint;
  v_name    text;
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
     or new.product_version_id is not null
     or new.product_display_name is not null
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

  select pv.display_name into v_name
    from public.product_versions pv
   where pv.id = v_order.product_version_id;

  if v_name is null then
    raise exception 'invoices: product version missing for payment order %', new.payment_order_id;
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
  new.product_version_id       := v_order.product_version_id;
  new.product_display_name     := v_name;
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


-- ── 14. Seed: first product, DRAFT version, INACTIVE routes ──────────────────
-- Nothing here can be purchased: the product is inactive, the version is draft,
-- both markets are inactive, both providers are inactive and test-environment,
-- and both routes are inactive.
insert into public.payment_products (product, requires_form, active) values
  ('career_package', true, false)
on conflict (product) do nothing;

-- Lebanon market + country mapping (EG already exists; GLOBAL stays default).
insert into public.payment_markets (market, active, allow_flagged, is_default) values
  ('LB', false, false, false)
on conflict (market) do nothing;

insert into public.market_countries (country_iso2, market) values
  ('LB', 'LB')
on conflict (country_iso2) do nothing;

-- benefit_kind is supplied explicitly and correctly; the guard trigger still
-- re-derives it from benefit_types as defense-in-depth.
with v as (
  insert into public.product_versions (product, version_no, display_name, billing_model, status)
  values ('career_package', 1, 'Career Package', 'one_time', 'draft')
  returning id
)
insert into public.product_version_benefits (product_version_id, benefit_type, benefit_kind, quantity)
select v.id, b.benefit_type, b.benefit_kind, b.quantity
  from v
  cross join (values
    ('cv_generation',           'consumable', 1),
    ('cover_letter_generation', 'consumable', 1),
    ('professional_profile',    'lifetime',   null::integer),
    ('profile_qr',              'lifetime',   null::integer)
  ) as b(benefit_type, benefit_kind, quantity);

-- Egypt 150 EGP via Paymob, Lebanon 25 USD via WishMoney. Both INACTIVE.
insert into public.payment_routes (
  market, product, provider, product_version_id,
  amount_cents, currency, coins_to_grant, creates_generation, discount_allowed, active
)
select r.market, 'career_package', r.provider, pv.id,
       r.amount_cents, r.currency, 0, false, false, false
  from public.product_versions pv
  cross join (values
    ('EG', 'paymob',    15000, 'EGP'),
    ('LB', 'wishmoney',  2500, 'USD')
  ) as r(market, provider, amount_cents, currency)
 where pv.product = 'career_package' and pv.version_no = 1;
