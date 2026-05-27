-- ============================================================
-- order_generations — central hub for all CV generation jobs
-- ============================================================
-- This table was created manually in the Supabase dashboard and was
-- previously absent from version control. This migration captures the
-- canonical DDL so the schema can be reproduced on a fresh branch or
-- clean environment.
--
-- Role in the system:
--   - Paid rows:  inserted by webhook-wishmoney (WishMoney) or
--                 confirm-payment (Paymob) after confirmed payment.
--   - Free rows:  referenced by generate-free-cv to store the one-time
--                 HTML teaser and DOCX download URL.
--   - Downstream: generate-cv reads cv_data from this row and writes
--                 cv_file_path, cv_pdf_url, cl_file_path, cl_pdf_url back.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_generations (

  -- ── Identity ─────────────────────────────────────────────────────────────
  generation_id       UUID          NOT NULL DEFAULT gen_random_uuid(),
  form_id             UUID          NOT NULL,     -- FK → cv_archive.form_id
  user_id             UUID          NOT NULL,     -- FK → auth.users.id

  -- ── Form submission context (denormalised snapshot from cv_archive) ───────
  submission_id       TEXT,
  username            TEXT,
  first_name          TEXT,
  last_name           TEXT,
  email               TEXT,
  phone_number        TEXT,
  preferred_language  TEXT,
  region              TEXT,

  -- ── CV contact snapshot ───────────────────────────────────────────────────
  cv_first_name       TEXT,
  cv_last_name        TEXT,
  cv_phone_number     TEXT,
  cv_email            TEXT,
  cv_target_job       TEXT,

  -- ── CV content ────────────────────────────────────────────────────────────
  cv_data             JSONB,                      -- full cv_archive.cv_data snapshot
  is_uploaded_cv      BOOLEAN       DEFAULT false,
  cv_gpt_result       JSONB,                      -- structured JSON parsed by generate-cv

  -- ── Output files ──────────────────────────────────────────────────────────
  -- Paid plan:   cv_file_path = storage path  "{uid}/{gid}_cv_{lang}.html"
  --              cv_pdf_url   = 90-day signed URL of that file
  --              cl_file_path = storage path  "{uid}/{gid}_cl_{lang}.html"
  --              cl_pdf_url   = 90-day signed URL of that file
  -- Free plan:   cv_file_path = raw <div>…</div> HTML (not a storage path)
  --              cv_pdf_url   = 90-day signed URL of the generated DOCX
  cv_pdf_url          TEXT,
  cv_file_path        TEXT,
  cl_file_path        TEXT,
  cl_pdf_url          TEXT,

  -- ── Payment ───────────────────────────────────────────────────────────────
  payment_method      TEXT,                       -- 'whish' | 'wishmoney' | 'paymob'
  transaction_id      TEXT,
  paymob_order_id     TEXT,
  wishmoney_order_id  TEXT,
  package_name        TEXT,                       -- 'free' | 'premium' | 'gold' | 'ai_search'

  -- ── Terms & timestamps ────────────────────────────────────────────────────
  agreed_to_terms     BOOLEAN       DEFAULT false,
  agreed_at           TIMESTAMPTZ   DEFAULT (now() AT TIME ZONE 'Asia/Beirut'),
  created_at_utc      TIMESTAMPTZ   DEFAULT timezone('utc'::text, now()),
  created_at_beirut   TIMESTAMPTZ   DEFAULT (now() AT TIME ZONE 'Asia/Beirut'),
  selected_language   TEXT          DEFAULT 'en',

  -- ── Constraints ───────────────────────────────────────────────────────────
  CONSTRAINT order_generations_pkey
    PRIMARY KEY (generation_id),

  CONSTRAINT fk_order_generations_form_id
    FOREIGN KEY (form_id) REFERENCES public.cv_archive (form_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_order_generations_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users (id)
    ON DELETE CASCADE
);

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- All writes from Edge Functions use the service role key (bypasses RLS).
-- Authenticated users may only read/update their own rows (BuildingPage polling,
-- free-plan cache check, language selection).

ALTER TABLE public.order_generations ENABLE ROW LEVEL SECURITY;

-- SELECT: users see only their own generations
DROP POLICY IF EXISTS order_gen_select_own ON public.order_generations;
CREATE POLICY order_gen_select_own
  ON public.order_generations FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- INSERT: users may insert their own rows (free plan client flow)
DROP POLICY IF EXISTS order_gen_insert_own ON public.order_generations;
CREATE POLICY order_gen_insert_own
  ON public.order_generations FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE: users may update their own rows (e.g. language preference)
DROP POLICY IF EXISTS order_gen_update_own ON public.order_generations;
CREATE POLICY order_gen_update_own
  ON public.order_generations FOR UPDATE
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Service role bypasses RLS automatically — no additional policy required.
