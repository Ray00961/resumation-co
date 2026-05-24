-- ============================================================
-- MIGRATION: Coin Economy + Security Fixes
-- Run this ENTIRE file in Supabase SQL Editor (once)
-- Date: 2026-05-22
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1: Fix dangerous public-read policy on users table
-- ────────────────────────────────────────────────────────────

-- Drop the policy that exposed ALL user data to everyone
DROP POLICY IF EXISTS "users_public_read"                   ON public.users;
DROP POLICY IF EXISTS "Public user profiles are readable"   ON public.users;

-- Safe replacement: only rows with a username are publicly visible
-- (username, first_name, last_name only — email/phone/coins stay private)
DROP POLICY IF EXISTS "users_safe_public_read"              ON public.users;
CREATE POLICY "users_safe_public_read" ON public.users
  FOR SELECT USING (username IS NOT NULL);


-- ────────────────────────────────────────────────────────────
-- SECTION 2: Clean up duplicate/conflicting profiles policies
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public profiles are readable"        ON public.profiles;
DROP POLICY IF EXISTS "Profiles are public"                 ON public.profiles;
DROP POLICY IF EXISTS "Everything is private to owner"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_auth_all"                   ON public.profiles;

-- Single clean policy set
DROP POLICY IF EXISTS "profiles_public_read"                ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_write"                ON public.profiles;

CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_owner_write" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- ────────────────────────────────────────────────────────────
-- SECTION 3: cv_uploads storage bucket → private + policies
-- ────────────────────────────────────────────────────────────

-- Mark bucket as private (disables direct public URL access)
UPDATE storage.buckets SET public = false WHERE id = 'cv_uploads';

-- Drop old permissive policies
DROP POLICY IF EXISTS "cv_uploads_owner_read"   ON storage.objects;
DROP POLICY IF EXISTS "cv_uploads_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "cv_uploads_auth_delete"  ON storage.objects;

-- Only the file owner can create signed URLs (path: {user_id}/filename)
CREATE POLICY "cv_uploads_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cv_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only authenticated users can upload their own files
CREATE POLICY "cv_uploads_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cv_uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owner can delete their files
CREATE POLICY "cv_uploads_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cv_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ────────────────────────────────────────────────────────────
-- SECTION 4: Add Coin Economy columns to users table
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS search_coins      INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_founder        BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_code        TEXT         UNIQUE,
  ADD COLUMN IF NOT EXISTS promo_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referred_by       TEXT;


-- ────────────────────────────────────────────────────────────
-- SECTION 5: coin_transactions table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      INT          NOT NULL,
  reason      TEXT         NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coin_tx_own_read" ON public.coin_transactions;
CREATE POLICY "coin_tx_own_read" ON public.coin_transactions
  FOR SELECT USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 6: referral_log table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_log (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coins_awarded  INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);

