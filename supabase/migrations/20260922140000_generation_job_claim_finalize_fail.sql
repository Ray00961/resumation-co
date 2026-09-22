-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 3 · STEP 3D — Generation job execution contract (claim / finalize / fail)
--
-- The database contract a future worker uses. No worker, AI call, upload,
-- cron or pg_net exists yet; nothing here runs on its own.
--
-- 1. generation_jobs.claim_token (uuid). job_id alone cannot tell two claims
--    apart: after worker A's lease expires and worker B reclaims the job, A
--    still knows the job_id and B's lease is valid. Every claim therefore
--    receives a fresh server-generated token; finalize and fail require it.
--    The token is kept on a succeeded job as the provenance of the winning
--    claim (and for idempotent finalize), and cleared on requeue / failure.
--    A guard trigger makes the token impossible to reuse or reassign.
--
-- 2. public.claim_generation_job()                 → claims ONE eligible job
--    public.finalize_generation_job(...)           → outputs + consumption
--    public.fail_generation_job(...)               → retry or terminal fail
--    All SECURITY DEFINER, search_path '', EXECUTE for service_role only.
--
-- 3. authenticated keeps SELECT on its own jobs (RLS unchanged) but no longer
--    on claim_token: table-level SELECT becomes column-level SELECT.
--
-- Unchanged: settlement, the generation_jobs insert/update/delete triggers,
-- RLS policy, entitlements and consumption triggers.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Claim token ───────────────────────────────────────────────────────────
alter table public.generation_jobs
  add column claim_token uuid;

-- A running job always belongs to exactly one claim; a succeeded job keeps the
-- winning claim's token; queued and failed jobs belong to no claim.
alter table public.generation_jobs
  add constraint generation_jobs_claim_token_shape
  check ((status in ('running', 'succeeded')) = (claim_token is not null));

comment on column public.generation_jobs.claim_token is
  'Server-generated per-claim token. Required by finalize/fail so a stale worker '
  'can never act on a reclaimed job. Never readable by browser roles.';

create function public.generation_jobs_claim_token_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.claim_token is distinct from old.claim_token then
    if new.claim_token is not null then
      -- A new token is issued only by a claim: running, exactly one new attempt.
      if new.status <> 'running' or new.attempt_count <> old.attempt_count + 1 then
        raise exception 'generation_jobs: a claim token is issued only by a claim';
      end if;
      -- A running job may be reclaimed only after its lease has expired.
      if old.status = 'running' and old.lease_expires_at > now() then
        raise exception 'generation_jobs: an active lease cannot be reclaimed';
      end if;
    elsif new.status not in ('queued', 'failed') then
      raise exception 'generation_jobs: a claim token is cleared only on requeue or failure';
    end if;
  elsif new.status = 'running' and old.status = 'running'
        and new.attempt_count <> old.attempt_count then
    raise exception 'generation_jobs: attempt_count changes only with a new claim';
  end if;

  return new;
end;
$function$;

revoke all on function public.generation_jobs_claim_token_guard() from public, anon, authenticated;

create trigger generation_jobs_claim_token_guard
  before update on public.generation_jobs
  for each row execute function public.generation_jobs_claim_token_guard();

-- ── 2. Browser read access: every column except claim_token ─────────────────
revoke select on table public.generation_jobs from authenticated;
grant select (
  id, payment_order_id, user_id, form_id, submission_id, selected_language,
  status, attempt_count, max_attempts, next_attempt_at, lease_expires_at,
  last_error_code, last_error_message, cv_storage_path, cover_letter_storage_path,
  cv_json, cv_json_schema_version, created_at, updated_at, started_at,
  completed_at, failed_at
) on public.generation_jobs to authenticated;

-- ── 3. CLAIM ─────────────────────────────────────────────────────────────────
-- The database chooses the job; the caller supplies nothing.
create function public.claim_generation_job()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c_lease constant interval := interval '10 minutes';
  v_job   public.generation_jobs%rowtype;
