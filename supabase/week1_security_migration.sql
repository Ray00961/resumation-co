-- ============================================================
--  Resumation.co — Week 1 Security Migration
--  تاريخ: 2026-05-21
--  التنفيذ: افتح Supabase Dashboard → SQL Editor → انسخ والصق → Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 1: إضافة أعمدة Coin Economy إلى جدول users
--         (IF NOT EXISTS يمنع الخطأ إذا نُفّذت سابقاً)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS search_coins    integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_founder      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_code      text        UNIQUE,
  ADD COLUMN IF NOT EXISTS promo_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS referred_by     text;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: جدول coin_transactions — سجل كل معاملة
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      integer     NOT NULL,          -- موجب = دخل، سالب = إنفاق
  reason      text        NOT NULL,          -- مثال: 'ai_job_search', 'plan_purchase', 'referral_reward'
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- المستخدم يقرأ معاملاته فقط
CREATE POLICY "Users read own coin transactions"
  ON public.coin_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- STEP 3: جدول referral_log — تتبع الإحالات
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coins_awarded integer    NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_id)    -- كل مستخدم لا يُحال إلا مرة واحدة
);

ALTER TABLE public.referral_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own referral log"
  ON public.referral_log FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Trigger — توليد promo_code تلقائياً عند إنشاء المستخدم
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_promo_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_code  text;
  founder_cutoff timestamptz := '2026-07-01 00:00:00+00'; -- أول 500 مستخدم أو قبل هذا التاريخ
BEGIN
  -- توليد كود فريد بصيغة RSM-XXXXXX
  LOOP
    new_code := 'RSM-' || upper(substring(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users WHERE promo_code = new_code
    );
  END LOOP;

  NEW.promo_code      := new_code;
  NEW.promo_expires_at := now() + interval '1 year';

  -- كشف Founder: المستخدمون قبل تاريخ الإغلاق
  IF now() < founder_cutoff THEN
    NEW.is_founder := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_promo_code ON public.users;
CREATE TRIGGER trg_generate_promo_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.promo_code IS NULL)
  EXECUTE FUNCTION fn_generate_promo_code();

-- ─────────────────────────────────────────────────────────────
-- STEP 5: Trigger — التحقق من referred_by (الأمان الحرج)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validate_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ref_user_id  uuid;
  ref_expiry   timestamptz;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN

    -- التحقق من وجود الكود وجلب بيانات المُحيل
    SELECT id, promo_expires_at
      INTO ref_user_id, ref_expiry
      FROM public.users
     WHERE promo_code = NEW.referred_by;

    -- الكود غير موجود
    IF ref_user_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_REFERRAL_CODE: Referral code "%" does not exist', NEW.referred_by;
    END IF;

    -- منع Self-Referral
    IF ref_user_id = NEW.id THEN
      RAISE EXCEPTION 'SELF_REFERRAL: User cannot refer themselves';
    END IF;

    -- التحقق من انتهاء الصلاحية
    IF ref_expiry IS NOT NULL AND ref_expiry < now() THEN
      RAISE EXCEPTION 'EXPIRED_REFERRAL_CODE: Referral code "%" has expired', NEW.referred_by;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_referral ON public.users;
CREATE TRIGGER trg_validate_referral
  BEFORE INSERT OR UPDATE OF referred_by ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_referral();

