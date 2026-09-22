-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 3 · STEP 3C — Enqueue the generation job inside settlement
--
-- Replaces public.settle_payment_order (same signature, same return shape,
-- same privileges). The ONLY behavioural change: when the order's FROZEN
-- benefits snapshot grants BOTH cv_generation and cover_letter_generation,
-- the first successful settlement also inserts exactly one queued
-- public.generation_jobs row, in the same transaction as the paid status,
-- the entitlements, the invoice and the fulfilment marker.
--
--   verified callback → order paid → entitlements → invoice
--                     → generation job (queued) → fulfilled_at → COMMIT
--
-- Any failure to enqueue raises, so the whole settlement rolls back.
--
-- Unchanged on purpose:
--   * every provider / environment / money / reference / state check;
--   * the replay branch (section 5) stays READ ONLY. It neither requires nor
--     creates a job, so orders settled before this migration (which have no
--     job) keep replaying as 'already_settled'. Historical backfill, if
--     wanted, is a separate deliberate operation;
--   * the jsonb result shape, so webhook-paymob needs no change.
--
-- Job inputs come only from the canonical order; the generation_jobs insert
-- trigger re-derives and validates them (paid order, both generation
-- benefits, frozen form/submission/language).
--
-- Replaces ONE function. No table, column, constraint, trigger, policy or
-- grant is altered.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.settle_payment_order(
  p_provider                 text,
  p_provider_order_ref       text,
  p_provider_transaction_ref text,
  p_amount_cents             integer,
  p_currency                 text,
  p_success                  boolean,
  p_pending                  boolean,
  p_error_occured            boolean,
  p_is_refunded              boolean,
  p_is_voided                boolean,
  p_integration_id           text,
  p_expected_environment     text,
  p_payment_method           text,
  p_payment_subtype          text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order         public.payment_orders%rowtype;
  v_txn_ref       text;
  v_currency      text;
  v_method        text;
  v_subtype       text;
  v_missing       integer;
  v_wrong         integer;
  v_unexpected    integer;
  v_duplicates    integer;
  v_bad_quantity  integer;
  v_pre_existing  integer;
  v_invoices      integer;
  v_requires_job  boolean;
  v_existing_jobs integer;
begin
  -- ── 1. Argument shape ──────────────────────────────────────────────────────
  -- A violation here is a fault in OUR caller, not a provider condition, so it
  -- raises: the whole transaction rolls back and the callback can be retried.
  if p_provider is null or length(btrim(p_provider)) = 0 then
    raise exception 'settle_payment_order: provider is required';
  end if;

  if p_provider_order_ref is null or length(btrim(p_provider_order_ref)) = 0 then
    raise exception 'settle_payment_order: provider order reference is required';
  end if;

  if p_provider_transaction_ref is null
     or length(btrim(p_provider_transaction_ref)) not between 1 and 255 then
    raise exception 'settle_payment_order: provider transaction reference is required';
  end if;

  -- Canonicalised ONCE. Every later comparison and the stored value use this
  -- single form, so a padded reference can never look like a different
  -- transaction. Trimming transport whitespace is the only change made; the
  -- reference's meaning is untouched.
  v_txn_ref := btrim(p_provider_transaction_ref);

  -- Environment is a deployment fact supplied by trusted server configuration.
  -- It is never read from, or defaulted by, the provider payload.
  if p_expected_environment is null or p_expected_environment not in ('test', 'live') then
    raise exception 'settle_payment_order: expected environment must be test or live';
  end if;

  -- A missing integration id is malformed provider evidence, not a transient
  -- fault: it is deterministic, so it returns an outcome rather than raising.
  -- The allowed-integration SET for this environment is enforced by the caller,
  -- which holds that configuration. No column exists to record the id, so it is
  -- validated for presence here and deliberately not persisted.
  if p_integration_id is null or length(btrim(p_integration_id)) = 0 then
    return jsonb_build_object(
      'outcome', 'rejected_integration_mismatch', 'payment_order_id', null, 'retryable', false);
  end if;

  -- ── 2. Provider-state gate ─────────────────────────────────────────────────
  -- Evaluated before any row is touched. A normal successful card sale reports
  -- is_auth = false and is_capture = false, so neither may appear here.
  --
  -- FAIL CLOSED: every one of these five facts must be EXPLICITLY the safe
  -- value. `is distinct from` means NULL never satisfies a predicate — an
  -- unreadable provider fact is treated exactly like the unsafe value.
  -- Settlement continues only when:
  --   success = true, error_occured = false, pending = false,
  --   is_refunded = false, is_voided = false.
  if p_success is distinct from true or p_error_occured is distinct from false then
    return jsonb_build_object(
      'outcome', 'ignored_unsuccessful', 'payment_order_id', null, 'retryable', false);
  end if;

  if p_pending is distinct from false then
    return jsonb_build_object(
      'outcome', 'ignored_pending', 'payment_order_id', null, 'retryable', false);
  end if;

  if p_is_refunded is distinct from false or p_is_voided is distinct from false then
    return jsonb_build_object(
      'outcome', 'ignored_reversal', 'payment_order_id', null, 'retryable', false);
  end if;

  -- ── 3. Locate and lock the canonical order ─────────────────────────────────
  -- Correlation is by the provider's SIGNED order reference only. The lock is
  -- the single serialization point for concurrent deliveries; invoices_before_
  -- insert re-locks this same row later in this transaction, which is a no-op.
  select * into v_order
    from public.payment_orders
   where provider = p_provider
     and provider_order_ref = p_provider_order_ref
   for update;

  if not found then
    return jsonb_build_object(
      'outcome', 'order_not_found', 'payment_order_id', null, 'retryable', false);
  end if;

  -- ── 4. Environment and provider identity ───────────────────────────────────
  -- payment_environment was frozen at creation from payment_providers, i.e.
  -- database-side configuration. p_expected_environment comes from function-side
  -- configuration. Disagreement means the two halves of the deployment disagree.
  if v_order.payment_environment is distinct from p_expected_environment then
    return jsonb_build_object(
      'outcome', 'rejected_environment_mismatch',
      'payment_order_id', v_order.id, 'retryable', false);
  end if;

  -- Defence in depth: the lookup above already filters on provider, so this can
  -- only fire if that predicate is ever changed. Its outcome is distinct from
  -- the integration check so the two faults never blur in alerting.
  if v_order.provider is distinct from p_provider then
    return jsonb_build_object(
      'outcome', 'rejected_provider_mismatch',
      'payment_order_id', v_order.id, 'retryable', false);
  end if;

  -- ── 5. Idempotency and status branch ───────────────────────────────────────
  if v_order.status = 'paid' then

    if v_order.provider_transaction_ref is distinct from v_txn_ref then
      -- A second, different successful transaction against one order. Possible
      -- double charge; never silently absorbed.
      return jsonb_build_object(
        'outcome', 'conflict_other_transaction',
        'payment_order_id', v_order.id, 'retryable', false);
    end if;

    -- Replay of the same transaction: verify that fulfilment actually completed.
    -- READ ONLY. Nothing below writes, and nothing is repaired.
    with expected as (
      select distinct
             e ->> 'benefit_type'          as benefit_type,
             nullif(e ->> 'quantity', '')::integer as quantity
        from jsonb_array_elements(v_order.benefits_snapshot) e
    )
    select
      count(*) filter (where ent.id is null),
      count(*) filter (
        where ent.id is not null
          and not (
            case
              when bt.kind = 'consumable'
                then ent.quantity_granted is not distinct from snap.quantity
              when bt.kind = 'lifetime'
                then ent.quantity_granted is null and ent.expires_at is null
              else false
            end
          )
      )
      into v_missing, v_wrong
      from expected snap
      left join public.benefit_types bt
             on bt.code = snap.benefit_type
      left join public.entitlements ent
             on ent.source_type = 'payment_order'
            and ent.source_id   = v_order.id
            and ent.benefit_type = snap.benefit_type;

    -- Any entitlement attributed to this order that the frozen snapshot does
    -- not call for.
    with expected as (
      select distinct e ->> 'benefit_type' as benefit_type
        from jsonb_array_elements(v_order.benefits_snapshot) e
    )
    select count(*)
      into v_unexpected
      from public.entitlements ent
     where ent.source_type = 'payment_order'
       and ent.source_id   = v_order.id
       and not exists (select 1 from expected snap where snap.benefit_type = ent.benefit_type);

    select count(*) into v_invoices
      from public.invoices i
     where i.payment_order_id = v_order.id;

    -- Entitlement status and quantity_consumed are deliberately NOT considered:
    -- 'exhausted' is normal consumption and 'revoked' is an admin decision.
    -- Neither is a defect in fulfilment.
    if v_missing = 0
       and v_wrong = 0
       and v_unexpected = 0
       and v_invoices = 1
       and v_order.fulfilled_at is not null then
      return jsonb_build_object(
        'outcome', 'already_settled',
        'payment_order_id', v_order.id, 'retryable', false);
    end if;

    -- Unreachable through this function, because settlement is atomic. It can
    -- only follow out-of-band intervention or a future defect, so it is
    -- reported for a human and never self-healed.
    return jsonb_build_object(
      'outcome', 'inconsistent_settlement',
      'payment_order_id', v_order.id, 'retryable', false);
  end if;

  -- A single positive allow-list. It covers 'refunded' and 'cancelled' today and
  -- stays fail-closed if a new status is ever added to the CHECK constraint.
  --
  -- Late payment is explicitly honoured: 'expired' (and 'failed') may settle.
  -- The money was actually taken, expires_at governs how long a checkout stays
  -- offerable, and the frozen price still binds the amount.
  if v_order.status not in ('pending', 'failed', 'expired') then
    return jsonb_build_object(
      'outcome', 'conflict_terminal_status',
      'payment_order_id', v_order.id, 'retryable', false);
  end if;

  -- ── 6. Money must match the frozen order exactly ───────────────────────────
  if p_amount_cents is null or p_amount_cents <> v_order.amount_cents then
    return jsonb_build_object(
      'outcome', 'rejected_amount_mismatch',
      'payment_order_id', v_order.id, 'retryable', false);
  end if;

  -- Transport whitespace is trimmed; the value is NOT case-normalised. A
  -- provider-reported financial field is compared and stored exactly as sent.
  v_currency := btrim(coalesce(p_currency, ''));
  if v_currency !~ '^[A-Z]{3}$' or v_currency <> v_order.currency then
    return jsonb_build_object(
      'outcome', 'rejected_currency_mismatch',
      'payment_order_id', v_order.id, 'retryable', false);
  end if;

  -- ── 7. Secondary evidence, normalised to the existing column constraints ───
  -- Evidence is subordinate to the money: an unusable value degrades to NULL
  -- and must never fail a financially valid settlement.
  v_method := lower(btrim(coalesce(p_payment_method, '')));
  v_method := regexp_replace(v_method, '[^a-z0-9_]+', '_', 'g');
  v_method := left(v_method, 32);
  if v_method !~ '^[a-z][a-z0-9_]{0,31}$' then
    v_method := null;
  end if;

  v_subtype := btrim(left(btrim(coalesce(p_payment_subtype, '')), 64));
  if length(v_subtype) = 0 then
    v_subtype := null;
  end if;

  -- ── 8. Pre-write integrity guards ──────────────────────────────────────────
  -- Every reason to refuse is established BEFORE the first write, so a corrupt
  -- snapshot or a pre-existing entitlement costs zero writes instead of a
  -- rollback. Each of these conditions is impossible in a healthy database;
  -- meeting one means the data is corrupt, so the RPC refuses rather than
  -- guessing what the buyer should receive.

  -- Each benefit_type must appear exactly once. Duplicates would make the
  -- granted quantity depend on row order.
  select count(*) - count(distinct e ->> 'benefit_type')
    into v_duplicates
    from jsonb_array_elements(v_order.benefits_snapshot) e;

  if v_duplicates <> 0 then
    raise exception
      'settle_payment_order: benefits snapshot has duplicate benefit types for order %',
      v_order.id;
  end if;

  -- Every benefit must be projectable: a known kind, a positive quantity when
  -- consumable, and no quantity when lifetime. Kind comes from benefit_types,
  -- never from the shape of the JSON.
  with expected as (
    select e ->> 'benefit_type'                  as benefit_type,
           nullif(e ->> 'quantity', '')::integer as quantity
      from jsonb_array_elements(v_order.benefits_snapshot) e
  )
  select count(*)
    into v_bad_quantity
    from expected snap
    left join public.benefit_types bt on bt.code = snap.benefit_type
   where bt.kind is null
      or (bt.kind = 'consumable' and coalesce(snap.quantity, 0) <= 0)
      or (bt.kind = 'lifetime'   and snap.quantity is not null);

  if v_bad_quantity > 0 then
    raise exception 'settle_payment_order: benefits snapshot is not projectable for order %',
      v_order.id;
  end if;

  -- An order that has never been paid must carry no entitlements. A pre-existing
  -- row would otherwise be silently blessed by the projection below.
  select count(*)
    into v_pre_existing
    from public.entitlements ent
   where ent.source_type = 'payment_order'
     and ent.source_id   = v_order.id;

  if v_pre_existing > 0 then
    raise exception
      'settle_payment_order: unpaid order % already carries entitlements', v_order.id;
  end if;

  -- A generation job is required exactly when the FROZEN snapshot grants both
  -- generation benefits. Never from the product name, the live catalog, the
  -- caller or the user's current state.
  v_requires_job :=
        v_order.benefits_snapshot @> '[{"benefit_type": "cv_generation"}]'::jsonb
    and v_order.benefits_snapshot @> '[{"benefit_type": "cover_letter_generation"}]'::jsonb;

  if v_requires_job then
    -- The job's inputs must already be frozen on the order. Refused here, before
    -- any write, rather than failing half way through settlement.
    if v_order.form_id is null
       or v_order.submission_id is null
       or v_order.selected_language is null then
      raise exception
        'settle_payment_order: order % requires a generation job but has no frozen form, submission or language',
        v_order.id;
    end if;

    -- An unpaid order can never have a job (generation_jobs_before_insert
    -- requires a paid order), so one existing here means corrupt data.
    select count(*)
      into v_existing_jobs
      from public.generation_jobs g
     where g.payment_order_id = v_order.id;

    if v_existing_jobs > 0 then
      raise exception
        'settle_payment_order: unpaid order % already has a generation job', v_order.id;
    end if;
  end if;

  -- ── 9. Settle ──────────────────────────────────────────────────────────────
  -- Status and evidence move in ONE statement so payment_orders_before_update
  -- sees a paid row. paid_amount_cents/paid_currency carry the PROVIDER's
  -- signed values, which is what makes payment_orders_paid_matches_frozen_price
  -- a real comparison rather than a tautology.
  -- provider_masked_identifier stays NULL: no PAN ever enters this function.
  begin
    update public.payment_orders
       set status                   = 'paid',
           paid_at                  = now(),
           provider_transaction_ref = v_txn_ref,
           paid_amount_cents        = p_amount_cents,
           paid_currency            = v_currency,
           provider_payment_method  = v_method,
           provider_payment_subtype = v_subtype
     where id = v_order.id;
  exception when unique_violation then
    -- Of the five unique indexes on payment_orders, this statement can only
    -- violate payment_orders_provider_transaction_ref_unique: it is the sole
    -- index whose columns it writes. So this means the provider transaction
    -- already settled a DIFFERENT order. The subtransaction rolls back and
    -- nothing was written before it, so no partial settlement survives.
    return jsonb_build_object(
      'outcome', 'conflict_transaction_reused',
      'payment_order_id', v_order.id, 'retryable', false);
  end;

  -- ── 10. Project the frozen benefits snapshot into entitlements ─────────────
  -- Section 8 proved there is nothing to conflict with, so these inserts are
  -- expected to succeed. No ON CONFLICT: a surprise conflict must abort the
  -- whole settlement rather than quietly keep somebody else's row.
  with expected as (
    select e ->> 'benefit_type'                  as benefit_type,
           nullif(e ->> 'quantity', '')::integer as quantity
      from jsonb_array_elements(v_order.benefits_snapshot) e
  )
  insert into public.entitlements (
    user_id, source_type, source_id, benefit_type, benefit_kind,
    quantity_granted, expires_at
  )
  select v_order.user_id,
         'payment_order',
         v_order.id,
         snap.benefit_type,
         bt.kind,
         case when bt.kind = 'consumable' then snap.quantity else null end,
         null
    from expected snap
    join public.benefit_types bt on bt.code = snap.benefit_type;

  -- ── 11. Issue the invoice ──────────────────────────────────────────────────
  -- Only payment_order_id may be supplied; invoices_before_insert derives every
  -- other column, re-verifies the paid state and allocates the invoice number.
  --
  -- No exception handler. This order was not paid before, so no invoice can
  -- exist for it; idempotency for a replay is handled entirely by the branch at
  -- section 5, which writes nothing. Any failure here — including an unexpected
  -- unique violation — propagates and rolls back the status update, the
  -- entitlements and this statement together. An invoice error is never
  -- converted into success.
  insert into public.invoices (payment_order_id) values (v_order.id);

  -- ── 11b. Enqueue the generation job ────────────────────────────────────────
  -- The order is now paid with its entitlements and invoice in place, which is
  -- exactly what generation_jobs_before_insert validates. Every input comes
  -- from the canonical order; the trigger re-derives and cross-checks them.
  -- No exception handler and no ON CONFLICT: any failure, including an
  -- unexpected unique violation, rolls back the entire settlement.
  -- Entitlements are NOT consumed here; that happens only when a job succeeds.
  if v_requires_job then
    insert into public.generation_jobs (
      payment_order_id, user_id, form_id, submission_id, selected_language
    ) values (
      v_order.id, v_order.user_id, v_order.form_id, v_order.submission_id,
      v_order.selected_language
    );
  end if;

  -- ── 12. Fulfilment marker — only after entitlements, invoice and job ──────
  update public.payment_orders
     set fulfilled_at = now()
   where id = v_order.id
     and fulfilled_at is null;

  return jsonb_build_object(
    'outcome', 'settled',
    'payment_order_id', v_order.id, 'retryable', false);
end;
$function$;

comment on function public.settle_payment_order(
  text, text, text, integer, text, boolean, boolean, boolean, boolean, boolean,
  text, text, text, text
) is
  'Atomically settles a canonical payment order from a verified provider callback: '
  'records provider-signed payment evidence, projects the frozen benefits snapshot '
  'into entitlements, issues exactly one invoice, enqueues exactly one generation '
  'job when the frozen snapshot grants cv_generation and cover_letter_generation, '
  'and marks fulfilment. Returns a jsonb outcome; performs no repair of an '
  'already-settled order and never creates a job on replay.';

-- ── Privileges (unchanged: service_role only) ────────────────────────────────
revoke all on function public.settle_payment_order(
  text, text, text, integer, text, boolean, boolean, boolean, boolean, boolean,
  text, text, text, text
) from public, anon, authenticated;

grant execute on function public.settle_payment_order(
  text, text, text, integer, text, boolean, boolean, boolean, boolean, boolean,
  text, text, text, text
) to service_role;
