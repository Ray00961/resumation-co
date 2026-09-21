-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 3 · STEP 1 — Entitlement-authoritative public profile
--
-- Replaces public.get_public_profile(p_username text).
--
-- Paid public-profile access is now decided ONLY by an active, unexpired
-- `professional_profile` entitlement belonging to the profile's user, checked
-- through the existing public.has_entitlement(). profiles.active_plan, which
-- the owner can write directly, no longer has any authorization effect.
--
-- Security changes versus the previous definition:
--   1. is_paid comes from the entitlement, never from profiles.active_plan.
--   2. The cv_archive language lookup requires the form to belong to the
--      profile's own user (career_form_id is owner-writable; without the
--      owner check it could be pointed at another user's form).
--   3. qr_public_url is returned as NULL and qr_enabled as FALSE: both are
--      owner-writable and must not steer public links or badges. Real QR
--      entitlement handling is a later step.
--   4. stats are no longer returned: they came from owner-writable counters.
--   5. search_path is empty and every project object is schema-qualified.
--
-- Unchanged: signature, return type, username lookup, the free-profile field
-- set and limits, the remaining paid fields, the opt-in email/phone behavior,
-- and NULL for an unknown username.
--
-- One object replaced. No table, column, row, policy or trigger is modified.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.get_public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  p           public.profiles%rowtype;
  langs       jsonb := '{}'::jsonb;
  is_paid     boolean;
  skills_json jsonb;
  edu_json    jsonb;
  result      jsonb;
begin
  select * into p from public.profiles where username = p_username limit 1;
  if not found then
    return null;
  end if;

  -- Language levels live in cv_archive.cv_data->'languages'. The form must be
  -- the profile owner's own form: career_form_id is owner-writable.
  select coalesce(a.cv_data -> 'languages', '{}'::jsonb)
    into langs
  from public.cv_archive a
  where a.form_id = p.career_form_id
    and a.user_id = p.user_id
  limit 1;
  langs := coalesce(langs, '{}'::jsonb);

  -- The ONLY paid authority. profiles.active_plan is deliberately not read.
  is_paid := public.has_entitlement(p.user_id, 'professional_profile');

  skills_json := case when p.skills is null then '[]'::jsonb else to_jsonb(p.skills) end;
  edu_json    := case when p.education is null then '[]'::jsonb else to_jsonb(p.education) end;

  -- ================= FREE + PAID (always visible) =================
  result := jsonb_build_object(
    'username',      p.username,
    'first_name',    p.first_name,
    'last_name',     p.last_name,
    'full_name_ar',  p.full_name_ar,
    'gender',        p.gender,
    'nationality',   p.nationality,
    'location',      p.location,
    'avatar_url',    p.avatar_url,
    'cover_url',     p.cover_url,
    'headline',      p.headline,
    'target_job',    p.target_job,
    'career_level',  p.career_level,
    'ai_summary',    p.ai_summary,
    -- Owner-writable legacy QR fields are not trusted. Keys are kept for the
    -- existing frontend shape; the frontend falls back to /u/{username}.
    'qr_public_url', null::text,
    'qr_enabled',    false,
    'created_at',    p.created_at,
    'is_paid',       is_paid,
    'arabic_level',  nullif(btrim(coalesce(langs ->> 'arabic',  '')), ''),
    'english_level', nullif(btrim(coalesce(langs ->> 'english', '')), ''),
    'skills', (
      select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
      from (
        select elem, ord
        from jsonb_array_elements(skills_json) with ordinality as s(elem, ord)
        order by ord
        limit 3
      ) z
    ),
    'education', case
      when jsonb_array_length(edu_json) >= 1 then jsonb_build_array(edu_json -> 0)
      else '[]'::jsonb
    end
  );

  -- ================= PAID additions =================
  -- stats are intentionally absent: the underlying counters are owner-writable.
  if is_paid then
    result := result
      || jsonb_build_object('skills',      skills_json)
      || jsonb_build_object('education',   edu_json)
      || jsonb_build_object('experience',
            case when p.experience is null then '[]'::jsonb else to_jsonb(p.experience) end)
      || jsonb_build_object('other_links', coalesce(p.other_links, '[]'::jsonb))
      || jsonb_build_object('languages',   langs);

    if coalesce(p.cv_email_public, false) then
      result := result || jsonb_build_object('cv_email', p.cv_email);
    end if;
    if coalesce(p.phone_public, false) then
      result := result || jsonb_build_object('phone', p.phone);
    end if;
  end if;

  return result;
end;
$function$;

comment on function public.get_public_profile(text) is
  'Public profile by username. The professional_profile entitlement '
  '(public.has_entitlement) is the ONLY paid-profile authority. Legacy '
  'profiles.active_plan, qr_enabled, qr_public_url and the *_count columns are '
  'owner-writable and are NOT authorization inputs. Returns NULL for an unknown '
  'username.';

-- ── Privileges ───────────────────────────────────────────────────────────────
-- Public profiles are viewed logged out, so anon keeps EXECUTE. No broadening.
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;