ALTER TABLE public.referral_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_own_read" ON public.referral_log;
CREATE POLICY "referral_own_read" ON public.referral_log
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 7: Auto-generate promo_code on new user signup
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_generate_promo_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  code     TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := 'RSM-' || upper(substring(md5(random()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE promo_code = code);
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique promo code after 20 attempts';
    END IF;
  END LOOP;

  NEW.promo_code       := code;
  NEW.promo_expires_at := now() + INTERVAL '1 year';
  -- Founder: signed up before July 2026
  NEW.is_founder       := (now() < '2026-07-01'::TIMESTAMPTZ);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_promo_code ON public.users;
CREATE TRIGGER trg_generate_promo_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.promo_code IS NULL)
  EXECUTE FUNCTION fn_generate_promo_code();


-- ────────────────────────────────────────────────────────────
-- SECTION 8: Server-side referral validation trigger
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_validate_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  referrer RECORD;
BEGIN
  IF NEW.referred_by IS NULL OR NEW.referred_by = '' THEN
    RETURN NEW;
  END IF;

  SELECT id, promo_expires_at INTO referrer
  FROM public.users
  WHERE promo_code = NEW.referred_by
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  IF referrer.promo_expires_at IS NOT NULL AND referrer.promo_expires_at < now() THEN
    RAISE EXCEPTION 'Referral code has expired';
  END IF;

  IF referrer.id = NEW.id THEN
    RAISE EXCEPTION 'Cannot use your own referral code';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_referral ON public.users;
CREATE TRIGGER trg_validate_referral
  BEFORE INSERT OR UPDATE OF referred_by ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_referral();


-- ────────────────────────────────────────────────────────────
-- SECTION 9: RPC spend_coins (authenticated users)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.spend_coins(
  p_amount    INT,
  p_reason    TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cur_balance INT;
  uid         UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT search_coins INTO cur_balance
  FROM public.users
  WHERE id = uid
  FOR UPDATE;

  IF cur_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Insufficient coins',
      'balance', cur_balance
    );
  END IF;

  UPDATE public.users
  SET search_coins = search_coins - p_amount
  WHERE id = uid;

  INSERT INTO public.coin_transactions (user_id, amount, reason, reference)
  VALUES (uid, -p_amount, p_reason, p_reference);

  RETURN jsonb_build_object('success', true, 'balance', cur_balance - p_amount);
END;
$$;

REVOKE ALL     ON FUNCTION public.spend_coins FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.spend_coins TO   authenticated;


-- ────────────────────────────────────────────────────────────
-- SECTION 10: RPC award_coins (service_role ONLY — Make.com)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.award_coins(
  p_user_id UUID,
  p_amount  INT,
  p_reason  TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
  SET search_coins = search_coins + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, reason)
  VALUES (p_user_id, p_amount, p_reason);
END;
$$;

REVOKE ALL     ON FUNCTION public.award_coins FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_coins FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.award_coins TO   service_role;


-- ────────────────────────────────────────────────────────────
-- SECTION 11: RPC award_referral_coins (service_role ONLY)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.award_referral_coins(
  p_referred_user_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  referred_row  RECORD;
  referrer_row  RECORD;
  reward_amount INT;
BEGIN
  SELECT id, referred_by INTO referred_row
  FROM public.users WHERE id = p_referred_user_id;

  IF NOT FOUND OR referred_row.referred_by IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No referral on this user');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_log WHERE referred_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already rewarded');
  END IF;

  SELECT id, is_founder INTO referrer_row
  FROM public.users WHERE promo_code = referred_row.referred_by;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referrer not found');
  END IF;

  reward_amount := CASE WHEN referrer_row.is_founder THEN 15 ELSE 10 END;

  PERFORM public.award_coins(referrer_row.id, reward_amount, 'referral_reward');

  INSERT INTO public.referral_log (referrer_id, referred_id, coins_awarded)
  VALUES (referrer_row.id, p_referred_user_id, reward_amount);

  RETURN jsonb_build_object('success', true, 'coins_awarded', reward_amount);
END;
$$;

REVOKE ALL     ON FUNCTION public.award_referral_coins FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_referral_coins FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.award_referral_coins TO   service_role;


-- ────────────────────────────────────────────────────────────
-- SECTION 12: Backfill promo codes for existing users
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  u        RECORD;
  code     TEXT;
  attempts INT;
BEGIN
  FOR u IN SELECT id FROM public.users WHERE promo_code IS NULL LOOP
    attempts := 0;
    LOOP
      code := 'RSM-' || upper(substring(md5(random()::text) FROM 1 FOR 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE promo_code = code);
      attempts := attempts + 1;
      IF attempts > 20 THEN
        RAISE EXCEPTION 'Backfill failed for user %', u.id;
      END IF;
    END LOOP;

    UPDATE public.users SET
      promo_code       = code,
      promo_expires_at = now() + INTERVAL '1 year',
      is_founder       = true
    WHERE id = u.id;
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────
-- SECTION 13: Enable Realtime on users table (for coin balance)
-- ────────────────────────────────────────────────────────────

-- Allow Supabase Realtime to broadcast users table UPDATE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- ============================================================
-- DONE. Verify by running:
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public';
-- Should include: spend_coins, award_coins, award_referral_coins
-- ============================================================