-- ─────────────────────────────────────────────────────────────
-- STEP 6: RPC — spend_coins (مع قفل FOR UPDATE لمنع Race Condition)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION spend_coins(p_user_id uuid, p_amount integer, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_balance integer;
BEGIN
  -- قفل الصف لمنع الاستخدام المتزامن
  SELECT search_coins INTO current_balance
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_COINS', 'balance', current_balance);
  END IF;

  -- خصم الـ Coins
  UPDATE public.users
     SET search_coins = search_coins - p_amount
   WHERE id = p_user_id;

  -- تسجيل المعاملة
  INSERT INTO public.coin_transactions (user_id, amount, reason)
  VALUES (p_user_id, -p_amount, p_reason);

  RETURN jsonb_build_object('success', true, 'new_balance', current_balance - p_amount);
END;
$$;

-- المستخدم المسجّل فقط يستطيع استدعاء spend_coins
REVOKE EXECUTE ON FUNCTION spend_coins FROM anon;
GRANT  EXECUTE ON FUNCTION spend_coins TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- STEP 7: RPC — award_coins (service_role ONLY — لا يُستدعى من العميل)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_coins(p_user_id uuid, p_amount integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
     SET search_coins = search_coins + p_amount
   WHERE id = p_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, reason)
  VALUES (p_user_id, p_amount, p_reason);
END;
$$;

-- ⛔ CRITICAL: سحب الصلاحية من الجميع — service_role فقط (عبر Make.com / Edge Functions)
REVOKE EXECUTE ON FUNCTION award_coins FROM authenticated;
REVOKE EXECUTE ON FUNCTION award_coins FROM anon;
GRANT  EXECUTE ON FUNCTION award_coins TO service_role;

-- ─────────────────────────────────────────────────────────────
-- STEP 8: RPC — award_referral_coins (مكافأة المُحيل بعد تأكيد الدفع)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_referral_coins(p_referred_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  referrer_row  public.users%ROWTYPE;
  referred_row  public.users%ROWTYPE;
  base_reward   integer := 20;
  final_reward  integer;
BEGIN
  -- جلب بيانات المُستخدَم الجديد
  SELECT * INTO referred_row FROM public.users WHERE id = p_referred_user_id;
  IF NOT FOUND OR referred_row.referred_by IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_REFERRAL');
  END IF;

  -- منع الإحالة المكررة
  IF EXISTS (SELECT 1 FROM public.referral_log WHERE referred_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_REWARDED');
  END IF;

  -- جلب بيانات المُحيل
  SELECT * INTO referrer_row FROM public.users WHERE promo_code = referred_row.referred_by;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'REFERRER_NOT_FOUND');
  END IF;

  -- مكافأة 1.5× للـ Founders
  final_reward := CASE WHEN referrer_row.is_founder THEN (base_reward * 1.5)::integer ELSE base_reward END;

  -- منح الـ Coins للمُحيل
  UPDATE public.users SET search_coins = search_coins + final_reward WHERE id = referrer_row.id;

  INSERT INTO public.coin_transactions (user_id, amount, reason)
  VALUES (referrer_row.id, final_reward, 'referral_reward');

  -- تسجيل في referral_log
  INSERT INTO public.referral_log (referrer_id, referred_id, coins_awarded)
  VALUES (referrer_row.id, p_referred_user_id, final_reward);

  RETURN jsonb_build_object('success', true, 'referrer_id', referrer_row.id, 'coins_awarded', final_reward);
END;
$$;

-- service_role فقط (تُستدعى من Make.com بعد تأكيد الدفع)
REVOKE EXECUTE ON FUNCTION award_referral_coins FROM authenticated;
REVOKE EXECUTE ON FUNCTION award_referral_coins FROM anon;
GRANT  EXECUTE ON FUNCTION award_referral_coins TO service_role;

-- ─────────────────────────────────────────────────────────────
-- STEP 9: RLS policies لجدول users (إن لم تكن موجودة)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users read own row'
  ) THEN
    EXECUTE 'CREATE POLICY "Users read own row" ON public.users FOR SELECT USING (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users update own row'
  ) THEN
    EXECUTE 'CREATE POLICY "Users update own row" ON public.users FOR UPDATE USING (auth.uid() = id)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- ✅ التحقق من نجاح التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'users'
  AND column_name IN ('search_coins', 'is_founder', 'promo_code', 'promo_expires_at', 'referred_by')
ORDER BY column_name;
