-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 3 · STEP 3A — Generation job foundation
--
-- 1. Prerequisite: payment_orders.selected_language ('en' | 'ar').
--    The chosen output language was not frozen anywhere trustworthy: the
--    legacy generator reads it from the browser request body, falling back to
--    the owner-writable cv_archive.selected_language. The column is nullable
--    (existing orders never recorded a language), may only be set at INSERT,
--    and is immutable afterwards. Populating it is create-payment's job
--    (next step); a job cannot be created for an order without it.
--
-- 2. public.generation_jobs: one durable, server-authoritative job per paid
--    Career Package order (UNIQUE payment_order_id). Frozen inputs (user,
--    form, submission, language) are copied from the payment order by the
--    insert trigger and can never change. Lifecycle:
--        queued -> running -> succeeded (terminal)
--                         \-> queued   (retry / lease recovery)
--                         \-> failed   -> queued (explicit requeue)
--        queued -> failed
--    The validated, normalized CvJsonV1 and the storage PATHS of the final
--    CV and cover letter are written only on success, together, and are then
--    immutable. Signed URLs are never stored.
--
--    Entitlement provenance needs no extra column: the order's entitlements
--    are uniquely (source_type='payment_order', source_id=payment_order_id,
--    benefit_type) and consumptions will reference
--    (consumed_for_type='generation_job', consumed_for_id=generation_jobs.id).
--
-- Browser roles: authenticated may SELECT its own rows only; anon nothing.
-- service_role: SELECT, INSERT, UPDATE. Nobody may DELETE or TRUNCATE.
--
-- Not touched: settle_payment_order, webhooks, Edge Functions, frontend.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. payment_orders.selected_language ──────────────────────────────────────
alter table public.payment_orders
  add column selected_language text;

alter table public.payment_orders
  add constraint payment_orders_selected_language_valid
  check (selected_language is null or selected_language in ('en', 'ar'));

comment on column public.payment_orders.selected_language is
  'Output language chosen at checkout (en|ar). Set only at INSERT by the '
  'server; immutable. The only language authority for generation jobs.';

create function public.payment_orders_freeze_selected_language()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.selected_language is distinct from old.selected_language then
    raise exception 'payment_orders: selected_language is immutable';
  end if;
  return new;
end;
$function$;

revoke all on function public.payment_orders_freeze_selected_language() from public, anon, authenticated;

create trigger payment_orders_freeze_selected_language
  before update on public.payment_orders
  for each row execute function public.payment_orders_freeze_selected_language();