begin
  -- Abandoned FINAL attempts cannot be reclaimed (no attempts left), so they
  -- are closed here instead of staying 'running' forever.
  update public.generation_jobs g
     set status             = 'failed',
         failed_at          = now(),
         lease_expires_at   = null,
         claim_token        = null,
         last_error_code    = 'lease_expired',
         last_error_message = 'Final attempt abandoned: lease expired before completion.'
   where g.id in (
           select s.id
             from public.generation_jobs s
            where s.status = 'running'
              and s.lease_expires_at <= now()
              and s.attempt_count >= s.max_attempts
            for update skip locked
         );

  -- One eligible job: due and queued, or running with an expired lease, with
  -- attempts left, for an order that is still paid. SKIP LOCKED means a job
  -- another worker is claiming right now is never waited on or double-claimed.
  select g.* into v_job
    from public.generation_jobs g
   where (   (g.status = 'queued'  and g.next_attempt_at  <= now())
          or (g.status = 'running' and g.lease_expires_at <= now()))
     and g.attempt_count < g.max_attempts
     and exists (
           select 1 from public.payment_orders po
            where po.id = g.payment_order_id and po.status = 'paid')
   order by case when g.status = 'running' then g.lease_expires_at else g.next_attempt_at end,
            g.created_at, g.id
   limit 1
   for update of g skip locked;

  if not found then
    return jsonb_build_object('outcome', 'no_job');
  end if;

  update public.generation_jobs
     set status           = 'running',
         attempt_count    = attempt_count + 1,
         claim_token      = gen_random_uuid(),
         lease_expires_at = now() + c_lease,
         started_at       = now()
   where id = v_job.id
  returning * into v_job;

  -- Canonical worker inputs only; all of them came from the frozen order.
  return jsonb_build_object(
    'outcome',           'claimed',
    'job_id',            v_job.id,
    'claim_token',       v_job.claim_token,
    'attempt_count',     v_job.attempt_count,
    'max_attempts',      v_job.max_attempts,
    'lease_expires_at',  v_job.lease_expires_at,
    'payment_order_id',  v_job.payment_order_id,
    'user_id',           v_job.user_id,
    'form_id',           v_job.form_id,
    'submission_id',     v_job.submission_id,
    'selected_language', v_job.selected_language
  );
end;
$function$;