-- ── 2. generation_jobs ───────────────────────────────────────────────────────
create table public.generation_jobs (
  id                          uuid primary key default gen_random_uuid(),
  payment_order_id            uuid not null,
  user_id                     uuid not null,
  form_id                     uuid not null,
  submission_id               text not null,
  selected_language           text not null,
  status                      text not null default 'queued',
  attempt_count               integer not null default 0,
  max_attempts                integer not null default 3,
  next_attempt_at             timestamptz not null default now(),
  lease_expires_at            timestamptz,
  last_error_code             text,
  last_error_message          text,
  cv_storage_path             text,
  cover_letter_storage_path   text,
  cv_json                     jsonb,
  cv_json_schema_version      text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  started_at                  timestamptz,
  completed_at                timestamptz,
  failed_at                   timestamptz,

  constraint generation_jobs_payment_order_unique unique (payment_order_id),
  constraint generation_jobs_payment_order_fkey
    foreign key (payment_order_id) references public.payment_orders (id)
    on update restrict on delete restrict,

  constraint generation_jobs_language_valid
    check (selected_language in ('en', 'ar')),
  constraint generation_jobs_submission_nonblank
    check (length(btrim(submission_id)) between 1 and 255),
  constraint generation_jobs_status_valid
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  constraint generation_jobs_attempts_valid
    check (max_attempts between 1 and 10 and attempt_count between 0 and max_attempts),

  -- running always holds a lease; nothing else does.
  constraint generation_jobs_lease_shape
    check ((status = 'running') = (lease_expires_at is not null)),
  constraint generation_jobs_running_started
    check (status <> 'running' or started_at is not null),

  -- Outputs exist exactly when the job succeeded, all together.
  constraint generation_jobs_succeeded_shape
    check (
      (status = 'succeeded') = (completed_at is not null)
      and (status = 'succeeded') = (cv_storage_path is not null)
      and (status = 'succeeded') = (cover_letter_storage_path is not null)
      and (status = 'succeeded') = (cv_json is not null)
      and (status = 'succeeded') = (cv_json_schema_version is not null)
    ),
  constraint generation_jobs_failed_shape
    check ((status = 'failed') = (failed_at is not null)
           and (status <> 'failed' or last_error_code is not null)),

  constraint generation_jobs_cv_json_object
    check (cv_json is null or jsonb_typeof(cv_json) = 'object'),
  constraint generation_jobs_schema_version_format
    check (cv_json_schema_version is null or cv_json_schema_version ~ '^[a-z0-9][a-z0-9._-]{0,31}$'),

  -- Storage object paths inside the owner's folder of cv-documents.
  constraint generation_jobs_cv_path_owned
    check (cv_storage_path is null
           or (cv_storage_path like user_id::text || '/%'
               and length(cv_storage_path) <= 512
               and cv_storage_path !~ '(^|/)\.\.(/|$)')),
  constraint generation_jobs_cl_path_owned
    check (cover_letter_storage_path is null
           or (cover_letter_storage_path like user_id::text || '/%'
               and length(cover_letter_storage_path) <= 512
               and cover_letter_storage_path !~ '(^|/)\.\.(/|$)')),

  constraint generation_jobs_error_code_format
    check (last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint generation_jobs_error_message_length
    check (last_error_message is null or length(last_error_message) <= 500)
);

comment on table public.generation_jobs is
  'One durable generation job per paid Career Package payment order. '
  'Server-authoritative: inputs are copied from the frozen payment order; '
  'outputs (normalized CvJsonV1 + storage paths) are written once on success '
  'and are then historical. Never stores signed URLs.';
comment on column public.generation_jobs.cv_json is
  'Validated and normalized CvJsonV1 (the authoritative generated CV). '
  'Written only together with status=succeeded.';

create index generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);
create index generation_jobs_queued_idx
  on public.generation_jobs (next_attempt_at) where status = 'queued';
create index generation_jobs_running_lease_idx
  on public.generation_jobs (lease_expires_at) where status = 'running';

-- ── Insert: inputs come from the payment order, never from the caller ────────
create function public.generation_jobs_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_order public.payment_orders%rowtype;
begin
  select * into v_order
    from public.payment_orders
   where id = new.payment_order_id
   for share;

  if not found then
    raise exception 'generation_jobs: payment order not found';
  end if;

  if v_order.status <> 'paid' or v_order.paid_at is null then
    raise exception 'generation_jobs: payment order is not paid';
  end if;

  if not (v_order.benefits_snapshot @> '[{"benefit_type": "cv_generation"}]'::jsonb
          and v_order.benefits_snapshot @> '[{"benefit_type": "cover_letter_generation"}]'::jsonb) then
    raise exception 'generation_jobs: payment order does not grant cv and cover letter generation';
  end if;

  if v_order.form_id is null or v_order.submission_id is null then
    raise exception 'generation_jobs: payment order has no frozen form/submission';
  end if;

  if v_order.selected_language is null then
    raise exception 'generation_jobs: payment order has no frozen selected_language';
  end if;

  -- Callers may omit the frozen inputs; if supplied they must match exactly.
  if (new.user_id is not null and new.user_id is distinct from v_order.user_id)
     or (new.form_id is not null and new.form_id is distinct from v_order.form_id)
     or (new.submission_id is not null and new.submission_id is distinct from v_order.submission_id)
     or (new.selected_language is not null and new.selected_language is distinct from v_order.selected_language)
  then
    raise exception 'generation_jobs: inputs do not match the payment order';
  end if;

  new.user_id           := v_order.user_id;
  new.form_id           := v_order.form_id;
  new.submission_id     := v_order.submission_id;
  new.selected_language := v_order.selected_language;

  -- A job is born queued and empty.
  if new.status is distinct from 'queued'
     or new.attempt_count is distinct from 0
     or new.lease_expires_at is not null
     or new.started_at is not null or new.completed_at is not null or new.failed_at is not null
     or new.last_error_code is not null or new.last_error_message is not null
     or new.cv_storage_path is not null or new.cover_letter_storage_path is not null
     or new.cv_json is not null or new.cv_json_schema_version is not null
  then
    raise exception 'generation_jobs: new jobs must be queued with no progress or outputs';
  end if;

  new.created_at      := now();
  new.updated_at      := new.created_at;
  new.next_attempt_at := coalesce(new.next_attempt_at, new.created_at);
  return new;