-- ── 4. FINALIZE ──────────────────────────────────────────────────────────────
-- Caller supplies the job, its claim token and the OUTPUTS it produced. Every
-- identity, provenance and entitlement fact is read from the database.
-- Deterministic refusals return an outcome and write nothing; any unexpected
-- failure raises and rolls back consumption and job update together.
create function public.finalize_generation_job(
  p_job_id                    uuid,
  p_claim_token               uuid,
  p_cv_json                   jsonb,
  p_cv_storage_path           text,
  p_cover_letter_storage_path text,
  p_cv_json_schema_version    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c_bucket   constant text := 'cv-documents';
  c_version  constant text := 'cv-json-v1';
  v_job      public.generation_jobs%rowtype;
  v_order    public.payment_orders%rowtype;
  v_cv_ent   public.entitlements%rowtype;
  v_cl_ent   public.entitlements%rowtype;
  v_prefix   text;
  v_count    integer;
begin
  if p_job_id is null or p_claim_token is null then
    return jsonb_build_object('outcome', 'rejected_invalid_request', 'job_id', p_job_id);
  end if;

  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('outcome', 'job_not_found', 'job_id', p_job_id);
  end if;

  -- ── Idempotent replay: READ ONLY ──────────────────────────────────────────
  if v_job.status = 'succeeded' then
    select count(*) into v_count
      from public.entitlement_consumptions c
     where c.consumed_for_type = 'generation_job' and c.consumed_for_id = v_job.id;

    if v_job.claim_token = p_claim_token
       and v_job.cv_json = p_cv_json
       and v_job.cv_storage_path = p_cv_storage_path
       and v_job.cover_letter_storage_path = p_cover_letter_storage_path
       and v_job.cv_json_schema_version = p_cv_json_schema_version
       and v_count = 2 then
      return jsonb_build_object('outcome', 'already_finalized', 'job_id', v_job.id);
    end if;
    return jsonb_build_object('outcome', 'conflict_already_finalized', 'job_id', v_job.id);
  end if;

  -- ── The caller must hold the job's CURRENT, unexpired claim ───────────────
  if v_job.status <> 'running' or v_job.claim_token is distinct from p_claim_token then
    return jsonb_build_object('outcome', 'rejected_stale_claim', 'job_id', v_job.id);
  end if;
  if v_job.lease_expires_at <= now() then
    return jsonb_build_object('outcome', 'rejected_lease_expired', 'job_id', v_job.id);
  end if;

  -- ── Outputs: exactly what the worker produced, validated ──────────────────
  v_prefix := v_job.user_id::text || '/' || v_job.id::text || '/';
  if p_cv_json_schema_version is distinct from c_version
     or p_cv_json is null or jsonb_typeof(p_cv_json) <> 'object'
     or (p_cv_json ->> 'document_language') is distinct from v_job.selected_language
     or p_cv_storage_path is null or p_cover_letter_storage_path is null
     or p_cv_storage_path = p_cover_letter_storage_path
     or left(p_cv_storage_path, length(v_prefix)) <> v_prefix
     or left(p_cover_letter_storage_path, length(v_prefix)) <> v_prefix
     or p_cv_storage_path !~ '^[^/]+/[^/]+/[A-Za-z0-9._-]{1,200}\.docx$'
     or p_cover_letter_storage_path !~ '^[^/]+/[^/]+/[A-Za-z0-9._-]{1,200}\.docx$' then
    return jsonb_build_object('outcome', 'rejected_invalid_output', 'job_id', v_job.id);
  end if;

  -- Durable means the objects really exist in the private documents bucket.
  select count(*) into v_count
    from storage.objects o
   where o.bucket_id = c_bucket
     and o.name in (p_cv_storage_path, p_cover_letter_storage_path);
  if v_count <> 2 then
    return jsonb_build_object('outcome', 'rejected_output_missing', 'job_id', v_job.id);
  end if;

  -- ── The canonical paid order, and the job's provenance against it ─────────
  select * into v_order from public.payment_orders where id = v_job.payment_order_id for share;
  if not found
     or v_order.status <> 'paid' or v_order.paid_at is null or v_order.fulfilled_at is null then
    return jsonb_build_object('outcome', 'rejected_order_not_eligible', 'job_id', v_job.id);
  end if;

  if (v_order.user_id, v_order.form_id, v_order.submission_id, v_order.selected_language)
       is distinct from
     (v_job.user_id, v_job.form_id, v_job.submission_id, v_job.selected_language)
     or not (v_order.benefits_snapshot @> '[{"benefit_type": "cv_generation"}]'::jsonb
             and v_order.benefits_snapshot @> '[{"benefit_type": "cover_letter_generation"}]'::jsonb) then
    return jsonb_build_object('outcome', 'rejected_provenance_mismatch', 'job_id', v_job.id);
  end if;

  -- ── The exact entitlements granted by THIS order ──────────────────────────
  select * into v_cv_ent from public.entitlements
   where source_type = 'payment_order' and source_id = v_order.id
     and benefit_type = 'cv_generation'
   for update;
  select * into v_cl_ent from public.entitlements
   where source_type = 'payment_order' and source_id = v_order.id
     and benefit_type = 'cover_letter_generation'
   for update;

  if v_cv_ent.id is null or v_cl_ent.id is null
     or v_cv_ent.user_id <> v_job.user_id or v_cl_ent.user_id <> v_job.user_id
     or v_cv_ent.benefit_kind <> 'consumable' or v_cl_ent.benefit_kind <> 'consumable'
     or v_cv_ent.status <> 'active' or v_cl_ent.status <> 'active'
     or (v_cv_ent.expires_at is not null and v_cv_ent.expires_at <= now())
     or (v_cl_ent.expires_at is not null and v_cl_ent.expires_at <= now())
     or v_cv_ent.quantity_consumed + 1 > v_cv_ent.quantity_granted
     or v_cl_ent.quantity_consumed + 1 > v_cl_ent.quantity_granted then
    return jsonb_build_object('outcome', 'rejected_entitlement_unavailable', 'job_id', v_job.id);
  end if;

  -- A running job has never been finalized, so it can have no consumptions.
  select count(*) into v_count
    from public.entitlement_consumptions c
   where c.consumed_for_type = 'generation_job' and c.consumed_for_id = v_job.id;
  if v_count <> 0 then
    raise exception 'finalize_generation_job: running job % already has consumptions', v_job.id;
  end if;

  -- ── Consume exactly one of each, recorded against THIS job ────────────────
  -- entitlement_consumptions_before_insert re-locks, re-validates and
  -- increments each entitlement. No ON CONFLICT: any surprise aborts all.
  insert into public.entitlement_consumptions
    (entitlement_id, user_id, consumed_for_type, consumed_for_id, quantity)
  values
    (v_cv_ent.id, v_job.user_id, 'generation_job', v_job.id, 1),
    (v_cl_ent.id, v_job.user_id, 'generation_job', v_job.id, 1);

  -- ── Store the outputs and close the job ───────────────────────────────────
  update public.generation_jobs
     set status                    = 'succeeded',
         lease_expires_at          = null,
         completed_at              = now(),
         cv_json                   = p_cv_json,
         cv_storage_path           = p_cv_storage_path,
         cover_letter_storage_path = p_cover_letter_storage_path,
         cv_json_schema_version    = p_cv_json_schema_version
   where id = v_job.id;

  return jsonb_build_object('outcome', 'finalized', 'job_id', v_job.id);
end;
$function$;

-- ── 5. FAIL ──────────────────────────────────────────────────────────────────
-- The database, not the caller, decides between retry and terminal failure.
create function public.fail_generation_job(
  p_job_id        uuid,
  p_claim_token   uuid,
  p_error_code    text,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job     public.generation_jobs%rowtype;
  v_code    text;
  v_message text;
  v_delay   interval;
begin
  if p_job_id is null or p_claim_token is null then
    return jsonb_build_object('outcome', 'rejected_invalid_request', 'job_id', p_job_id);
  end if;

  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('outcome', 'job_not_found', 'job_id', p_job_id);
  end if;

  if v_job.status <> 'running' or v_job.claim_token is distinct from p_claim_token then
    return jsonb_build_object('outcome', 'rejected_stale_claim', 'job_id', v_job.id);
  end if;
  if v_job.lease_expires_at <= now() then
    return jsonb_build_object('outcome', 'rejected_lease_expired', 'job_id', v_job.id);
  end if;

  -- Sanitised to the column constraints; never rejected for bad formatting.
  v_code := lower(btrim(coalesce(p_error_code, '')));
  v_code := regexp_replace(v_code, '[^a-z0-9_]+', '_', 'g');
  v_code := left(v_code, 64);
  if v_code !~ '^[a-z][a-z0-9_]{0,63}$' then
    v_code := 'worker_error';
  end if;

  v_message := btrim(regexp_replace(coalesce(p_error_message, ''), '[[:cntrl:]]+', ' ', 'g'));
  v_message := nullif(left(v_message, 500), '');

  if v_job.attempt_count >= v_job.max_attempts then
    update public.generation_jobs
       set status             = 'failed',
           failed_at          = now(),
           lease_expires_at   = null,
           claim_token        = null,
           last_error_code    = v_code,
           last_error_message = v_message
     where id = v_job.id;
    return jsonb_build_object('outcome', 'failed_terminal', 'job_id', v_job.id,
                              'attempt_count', v_job.attempt_count);
  end if;

  -- Exponential backoff from the server: 60s, 120s, 240s ... capped at 1 hour.
  v_delay := least(interval '1 hour',
                   interval '60 seconds' * power(2, greatest(v_job.attempt_count - 1, 0))::integer);

  update public.generation_jobs
     set status             = 'queued',
         lease_expires_at   = null,
         claim_token        = null,
         next_attempt_at    = now() + v_delay,
         last_error_code    = v_code,
         last_error_message = v_message
   where id = v_job.id
  returning * into v_job;

  return jsonb_build_object('outcome', 'requeued', 'job_id', v_job.id,
                            'attempt_count', v_job.attempt_count,
                            'next_attempt_at', v_job.next_attempt_at);
end;
$function$;

-- ── 6. Privileges: service_role only ─────────────────────────────────────────
revoke all on function public.claim_generation_job() from public, anon, authenticated;
revoke all on function public.finalize_generation_job(uuid, uuid, jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_generation_job(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_generation_job() to service_role;
grant execute on function public.finalize_generation_job(uuid, uuid, jsonb, text, text, text)
  to service_role;
grant execute on function public.fail_generation_job(uuid, uuid, text, text) to service_role;

comment on function public.claim_generation_job() is
  'Worker: claims one due generation job (FOR UPDATE SKIP LOCKED), issues a fresh '
  'claim token and a 10-minute lease, and returns the frozen inputs.';
comment on function public.finalize_generation_job(uuid, uuid, jsonb, text, text, text) is
  'Worker: with the current claim token and an unexpired lease, stores the '
  'normalized CvJsonV1 and existing DOCX paths, consumes exactly one '
  'cv_generation and one cover_letter_generation entitlement of the job''s own '
  'order, and marks the job succeeded, atomically. Exact replay is read-only.';
comment on function public.fail_generation_job(uuid, uuid, text, text) is
  'Worker: with the current claim token, records a sanitised error and either '
  'requeues with server-side backoff or fails terminally. Consumes nothing.';