end;
$function$;

-- ── Update: frozen inputs, legal transitions, historical outputs ─────────────
create function public.generation_jobs_before_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if (new.id, new.payment_order_id, new.user_id, new.form_id, new.submission_id,
      new.selected_language, new.created_at, new.max_attempts)
     is distinct from
     (old.id, old.payment_order_id, old.user_id, old.form_id, old.submission_id,
      old.selected_language, old.created_at, old.max_attempts)
  then
    raise exception 'generation_jobs: frozen fields are immutable';
  end if;

  if old.status = 'succeeded' then
    raise exception 'generation_jobs: succeeded jobs are immutable';
  end if;

  if new.attempt_count < old.attempt_count then
    raise exception 'generation_jobs: attempt_count cannot decrease';
  end if;

  if new.status is distinct from old.status and not (
       (old.status = 'queued'  and new.status in ('running', 'failed'))
    or (old.status = 'running' and new.status in ('queued', 'succeeded', 'failed'))
    or (old.status = 'failed'  and new.status = 'queued')
  ) then
    raise exception 'generation_jobs: illegal status transition % -> %', old.status, new.status;
  end if;

  -- Each claim (-> running) is exactly one new attempt.
  if new.status = 'running' and old.status <> 'running'
     and new.attempt_count <> old.attempt_count + 1 then
    raise exception 'generation_jobs: claiming a job must increment attempt_count by one';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create function public.generation_jobs_prevent_delete()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'generation_jobs: jobs cannot be deleted';
end;
$function$;

revoke all on function public.generation_jobs_before_insert()  from public, anon, authenticated;
revoke all on function public.generation_jobs_before_update()  from public, anon, authenticated;
revoke all on function public.generation_jobs_prevent_delete() from public, anon, authenticated;

create trigger generation_jobs_before_insert
  before insert on public.generation_jobs
  for each row execute function public.generation_jobs_before_insert();

create trigger generation_jobs_before_update
  before update on public.generation_jobs
  for each row execute function public.generation_jobs_before_update();

create trigger generation_jobs_prevent_delete
  before delete on public.generation_jobs
  for each row execute function public.generation_jobs_prevent_delete();

create trigger generation_jobs_prevent_truncate
  before truncate on public.generation_jobs
  for each statement execute function public.generation_jobs_prevent_delete();

-- ── RLS and grants ───────────────────────────────────────────────────────────
-- Default privileges in this schema grant ALL to anon/authenticated on new
-- tables, so everything is revoked explicitly first.
revoke all on table public.generation_jobs from public, anon, authenticated, service_role;

alter table public.generation_jobs enable row level security;

create policy generation_jobs_select_own
  on public.generation_jobs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.generation_jobs to authenticated;
grant select, insert, update on table public.generation_jobs to service_role;
