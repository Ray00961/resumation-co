# Resumation.co — Full Technical Audit (READ-ONLY)

**التاريخ:** 6 سبتمبر 2026
**المسار المفحوص:** `D:\AI CV PROJECT\Resumation.co`
**Supabase project:** `nbbxtealrhrnadlzmkev` ("Resumation AI", eu-north-1, PG 17.6)
**Vercel project:** `resumationai-co` (`prj_ezE4aXbvdjR4QJygRxS0OIz6bIBv`, framework: vite, Node 24.x)
**GitHub repo:** `Ray00961/resumation-co` — **public**

**نطاق الفحص:** قراءة فقط. لم يتم تعديل أي ملف، ولا commit، ولا deploy، ولا migration، ولا أي write على Supabase / Vercel / GitHub. كل استعلامات Supabase كانت `SELECT` بحتة على الـ catalog (pg_policies, pg_proc, information_schema, counts). لم تُعرض أي قيمة سرية.

**اصطلاحات التقرير:**
- **Confirmed** = تحققت منه فعليًا من الكود أو من قاعدة البيانات الحيّة.
- **Potential** = منطق الكود يدل عليه لكن يعتمد على شرط بيئي لم أستطع رؤيته.
- **Needs Verification** = لم أستطع التأكد (مثلاً: قيم Supabase Secrets، أو كود Edge Function غير موجود في الريبو).

---

# A. Executive Summary

## التقييم العام

المشروع فيه **عمل هندسي حقيقي وجيّد** في طبقات معيّنة — محرّك توليد الـ CV (CV JSON v1 + DOCX builder) مبني بشكل معماري نظيف ومقسّم بشكل ممتاز، ونمط التحقق من الـ JWT داخل Edge Functions مكتوب بوعي، و`manage-coins` و`spend_coins` مصممان بشكل صحيح ضد race conditions.

لكن **طبقة الأمان التجارية (commerce security layer) شبه غائبة**. المشكلة الجوهرية والمتكررة هي نفسها في كل مكان:

> **الخادم يثق ببيانات قادمة من المتصفّح في القرارات التي تحدد "هل دفع المستخدم؟" و"كم دفع؟" و"ماذا يستحق؟"**

هذا ليس bug واحد — هو **نمط معماري** يظهر في 6 مواضع مستقلة (RLS grants، create-cv-order، confirm-payment، webhook-wishmoney، search-jobs، cookie الـ region). أي واحد منها كافٍ لوحده للحصول على المنتج المدفوع مجانًا.

بالإضافة إلى ذلك، هناك **3 مسارات وظيفية مكسورة فعليًا الآن في الإنتاج** (تحليل الـ CV، خصم الـ coins، عدّاد الشركات في الصفحة الرئيسية)، وهذا مؤكَّد بالأرقام: `cv_analysis_requests` فيه **0 صفوف** و`downloads` فيه **0 صفوف** رغم أن الميزتين "مطلَقتان".

الأرقام الحيّة من قاعدة البيانات تقول إن المشروع **ما زال قبل الإطلاق الحقيقي**:

| المقياس | القيمة |
|---|---|
| `auth.users` | 21 |
| `public.users` | 16 (**5 حسابات بلا صف**) |
| `public.profiles` | 8 (**تقاطع صفري مع users.id**) |
| `order_generations` (طلبات مدفوعة) | **2** — كلاهما WishMoney/premium |
| طلبات Paymob ناجحة | **0** (مسار مصر لم يُختبر إنتاجيًا إطلاقًا) |
| `cv_analysis_requests` | 0 |
| `downloads` | 0 |
| آخر deploy إنتاجي | ~22 يونيو 2026 (منذ ~2.5 شهر) |

هذا في الواقع **خبر جيد**: الثغرات المالية موجودة لكن لم يستغلها أحد بعد، ولا يوجد حجم بيانات كبير يجعل الإصلاح مؤلمًا. النافذة الزمنية للإصلاح مفتوحة الآن.

## نسبة الجاهزية للإنتاج

| المحور | النسبة | ملاحظة |
|---|---|---|
| **Feature completeness** | ~65% | المسار الأساسي (بناء CV → دفع → توليد → تحميل) يعمل من طرف لطرف |
| **Security & commerce integrity** | **~20%** | 7 ثغرات Critical تسمح بالحصول على المنتج مجانًا |
| **Data integrity** | ~40% | تعارض هوية بين `users`/`profiles`، صفوف يتيمة، لا أعمدة موثوقة للسعر |
| **Code quality / maintainability** | ~45% | 10 ملفات فوق 30KB، أحدها 172KB؛ 118 `console.*` في الإنتاج |
| **Deployment / DevOps** | ~35% | لا staging، لا type-check في الـ build، 3 Edge Functions منشورة خارج الريبو |
| **Performance** | ~30% | bundle واحد 2.42 MB بلا code splitting |
| **الجاهزية الإجمالية للإنتاج** | **≈ 33%** | |

> **الخلاصة الرقمية:** المشروع جاهز تقنيًا ليعمل، لكنه **غير جاهز ماليًا** — أي شخص لديه حساب يستطيع اليوم أخذ المنتج المدفوع مجانًا في أقل من دقيقتين، دون أي أداة اختراق.

## أخطر 10 مشاكل — مرتبة حسب الخطورة

| # | Severity | المشكلة | الأثر المباشر |
|---|---|---|---|
| **1** | 🔴 Critical | أي مستخدم مسجّل يستطيع `INSERT` صف في `order_generations` بـ `package_name='gold'` مباشرة من المتصفّح — و`generate-cv` يثق بهذا الحقل | **الحصول على باقة Gold كاملة (CV + Cover Letter) مجانًا** |
| **2** | 🔴 Critical | `authenticated` يملك صلاحية `UPDATE` على عمود `users.search_coins` (و`is_founder` و`promo_code`) | **عملات لا نهائية** لـ AI Hunter والتحليل |
| **3** | 🔴 Critical | `search-jobs` مفتوح تمامًا (`verify_jwt=false` + لا `getUser` + لا خصم coins) | **استنزاف مالي غير محدود** لمفتاح Brave Search + قراءات service_role |
| **4** | 🔴 Critical | مبلغ الدفع (`amount`) يُحسب في المتصفّح ويُرسل كما هو إلى WishMoney | **دفع 0.01$ مقابل باقة 40$** |
| **5** | 🔴 Critical | `verifyPaymobTransaction` **fail-open** في 3 حالات + `plan` يأتي من العميل + لا تحقق من المبلغ | **ترقية الباقة مجانًا / إعادة استخدام order_id لمستخدم آخر** |
| **6** | 🔴 Critical | سياسة storage على `cv_imports` بلا تحديد مجلد المستخدم | **أي مستخدم مسجّل يقرأ ويحذف السير الذاتية الخام لكل المستخدمين** (PII كاملة) |
| **7** | 🔴 Critical | استدعاءات `spend_coins` تُسقط الوسيط الإلزامي `p_user_id` | **مسار تحليل الـ CV مكسور بالكامل لكل المستخدمين** — رسالة "رصيد غير كافٍ" كاذبة |
| **8** | 🟠 High | `get_public_profile` يتجاهل `public_profile_enabled` و`profile_visibility` | **الملفات الـ 8 المعلَّمة "private" كلها مقروءة علنًا** |
| **9** | 🟠 High | `auth-on-signup` يكتب `profiles.id` بدل `profiles.user_id` | **21 حساب auth ↔ 16 users ↔ 8 profiles بتقاطع صفري** — onboarding مكسور |
| **10** | 🟠 High | سعر المنطقة يُحدَّد من cookie قابل للتعديل (`user_region`) + خصم الإحالة 50% يُحسب في المتصفّح | **مراجحة سعرية: دفع سعر مصر (~5$) بدل سعر لبنان (25$)** |

---

# B. Current Architecture

## نظرة عامة

```
┌────────────────────────────────────────────────────────────┐
│  Vercel (framework: vite, Node 24.x)                       │
│  ├── SPA build → dist/assets/index-*.js  (2.42 MB, single) │
│  ├── /api/geo.ts  (Node lambda — يُنشر رغم runtime:"edge") │
│  └── vercel.json → CSP + security headers + SPA rewrite    │
└───────────────┬────────────────────────────────────────────┘
                │  anon key (مضمّن في الـ bundle)
                ▼
┌────────────────────────────────────────────────────────────┐
│  Supabase (nbbxtealrhrnadlzmkev)                           │
│  ├── Auth: Google OAuth فقط                                │
│  ├── Postgres 17: 13 جدول + RLS + RPCs                     │
│  ├── Storage: cv-documents, cv_uploads, cv_imports,        │
│  │            avatars, covers                              │
│  └── 23 Edge Function (Deno)                               │
└───────────────┬────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬──────────────┬─────────────┐
    ▼           ▼           ▼              ▼             ▼
 OpenAI      Paymob      WishMoney      Brave         Resend
 (4o/4o-mini) (مصر)      (لبنان)       Search        (إيصالات)
```

## Frontend

- **React 19.2 + Vite 7 + TypeScript 5.9 + Tailwind 3.4 + react-router-dom 7**
- **بلا code splitting** — `vite.config.ts` هو الافتراضي بالكامل (5 أسطر)، لا `manualChunks`، ولا `React.lazy` في أي مكان → كل الصفحات في bundle واحد.
- **State:** Context بسيط فقط (`LanguageContext` للـ ar/en + RTL، `SidebarContext`). لا Redux/Zustand/React Query. كل جلب بيانات يدوي داخل `useEffect`.
- **Routing:** 24 مسار في `src/App.tsx`، منها 5 أسماء مكرّرة لنفس المكوّن (`/account` + `/my-account`، `/analyse` + `/career-analysis`، `/build` + `/builder` + `/resume-builder`).
- **الحماية:** `ProtectedRoute` عميلة بالكامل (تفاصيل في D).
- **i18n:** كائنات ترجمة مكرّرة داخل كل مكوّن (`const t = lang==='ar' ? {...} : {...}`) — لا مكتبة i18n.

## Backend / API

طبقتان منفصلتان:
1. **Vercel Serverless:** ملف واحد فقط — `api/geo.ts` (قراءة headers الجغرافية).
2. **Supabase Edge Functions (Deno):** كل منطق العمل. 23 دالة منشورة، 20 منها في الريبو.

## Supabase — قاعدة البيانات

| الجدول | صفوف | RLS | الدور |
|---|---|---|---|
| `users` | 16 | ✅ | ملف المستخدم + `search_coins` + `promo_code` |
| `profiles` | 8 | ✅ | الملف المهني العام/الخاص |
| `cv_archive` | 11 | ✅ | مسوّدات نموذج الـ CV (`form_id` = PK) |
| `order_generations` | 2 | ✅ | **محور النظام** — طلب مدفوع + snapshot + مخرجات |
| `coin_transactions` | 3 | ✅ | دفتر العملات |
| `downloads` | 0 | ✅ | سجل التحميلات (لا يُكتب فعليًا) |
| `cv_analysis_requests` | 0 | ✅ | طلبات تحليل ATS (لا يُكتب فعليًا) |
| `companies` | 971 | ✅ بلا سياسات | قاعدة شركات AI Hunter |
| `discovered_companies` | 6 | ✅ بلا سياسات | مخرجات `discover-career-pages` |
| `hv2_search_log` / `hv2_candidate_log` / `hv2_seen` | 0 | ✅ بلا سياسات | Hunter v2 — بنية جاهزة، غير مستخدمة |
| `profiles_backup_2026_06_13` | 1 | ✅ بلا سياسات | **جدول نسخ احتياطي متروك** |

**RPCs الحيّة:**
- `spend_coins(p_user_id uuid, p_amount int, p_reason text, p_reference text DEFAULT NULL)` — `SECURITY DEFINER`، يتحقق من `auth.uid()`، يستخدم `FOR UPDATE`. **مكتوب بشكل صحيح.**
- `award_coins(p_user_id uuid, p_plan text, p_reference text DEFAULT NULL)` — `service_role` فقط. ✅
- `award_referral_coins(p_new_user_id uuid, p_plan_purchased text)` — **لا يُستدعى من أي مكان في الكود.**
- `get_public_profile(p_username text)` / `get_public_profile_stats(uuid)` — `SECURITY DEFINER`، مفتوحان لـ `anon`.

**Storage buckets:** `cv-documents` (المخرجات المولّدة)، `cv_uploads` (رفع للتحليل)، `cv_imports` (رفع للاستيراد)، `avatars`، `covers`.

## Edge Functions — الحالة الحيّة

| الدالة | `verify_jwt` | `getUser()` في الكود | الحالة الأمنية |
|---|---|---|---|
| `generate-cv` | ✅ true | ✅ | محمية |
| `generate-free-cv` | ✅ true | ✅ | محمية |
| `create-cv-order` | ✅ true | ✅ | محمية (لكن تثق بـ `amount`) |
| `confirm-payment` | ✅ true | ✅ | محمية (لكن تثق بـ `plan`) |
| `manage-coins` | ✅ true | ✅ | محمية |
| `delete-account` | ✅ true | ✅ | محمية |
| `generate-cv-bullets` | ✅ true | ✘ | محمية بالبوابة فقط |
| `generate-profile-summary` | ✅ true | ✘ | محمية بالبوابة فقط |
| `suggest-job-titles` / `suggest-position-titles` | ✅ true | ✘ | محمية بالبوابة فقط |
| `auth-on-signup` | ✅ true | ✘ | ⚠️ hook — انظر D-13 |
| `analyze-cv` | ❌ false | ✅ | محمية بالكود |
| `generate-career-snapshot` | ❌ false | ✅ | محمية بالكود |
| `user-sync` | ❌ false | ✅ | محمية بالكود |
| `public-platform-stats` | ❌ false | ✘ | عامة بالتصميم |
| `webhook-wishmoney` | ❌ false | n/a | HMAC token |
| `webhook-paymob` | ❌ false | ? | **الكود غير موجود في الريبو** |
| **`search-jobs`** | ❌ **false** | ✘ | 🔴 **مفتوحة تمامًا** |
| **`discover-career-pages`** | ❌ **false** | ✘ | 🔴 **مفتوحة تمامًا** |
| **`parse-cv-import`** | ❌ **false** | ✘ | 🔴 **مفتوحة تمامًا** |
| **`test-brave-search`** | ❌ **false** | ✘ | 🔴 **دالة اختبار منشورة** |
| **`enrich-descriptions`** | ❌ **false** | ? | **الكود غير موجود في الريبو** |
| `hunter-v2-test` | ✅ true | ? | **الكود غير موجود في الريبو** |

## Auth

- Google OAuth فقط (`supabase.auth.signInWithOAuth`)، `redirectTo: ${origin}/login`.
- لا email/password، لا magic link.
- `jwt_expiry = 3600`، refresh token rotation مفعّل.
- بعد الدخول: `LoginPage` → `user-sync` (يحدّث `users` بالمنطقة واللغة والإحداثيات).
- **Leaked-password protection معطّل** (تحذير من Supabase advisor) — غير مؤثر حاليًا لعدم وجود كلمات مرور.

## Payments

**مساران منفصلان تمامًا:**

**لبنان — WishMoney (stateless):**
```
PlansPage → create-cv-order {plan, amount من المتصفّح}
          → WishMoney API → collectUrl
          → المستخدم يدفع
          → WishMoney callback/redirect → webhook-wishmoney?...&wt=HMAC
          → التحقق من HMAC(secret, "tid:fid")
          → INSERT order_generations + award_coins + إيصال Resend
          → redirect /success?gid=...
```

**مصر — Paymob (standalone links):**
```
PlansPage → create-cv-order → رابط Paymob ثابت للباقة
          → المستخدم يدفع على صفحة Paymob
          → عودة إلى /success?order=<paymob_order_id>
          → SuccessPage → confirm-payment {paymob_order_id, plan من المتصفّح}
          → verifyPaymobTransaction (fail-open)
          → INSERT order_generations + award_coins + إيصال
```

## AI

| الاستخدام | النموذج | max_tokens |
|---|---|---|
| `generate-cv` — CV JSON | gpt-4o | 8192 |
| `generate-cv` — Cover Letter | gpt-4o | 4096 |
| `generate-free-cv` | gpt-4o-mini | 3000 |
| `parse-cv-import` | gpt-4o-mini | 4500 |
| `generate-career-snapshot` | gpt-4o-mini | — |
| `analyze-cv` | gpt-4o | — |
| `generate-cv-bullets` | gpt-4o-mini | 850 |
| `generate-profile-summary` | gpt-4o-mini | 400 |
| `suggest-*-titles` | gpt-4o-mini | 200–350 |

الـ prompts مخزّنة كـ string ثوابت ضخمة داخل `generate-cv/index.ts` (`SYSTEM_PROMPT_EN` ~318 سطر، `SYSTEM_PROMPT_AR` ~199 سطر، `CL_PROMPT_EN/AR`) — أي ~80% من ملف الـ 99KB هو نصوص prompts. نسخ منفصلة أيضًا في `prompts/*.ts` و`prompts/*.md` و`docs/*.md`.

**لا يوجد rate limiting على أي دالة AI.**

## Job Search (AI Hunter)

- `search-jobs`: يقرأ `companies WHERE search_ready=true` بمفتاح service_role، ثم يبني استعلامات Brave Search لكل شركة، ويصنّف النتائج (`official_job` / `external_job_board` / `career_page` / `noise`).
- `discover-career-pages`: يكتشف صفحات التوظيف ويكتب في `discovered_companies`.
- الواجهة `src/pages/JobHunterPage.tsx` — **نموذج أولي داخلي معروض في الإنتاج** (انظر L).

## Deployment

- كل commit على `master` → **deploy إنتاجي مباشر**. لا فرع staging، لا preview environment، لا PR flow.
- آخر deploy: `dpl_TDDXJ3Md8c6US1Hr3yuVFSZagDft` — commit `1e6cb5a` "JobHunterPage_fixed_final".
- Edge Functions تُنشر يدويًا عبر Supabase CLI — **خارج دورة الـ CI**.

---

# C. What Is Working

هذه الأجزاء فحصتها ووجدتها سليمة ومكتملة:

### ✅ محرّك DOCX (CV Engine 2.0) — أفضل جزء في المشروع
`supabase/functions/generate-cv/docx/` مقسّم بشكل نموذجي: `builders/` + `renderers/` (9 ملفات، كل واحد لقسم) + `templates/` (4 قوالب: professional / fresh-graduate + نسختان عربيتان) + `styles/` + `utils/`. مع `schemas/cv-json-v1.ts` و`validators/validate-cv-json.ts` و`normalize-cv-json.ts`، وبيانات اختبار (`test-data/*.sample.json`) ومخرجات مرجعية (`test-output/*.docx`) تشمل اختبار RTL. هذا مستوى هندسي جيد جدًا ويجب الحفاظ عليه كما هو.

### ✅ نمط التحقق من JWT في Edge Functions
النمط المتكرر صحيح تمامًا: قراءة `Authorization: Bearer`، التحقق عبر `authDb.auth.getUser(token)` بمفتاح anon، ثم **أخذ `user_id` من الـ token دائمًا وليس من الـ body** — وهذا موثّق بتعليق صريح في `create-cv-order`، `confirm-payment`، `manage-coins`، `user-sync`. النية الأمنية صحيحة؛ المشكلة أن حقولًا *أخرى* (plan، amount) لم تُعامل بنفس الصرامة.

### ✅ `spend_coins` RPC (النسخة الحيّة)
```sql
IF auth.uid() IS DISTINCT FROM p_user_id THEN RETURN 'unauthorized';
IF p_amount <= 0 THEN RETURN 'amount_must_be_positive';
SELECT search_coins ... FOR UPDATE;   -- قفل الصف
```
تحقق ملكية + منع المبالغ السالبة + قفل صف ضد race condition + كتابة في الدفتر. **صحيحة تمامًا.**

### ✅ `manage-coins` Edge Function
يمنع صراحةً عملية `add` من العميل، ويستخدم عميلًا user-scoped (وليس service_role) عند استدعاء `spend_coins` حتى يعمل `auth.uid()` — وهذا فهم دقيق لسلوك PostgREST. (لكن الاستدعاء نفسه فيه bug — انظر D-7.)

### ✅ Idempotency في `webhook-wishmoney`
- فحص مسبق على `wishmoney_order_id`.
- **فهرس فريد جزئي حقيقي موجود في قاعدة البيانات**: `order_generations_wishmoney_order_id_unique ... WHERE wishmoney_order_id IS NOT NULL` — تحققت منه في `pg_indexes`.
- التقاط `23505` وإعادة قراءة الصف الفائز بدل إنشاء تكرار.
- توقيع HMAC-SHA256 لكل معاملة + مقارنة `timingSafeEqual`.

هذا تصميم جيد فعلاً. المشكلة الوحيدة أن الـ HMAC لا يغطي `plan` و`amount`.

### ✅ سياسات storage الخاصة بـ `cv_uploads` و`avatars` و`covers`
```sql
(storage.foldername(name))[1] = auth.uid()::text
```
تحديد صحيح لمجلد المستخدم. والكود في `CareerAnalysis.tsx:375` يرفع فعلاً على `${user.id}/${Date.now()}_${file.name}` — متوافق.

### ✅ Security headers في `vercel.json`
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, وCSP مع `frame-ancestors 'none'`. وجود CSP أصلاً في مشروع بهذا الحجم أمر جيد (رغم ملاحظتين عليه في H).

### ✅ `.gitignore` يغطي الأسرار
`.env`, `.env.local`, `.env*.local`, `.vercel`, `full_database_backup.sql` كلها مستثناة. وتحققت أن `VITE_PAYMOB_API_KEY` **غير موجود** في الـ bundle المبني (`dist/assets/index-CD9Awczp.js`) — لأنه غير مُشار إليه في أي كود.

### ✅ `ProtectedRoute` — التعامل مع تعليق التخزين
آلية `getSessionWithTimeout(5000)` تمنع تعليق التطبيق إذا كان تخزين Supabase مقفولًا. فكرة جيدة (لكن الـ fast-path مشكلة — انظر D-11).

### ✅ `BuildingPage` — polling + Realtime مزدوج
اشتراك Realtime على `order_generations` + polling كل 3 ثوانٍ عبر REST كخطة بديلة + timeout بعد 3 دقائق + فحص cache قبل الاستدعاء. تصميم دفاعي سليم.

### ✅ `fn_lock_profile_identity_fields`
دالة مكتوبة بشكل صحيح لمنع تغيير `id`/`user_id`/`username`/`career_form_id`. (لكن **لا يوجد trigger يستدعيها** — انظر D-16.)

### ✅ التوثيق الداخلي
`docs/` فيه 9 ملفات جادة: `CV_JSON_V1_SPEC.md`, `DOCX_BUILDER_ARCHITECTURE.md` (25KB), `CV_DOCX_TYPES_AND_VALIDATOR.md` (18KB), `PRICING_AND_UNIT_ECONOMICS.md`. مستوى توثيق أعلى من المتوسط لمشروع بهذا الحجم.

---

# D. Broken / Risky / Incomplete Areas

---

## 🔴 D-1 — Critical | توليد CV مدفوع مجانًا عبر INSERT مباشر

**الملفات:**
- `supabase/migrations/20260528_order_generations_ddl.sql:99-110`
- `supabase/functions/generate-cv/index.ts:1409-1411`
- صلاحيات الأعمدة الحيّة على `public.order_generations`

**المشكلة (Confirmed):**

سياسات RLS الحيّة على `order_generations`:
```sql
order_gen_insert_own  INSERT  WITH CHECK (auth.uid() = user_id)
order_gen_update_own  UPDATE  USING/CHECK (auth.uid() = user_id)
```
وصلاحيات الأعمدة (من `information_schema.column_privileges`) تعطي دور `authenticated` صلاحية `INSERT` و`UPDATE` على **كل الأعمدة** بما فيها:
`package_name`, `payment_method`, `paymob_order_id`, `wishmoney_order_id`, `transaction_id`, `cv_data`, `cv_pdf_url`.

وفي المقابل `generate-cv/index.ts:1409-1411` يقول حرفيًا:
```ts
// effectivePlan: record.package_name is the authoritative source — written by
// the webhook only after confirmed payment. Never null for a valid paid row.
const effectivePlan: string = record.package_name ?? "premium";
```
`generate-cv` يتحقق من **الملكية فقط** (`record.user_id !== callerUid`) ولا يتحقق إطلاقًا من وجود دفعة.

**سيناريو الاستغلال الكامل (من console المتصفّح، بلا أدوات):**
```js
// 1) إنشاء صف مدفوع وهمي
const { data } = await supabase.from('order_generations').insert({
  user_id: myUid, form_id: myExistingFormId,
  cv_data: myCvData, package_name: 'gold', payment_method: 'wishmoney'
}).select('generation_id').single();

// 2) تشغيل محرّك التوليد المدفوع
await fetch(`${SUPABASE_URL}/functions/v1/generate-cv`, {
  method:'POST', headers:{Authorization:`Bearer ${myJwt}`},
  body: JSON.stringify({ generation_id: data.generation_id, selectedLanguage:'ar' })
});
```

**لماذا هي مشكلة:** الحقل الذي يحدد الاستحقاق المالي قابل للكتابة من العميل، والخادم الذي يستهلكه يعتبره "authoritative".

**التأثير المحتمل:** خسارة 100% من إيرادات باقات Premium/Gold + تكلفة OpenAI (gpt-4o، 8192+4096 توكن لكل استدعاء) بلا سقف. المستخدم يستطيع أيضًا `UPDATE` صفه المجاني الحالي إلى `package_name='gold'`.

**كيف نصلحها:**
1. **إزالة صلاحيات الكتابة كليًا** من العميل — هذا الجدول يجب أن يُكتب فقط بمفتاح service_role:
   ```sql
   DROP POLICY order_gen_insert_own ON public.order_generations;
   DROP POLICY order_gen_update_own ON public.order_generations;
   REVOKE INSERT, UPDATE ON public.order_generations FROM authenticated, anon;
   ```
2. مسار الباقة المجانية (الذي كان يعتمد على INSERT من العميل) يُنقل إلى Edge Function جديدة `create-free-order` تعمل بـ service_role.
3. إضافة عمود `payment_verified boolean NOT NULL DEFAULT false` + `paid_amount numeric` + `paid_currency text`، وفي `generate-cv` رفض أي صف بـ `payment_verified = false`.
4. `CHECK (package_name IN ('free','premium','gold','ai_search'))`.

**هل الإصلاح آمن؟** ⚠️ **يحتاج حذر.** إزالة سياسة `order_gen_update_own` ستكسر تحديث `selected_language` من `SuccessPage.tsx:403`. يجب نقل هذا التحديث إلى Edge Function **قبل** إزالة السياسة، وإلا يتوقف اختيار اللغة. عدد الصفوف الحالي (2) يجعل الهجرة سهلة.

---

## 🔴 D-2 — Critical | عملات لا نهائية عبر UPDATE مباشر على `users`

**الملفات:** `supabase/week1_security_migration.sql:255-259` + صلاحيات الأعمدة الحيّة

**المشكلة (Confirmed):**

السياسة الحيّة:
```sql
users_update_own  UPDATE  USING (auth.uid() = id)  WITH CHECK (auth.uid() = id)
```
وصلاحيات الأعمدة تعطي `authenticated` صلاحية `UPDATE` على:
`search_coins`, `is_founder`, `promo_code`, `promo_expires_at`, `referred_by`, `email`, `username`, `region`, `preferred_language`, ...

السياسة تحمي **أي صف** يستطيع المستخدم تعديله (صفه فقط) — لكنها لا تحمي **أي أعمدة** داخل ذلك الصف.

**الاستغلال:**
```js
await supabase.from('users').update({ search_coins: 999999, is_founder: true }).eq('id', myUid);
```

**لماذا هي مشكلة:** الاقتصاد الداخلي كله (`search_coins`) مبني على عمود يستطيع المستخدم كتابته مباشرة. كل الجهد المبذول في `spend_coins` و`award_coins` و`manage-coins` يصبح بلا قيمة.

**التأثير المحتمل:** استهلاك غير محدود لـ AI Hunter والتحليل؛ تعديل `email` في `public.users` يخلق تضاربًا مع `auth.users.email` (يظهر في الإيصالات وفي `cv_archive`)؛ `promo_code` فريد → يستطيع المستخدم سرقة كود إحالة شخص آخر أو التسبب بتضارب `UNIQUE`.

**كيف نصلحها:**
```sql
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (first_name, last_name, preferred_language, agreed_to_terms)
  ON public.users TO authenticated;
```
(`username` يُغيَّر عبر Edge Function مع تحقق من التفرّد والصيغة؛ `region` يُكتب فقط من `user-sync`.)

**هل الإصلاح آمن؟** ⚠️ يحتاج مراجعة سريعة: تأكد من أي `.from('users').update(...)` في `MyAccount.tsx` و`PrivateProfileV2.tsx` و`LoginPage.tsx` لا يكتب عمودًا خارج القائمة المسموحة. **يجب فحص هذا قبل التنفيذ.**

---

## 🔴 D-3 — Critical | `search-jobs` مفتوحة تمامًا للعالم

**الملفات:** `supabase/functions/search-jobs/index.ts:603+`, `src/pages/JobHunterPage.tsx:128-138`

**المشكلة (Confirmed):**
- `verify_jwt: false` على البوابة (تحققت من `list_edge_functions`).
- لا يوجد `auth.getUser()` في الكود إطلاقًا.
- لا يوجد أي خصم عملات.
- الواجهة ترسل **مفتاح anon نفسه** كـ Bearer:
  ```ts
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
  ```
  والمفتاح موجود بالكامل في الـ bundle العام.
- الدالة تقبل من الـ body:
  ```ts
  companyLimit ≤ 75, queryLimitPerCompany ≤ 10, resultLimit ≤ 100
  ```
  → حتى **750 استدعاء Brave Search لكل طلب واحد**، وعدد الطلبات غير محدود.
- تستخدم `SUPABASE_SERVICE_ROLE_KEY` لقراءة `companies`.

نفس الوضع بالضبط لـ **`discover-career-pages`** (تكتب في `discovered_companies` بمفتاح service_role) و**`parse-cv-import`** (استدعاء OpenAI مباشر) و**`test-brave-search`** (دالة اختبار منشورة في الإنتاج).

**لماذا هي مشكلة:** عنوان الدالة مكتوب حرفيًا في الـ JS العام (`JobHunterPage.tsx:128`). أي شخص يفتح DevTools يراه. لا حاجة لحساب أصلاً.

**التأثير المحتمل:** استنزاف كامل لحصة Brave Search API خلال دقائق؛ فاتورة OpenAI مفتوحة عبر `parse-cv-import`؛ استخراج قاعدة الـ 971 شركة بالكامل؛ حجب الخدمة عن المستخدمين الحقيقيين.

**كيف نصلحها:**
1. **فورًا:** حذف `test-brave-search` من الإنتاج.
2. تفعيل `verify_jwt = true` لـ `search-jobs`, `discover-career-pages`, `parse-cv-import` من لوحة Supabase (أو `config.toml` + إعادة نشر).
3. إضافة `auth.getUser()` داخل الكود (لا تعتمد على البوابة وحدها).
4. ربط `search-jobs` بـ `spend_coins` — هذا هو نموذج التربّح المفترض أصلاً.
5. تقليل الحدود القصوى: `companyLimit ≤ 10`, `queryLimitPerCompany ≤ 2`.
6. `discover-career-pages` عملية إدارية → يجب أن تتطلب دورًا إداريًا أو أن تُشغَّل بـ cron فقط.

**هل الإصلاح آمن؟** ✅ **آمن جدًا.** تفعيل `verify_jwt` على `search-jobs` سيتطلب فقط تغيير سطر واحد في `JobHunterPage.tsx` ليرسل `session.access_token` بدل مفتاح anon. حذف `test-brave-search` بلا أثر إطلاقًا.

---

## 🔴 D-4 — Critical | تلاعب بمبلغ الدفع (WishMoney)

**الملفات:** `src/components/PlansPage.tsx:121-127, 422-436` → `supabase/functions/create-cv-order/index.ts:70, 194`

**المشكلة (Confirmed):**

السعر يُحسب في المتصفّح:
```ts
// PlansPage.tsx:121
const BASE = isEgypt ? {premium:250, gold:400, ai_search:100}
                     : {premium:25,  gold:40,  ai_search:10};
const finalPrice = (plan) => hasReferral && plan!=='ai_search' ? BASE[plan]/2 : BASE[plan];
// :433
const body = { ..., plan, amount: finalPrice(plan), currency: cur };
```
ويُمرَّر كما هو إلى بوابة الدفع:
```ts
// create-cv-order/index.ts:70, 194
const { plan = "premium", amount, currency = "USD" } = body;
...
body: JSON.stringify({ amount: String(amount), currency, ..., externalId: wmExternalId })
```

**لا يوجد جدول أسعار في الخادم على الإطلاق لمسار WishMoney.** ولا تحقق من أن `amount` يطابق `plan`.

**الاستغلال:**
```js
fetch(EF + '/create-cv-order', { method:'POST',
  headers:{Authorization:`Bearer ${jwt}`, 'Content-Type':'application/json'},
  body: JSON.stringify({ form_id, plan:'gold', amount:0.01, currency:'USD', payment_method:'whish' })
});
```
→ WishMoney يحصّل 0.01$ → الدفع ينجح فعلاً → `webhook-wishmoney` ينشئ صف `package_name='gold'` ويمنح 100 عملة.

**تفاقم إضافي:** الـ HMAC في `create-cv-order:157-160` محسوب على `${wmExternalId}:${form_id}` **فقط** — لا يغطي `plan` ولا `amount`. لذا حتى الـ webhook لا يستطيع كشف التلاعب.

**التأثير المحتمل:** خسارة إيرادات لبنان بالكامل + إيصالات صادرة تقول "$40 USD" لعملية دفع 0.01$ (مشكلة محاسبية/قانونية).

**كيف نصلحها:**
1. حذف `amount` و`currency` من الـ body نهائيًا.
2. جدول أسعار في الخادم:
   ```ts
   const PRICES = {
     LB: { premium: 25, gold: 40, ai_search: 10 },
     EG: { premium: 250, gold: 400, ai_search: 100 },
   } as const;
   const amount = PRICES[serverRegion][plan];  // serverRegion من الخادم لا من cookie
   ```
3. توسيع الـ HMAC ليغطي القيم الحسّاسة: `HMAC(secret, ${tid}:${fid}:${plan}:${amount})`.
4. في `webhook-wishmoney`، قبل الـ INSERT: استدعاء WishMoney للتحقق من `externalId` والمبلغ الفعلي المدفوع.

**هل الإصلاح آمن؟** ✅ آمن، لكن تغيير صيغة الـ HMAC سيُبطل أي معاملة معلّقة أثناء النشر. نظرًا لوجود معاملتين فقط في التاريخ، النافذة آمنة الآن.

---

## 🔴 D-5 — Critical | `confirm-payment`: fail-open + الباقة من العميل + order_id غير مرتبط بالمستخدم

**الملف:** `supabase/functions/confirm-payment/index.ts:205-250, 336, 514`

ثلاث مشاكل متراكبة:

### (أ) التحقق يفشل بشكل مفتوح (fail-open) — 3 حالات
```ts
if (!PAYMOB_API_KEY) return { verified: true, reason: "skipped_no_key" };      // :213
if (!authRes.ok)     return { verified: true, reason: "auth_error_failopen" }; // :224
catch (err)          return { verified: true, reason: "exception_failopen" };  // :248
```
إذا لم يكن `PAYMOB_API_KEY` مضبوطًا في Supabase Secrets، **أي مستخدم مسجّل يرسل `paymob_order_id` عشوائي ويحصل على باقة مجانًا**.

> **Needs Verification:** لا أستطيع رؤية Supabase Secrets. تحقق بنفسك:
> `supabase secrets list --project-ref nbbxtealrhrnadlzmkev`
> إذا لم يظهر `PAYMOB_API_KEY` → **هذه ثغرة نشطة الآن**.

### (ب) `plan` يأتي من العميل (Confirmed)
```ts
const plan_hint: string = body.plan ?? "";           // :336
const resolvedPlan = plan_hint || "premium";         // :514
package_name: resolvedPlan,                          // :534
```
و`SuccessPage.tsx:262` يرسله من `URL` أو `sessionStorage`:
```ts
const planHint = urlPlan || sessionStorage.getItem("rsm_plan") || "premium";
```
حتى مع تفعيل التحقق، التحقق يفحص فقط `paid_amount_cents > 0` — **لا يقارن المبلغ بسعر الباقة**. ادفع 250 جنيه (premium) وأرسل `plan:"gold"` → تحصل على Gold.

### (ج) `paymob_order_id` غير مرتبط بالمستخدم (Confirmed)
فحص الـ idempotency:
```ts
.eq("paymob_order_id", paymob_order_id).eq("user_id", user_id)   // :359-360
```
مقيّد بـ `user_id`. ومعرّفات Paymob رقمية متسلسلة. **ولا يوجد فهرس فريد على `paymob_order_id`** (تحققت من `pg_indexes` — الفهرس الفريد موجود لـ `wishmoney_order_id` فقط).

→ المستخدم B يستطيع إعادة استخدام `paymob_order_id` الخاص بالمستخدم A: الـ idempotency لا يُفعَّل (لأن `user_id` مختلف)، والتحقق ينجح (الطلب مدفوع فعلاً)، فيُنشأ صف جديد مجاني.

**التأثير المحتمل:** خسارة إيرادات مصر بالكامل + إمكانية استنساخ كل معاملة ناجحة عبر تخمين أرقام متسلسلة.

**كيف نصلحها:**
1. إزالة كل `fail-open` — الفشل يجب أن يُرجع `verified: false` مع `502`، ورسالة واضحة للمستخدم بالتواصل مع الدعم.
2. حذف `plan` من الـ body. اشتقاق الباقة من `order.amount_cents` مقابل جدول الأسعار الخادمي.
3. `CREATE UNIQUE INDEX ... ON order_generations (paymob_order_id) WHERE paymob_order_id IS NOT NULL;`
4. إزالة `.eq("user_id", user_id)` من فحص الـ idempotency — إذا كان `paymob_order_id` مستخدمًا من قبل لأي مستخدم، ارفض.
5. ربط الطلب بالمستخدم عبر `merchant_order_id` (الكود يمرره أصلاً كـ `${uid}---${formId}` في `PlansPage.tsx:503`) والتحقق منه في الاستجابة.
6. **الأفضل معماريًا:** نقل منح الاستحقاق إلى `webhook-paymob` (موجود منشورًا) بدل الاعتماد على عودة المتصفّح.

**هل الإصلاح آمن؟** ⚠️ يحتاج حذر شديد — يجب اختباره بمعاملة حقيقية في مصر أولاً، خصوصًا أن **مسار Paymob لم ينتج ولا طلبًا واحدًا ناجحًا حتى الآن** (0 صفوف بـ `paymob_order_id`).

---

## 🔴 D-6 — Critical | سياسات storage: تسريب السير الذاتية بين المستخدمين

**المصدر:** `pg_policies` على `storage.objects` (حيّة)

**المشكلة (Confirmed):**

```sql
-- bucket cv_imports — بلا أي تحديد لمجلد المستخدم
"Authenticated users can read CV imports"   SELECT  {authenticated}  USING (bucket_id = 'cv_imports')
"Authenticated users can delete CV imports" DELETE  {authenticated}  USING (bucket_id = 'cv_imports')
"Authenticated users can upload CV imports" INSERT  {authenticated}  WITH CHECK (bucket_id = 'cv_imports')

-- bucket cv-documents — الدور {public}, بلا أي فحص هوية
"Service role write CVs"   INSERT  {public}  WITH CHECK (bucket_id = 'cv-documents')
"Service role update CVs"  UPDATE  {public}  USING (bucket_id = 'cv-documents')
```

**لماذا هي مشكلة:**
- `cv_imports` هو المكان الذي يرفع فيه `ResumeForm.tsx:2229` السير الذاتية الخام (PDF/DOCX). المسار `${userId}/...` لكن السياسة لا تفرضه. **أي مستخدم مسجّل يستطيع سرد وقراءة وحذف سير كل المستخدمين** — وهي وثائق تحتوي على الاسم الكامل، الهاتف، البريد، العنوان، وتاريخ التوظيف الكامل.
- سياستا `cv-documents` مسمّاتان "Service role" لكنهما ممنوحتان للدور `public` — و`service_role` يتجاوز RLS أصلاً ولا يحتاجهما. النتيجة: **أي زائر (حتى غير مسجّل) يستطيع الكتابة والتعديل على bucket المخرجات المولّدة** — أي استبدال ملف CV مدفوع لمستخدم آخر بملف آخر.

**التأثير المحتمل:** خرق بيانات شخصية (PII) بامتياز — GDPR-class. + حذف تخريبي جماعي + استبدال المخرجات المدفوعة.

**كيف نصلحها:**
```sql
DROP POLICY "Authenticated users can read CV imports"   ON storage.objects;
DROP POLICY "Authenticated users can delete CV imports" ON storage.objects;
DROP POLICY "Authenticated users can upload CV imports" ON storage.objects;

CREATE POLICY cv_imports_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='cv_imports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cv_imports_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='cv_imports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cv_imports_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='cv_imports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY "Service role write CVs"  ON storage.objects;
DROP POLICY "Service role update CVs" ON storage.objects;
-- لا بديل مطلوب: service_role يتجاوز RLS
```

**هل الإصلاح آمن؟** ✅ **آمن جدًا وعالي الأولوية.** المسارات في الكود تستخدم `${uid}/` أصلاً، فالسياسات الجديدة متوافقة. حذف سياستَي `cv-documents` لن يؤثر على `generate-cv` لأنه يستخدم service_role.

---

## 🔴 D-7 — Critical | استدعاءات `spend_coins` مكسورة → تحليل الـ CV معطّل بالكامل

**الملفات:** `src/components/CareerAnalysis.tsx:227-231`, `supabase/functions/manage-coins/index.ts:69-73`

**المشكلة (Confirmed):**

توقيع الدالة الحيّة:
```
spend_coins(p_user_id uuid, p_amount integer, p_reason text, p_reference text DEFAULT NULL::text)
```
`pronargdefaults = 1` → **`p_user_id` إلزامي وليس له قيمة افتراضية.**

الاستدعاء في الواجهة:
```ts
// CareerAnalysis.tsx:227
const { error } = await supabase.rpc('spend_coins', {
  p_amount: amount, p_reason: reason, p_reference: subId ?? currentRecordId ?? user.id,
});   // ← p_user_id مفقود
```
والاستدعاء في `manage-coins/index.ts:69` مطابق (بلا `p_user_id`).

PostgREST يطابق الدوال بأسماء الوسائط المُرسلة → لا يجد أي دالة مطابقة → `PGRST202`.

ثم الكود يفسّر أي خطأ بأنه نقص رصيد:
```ts
if (error) {
  toast.error("Insufficient coin balance — please top up on the Plans page.");
  navigate('/plans');
  return false;
}
```

**لماذا هي مشكلة:** **كل مستخدم** — مهما كان رصيده — يُخبَر أن رصيده غير كافٍ ويُحوَّل إلى صفحة الباقات. الميزة ميتة تمامًا، والرسالة الظاهرة تخفي السبب الحقيقي.

**دليل مؤكِّد:** `cv_analysis_requests` فيه **0 صفوف** رغم أن الميزة معروضة في الواجهة، و`coin_transactions` فيه 3 صفوف فقط (كلها من `award_coins`).

**كيف نصلحها:**
إما إضافة الوسيط في مكاني الاستدعاء:
```ts
await supabase.rpc('spend_coins', { p_user_id: user.id, p_amount, p_reason, p_reference });
```
**أو الأفضل** — إعطاء `p_user_id` قيمة افتراضية في قاعدة البيانات (الدالة تتحقق من `auth.uid()` داخليًا على أي حال):
```sql
CREATE OR REPLACE FUNCTION public.spend_coins(
  p_amount integer, p_reason text, p_reference text DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
) ...
```
⚠️ الحل الثاني ينشئ overload — **يجب حذف النسخة القديمة أولاً** وإلا يصبح الاستدعاء غامضًا.

وبشكل منفصل: **إصلاح رسالة الخطأ** لتفرّق بين `insufficient_coins` وبين خطأ تقني. الرسالة الحالية تضلّل المستخدم والمطوّر معًا.

**هل الإصلاح آمن؟** ✅ آمن. الإصلاح الأول (تمرير `p_user_id`) لا يمس قاعدة البيانات إطلاقًا — ابدأ به.

---

## 🟠 D-8 — High | `get_public_profile` يتجاهل إعدادات الخصوصية

**المصدر:** جسم الدالة الحيّة (`pg_proc.prosrc`)، `src/pages/PublicProfile.tsx:279`

**المشكلة (Confirmed):**

الدالة `SECURITY DEFINER` ومنفَّذة من `anon` عبر `/rest/v1/rpc/get_public_profile`:
```sql
select * into p from public.profiles where username = p_username limit 1;
if not found then return null; end if;
-- ثم تُرجع البيانات مباشرة
```
**لا يوجد أي فحص لـ `public_profile_enabled` ولا `profile_visibility`.**

الشرط الوحيد هو `is_paid` (يوسّع البيانات المعروضة للمشتركين):
```sql
is_paid := p.active_plan is not null and lower(btrim(p.active_plan)) not in ('free','starter','none','trial','');
```

الجدول يحتوي فعليًا على عمودَي `public_profile_enabled` و`profile_visibility` مع `CHECK (profile_visibility IN ('private','public'))` — البنية موجودة لكن لا أحد يقرأها.

**الحالة الحيّة:** الـ 8 ملفات كلها `profile_visibility='private'` و`public_profile_enabled=false` — **ومع ذلك جميعها قابلة للقراءة العامة الآن.**

المكشوف دائمًا: الاسم، الاسم العربي، الجنس، الجنسية، الموقع، الصورة، الغلاف، المسمى، الوظيفة المستهدفة، المستوى المهني، الملخص الذكي، أول 3 مهارات، أول مؤهل تعليمي، مستوى اللغات.
وللمشتركين إضافةً: الخبرة الكاملة، كل المهارات، كل التعليم، الروابط، الإحصاءات، والبريد/الهاتف إذا كانت الأعلام مفعّلة.

**التناقض الأوضح:** نص الواجهة في `PublicProfile.tsx:200` يقول: *"This username doesn't exist on Resumation.co **or the profile is private**"* — أي أن السلوك المقصود موجود في نص الرسالة لكن غير مطبَّق في أي مكان.

**كيف نصلحها:**
```sql
select * into p from public.profiles where username = p_username limit 1;
if not found
   or coalesce(p.public_profile_enabled, false) = false
   or coalesce(p.profile_visibility, 'private') <> 'public'
then
  return null;
end if;
```

**هل الإصلاح آمن؟** ✅ آمن — لكنه **سيُخفي كل الملفات الـ 8 فورًا** (لأن جميعها private). هذا هو السلوك الصحيح، لكن أبلغ المستخدمين أو فعّل العَلَم لمن يريد الظهور. `get_public_profile_stats` يحتاج نفس المعالجة.

---

## 🟠 D-9 — High | `auth-on-signup` يكتب في العمود الخاطئ → onboarding مكسور

**الملف:** `supabase/functions/auth-on-signup/index.ts:63-67`

**المشكلة (Confirmed بالأرقام):**

```ts
await db.from("profiles").upsert({
  id: userId,                        // ← auth uid في عمود id
  first_name: ..., last_name: ...,
}, { onConflict: "id", ignoreDuplicates: true });
```

لكن بنية `profiles` الحيّة:
- `profiles_pkey PRIMARY KEY (id)` — معرّف مستقل
- `profiles_user_id_key UNIQUE (user_id)` + `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` — **هذا هو الرابط الحقيقي**

وكل سياسات RLS الحيّة على `profiles` تستخدم `user_id`:
```sql
profiles_select_own  SELECT  {authenticated}  USING (auth.uid() = user_id)
profiles_insert_own  INSERT  {authenticated}  WITH CHECK (auth.uid() = user_id)
profiles_update_own  UPDATE  {authenticated}  USING/CHECK (auth.uid() = user_id)
```

الدالة تكتب `id` ولا تكتب `user_id` أبدًا.

**الأدلة الرقمية من قاعدة البيانات:**
```
auth.users              = 21
public.users            = 16   ← 5 حسابات بلا صف
public.profiles         =  8
profiles WHERE user_id IS NULL = 0
users بلا profile مطابق بالـ id = 16  ← تقاطع صفري تام
```
التقاطع الصفري يثبت أن `profiles.id` ليس أبدًا الـ auth uid. الملفات الـ 8 الموجودة أُنشئت بمسار آخر (على الأرجح `LoginPage`/`generate-career-snapshot`)، وليس بواسطة `auth-on-signup`.

**لماذا هي مشكلة:** أي مستخدم يعتمد على هذه الدالة لن يحصل على صف profile صالح، أو سيحصل على صف بـ `user_id = NULL` لا يستطيع قراءته أو تعديله بسبب RLS. والفجوة 21 → 16 تعني أن 5 حسابات بلا صف `users` أصلاً (بلا عملات، بلا promo_code).

**مشاكل ثانوية في نفس الملف:**
- `const is_founder = new Date() < new Date("2026-07-01T00:00:00Z")` — تاريخ ثابت **مضى** → دائمًا `false` الآن.
- منطق توليد `promo_code` مكرر في 3 أماكن بأبجديات مختلفة: `fn_generate_promo_code()` في الـ trigger (`md5(random())`), وفي `week1_security_migration.sql` (`gen_random_bytes`), وهنا (أبجدية مخصصة `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
- `verify_jwt: true` على دالة يُفترض أنها Auth Hook. **Needs Verification:** هل الـ Hook مفعّل أصلاً في لوحة Supabase؟ الفجوة 21↔16 تشير إلى أنه يعمل بشكل متقطّع أو لا يعمل.

**كيف نصلحها:**
1. تصحيح الـ upsert:
   ```ts
   await db.from("profiles").upsert({
     user_id: userId, first_name, last_name
   }, { onConflict: "user_id", ignoreDuplicates: true });
   ```
2. حذف `is_founder` الثابت أو نقله إلى إعداد قابل للتغيير.
3. توحيد توليد `promo_code` في مكان واحد (فضّل الـ DB trigger).
4. التحقق من تفعيل الـ Hook، ثم backfill للحسابات الـ 5 الناقصة والـ 8 الناقصة.

**هل الإصلاح آمن؟** ⚠️ يحتاج حذر — **افحص البيانات أولاً** لتحديد أي المسارات أنشأت الملفات الـ 8 قبل التعديل، وإلا قد تنشئ صفوفًا مكررة.

---

## 🟠 D-10 — High | مراجحة سعرية عبر cookie قابل للتعديل

**الملفات:** `src/utils/detectRegion.ts:75-78`, `src/components/PlansPage.tsx:110, 114, 121`

**المشكلة (Confirmed):**

```ts
// detectRegion.ts:76 — الكتابة في cookie عادي بلا توقيع
Cookies.set("user_region", r, { expires: 7 });

// PlansPage.tsx:110
const [userRegion] = useState<string>(Cookies.get("user_region") || "LB");
const isEgypt = userRegion === "EG";                              // :114
const BASE = isEgypt ? {premium:250,...} : {premium:25,...};      // :121
```

فرق السعر حقيقي وكبير: **250 جنيه ≈ 5$ مقابل 25$** لنفس الباقة — فرق 5×.

المستخدم يكتب في console:
```js
document.cookie = "user_region=EG";
```
ثم يعيد التحميل → يرى أسعار مصر ويُوجَّه إلى Paymob.

**لماذا هي مشكلة:** المنطقة معلومة أمنية-تسعيرية تُحدَّد بالكامل على العميل.

**التأثير المحتمل:** كل مستخدم لبناني يستطيع دفع سعر مصر — خسارة 80% من قيمة كل معاملة.

**مشكلة مرتبطة:** `hasReferral` يخصم 50% (`finalPrice`) وهو حالة React محلية. في مسار WishMoney يخفض المبلغ فعليًا (D-4). في مسار Paymob **رابط الدفع بمبلغ ثابت** → **الخصم يُعرض في الواجهة ولا يُطبَّق على الدفع في مصر.** خلل تجربة مستخدم + شكوى محتملة.

**كيف نصلحها:**
1. في `create-cv-order`، اشتقاق المنطقة من `x-vercel-ip-country` أو من `users.region` (المكتوب بواسطة `user-sync`)، وليس من الـ body/cookie.
2. التحقق من `hasReferral` في الخادم عبر `users.referred_by` + `referral_log`.
3. إنشاء روابط Paymob ديناميكية (Paymob Payment Intention API) بدل standalone links ثابتة، ليعمل الخصم.

**هل الإصلاح آمن؟** ⚠️ يحتاج حذر — تغيير مصدر المنطقة قد يغيّر السعر المعروض لمستخدمين حاليين. اختبره بـ VPN من البلدين.

---

## 🟠 D-11 — High | `ProtectedRoute` قابل للتجاوز من localStorage

**الملف:** `src/components/ProtectedRoute.tsx:10-42, 89-93`

**المشكلة (Confirmed):**
```ts
function readCachedSupabaseUserId(): string | null {
  const lsKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
  const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
  const userId = cached?.user?.id || cached?.session?.user?.id || ...;
  if (!userId) return null;
  if (expiresAt && Number(expiresAt)*1000 < Date.now() - 60_000) return null;  // ← الشرط يُتخطّى إذا expiresAt مفقود
  return userId;
}
// :89
const cachedUserId = readCachedSupabaseUserId();
if (cachedUserId) { allow(); return; }   // ← يُسمح فورًا بلا أي تحقق من التوقيع
```

`localStorage.setItem('sb-x-auth-token', '{"user":{"id":"anything"}}')` كافٍ للدخول إلى كل الصفحات المحمية. ولا يوجد `expires_at` في هذا الكائن → فحص الانتهاء يُتخطّى.

**لماذا هي مشكلة:** هذا **حاجز واجهة فقط**. البيانات الحقيقية محمية بـ RLS، لذا التأثير محدود — **إلا** حيثما تكون RLS ضعيفة، وهي ضعيفة في هذا المشروع (D-1, D-2, D-6). الاثنان معًا يشكّلان سلسلة استغلال كاملة.

**التأثير المحتمل:** صفحات فارغة/مكسورة للمهاجم في أغلب الحالات، لكن مع D-1/D-2 يصبح مسارًا مريحًا للاستغلال.

**كيف نصلحها:** استخدم الـ fast-path لعرض هيكل الصفحة فقط، ثم تحقّق دائمًا:
```ts
const cachedUserId = readCachedSupabaseUserId();
if (cachedUserId) setAllowed(true);           // عرض متفائل
const { data } = await supabase.auth.getSession();
if (!data.session?.user) reject();             // تحقق دائم، بلا استثناء
```

**هل الإصلاح آمن؟** ✅ آمن. الفائدة الحقيقية تأتي من إصلاح RLS (D-1/D-2)، وهذا الإصلاح تحسين دفاعي مكمّل.

---

## 🟠 D-12 — High | `webhook-wishmoney` يُرجع 200 عند فشل الـ INSERT

**الملف:** `supabase/functions/webhook-wishmoney/index.ts:443-454, 503-510`

**المشكلة (Confirmed):**
```ts
console.error("webhook-wishmoney: INSERT into order_generations failed", insertErr);
return new Response(
  JSON.stringify({ error: "Failed to create order_generation row", ... }),
  { status: 200, ... }     // ← 200 عند الفشل
);
```
ونفس الشيء في الـ `catch` العام (`:508`) وفي خطأ فحص الـ idempotency (`:315`).

**لماذا هي مشكلة:** WishMoney سيعتبر الـ callback ناجحًا ولن يعيد المحاولة. المال حُصِّل، لا صف تولّد، لا عملات مُنحت، لا إيصال، والمستخدم لا يحصل على شيء — ولا يوجد صف في قاعدة البيانات يدل على أن هناك دفعة ضائعة.

**التأثير المحتمل:** خسارة مالية صامتة للعميل بلا أثر قابل للاسترجاع. لا يوجد سجل معاملات مستقل عن `order_generations` لكشف هذه الحالات.

**كيف نصلحها:**
1. إرجاع `500` عند الفشل الحقيقي حتى تُعيد WishMoney المحاولة (احتفظ بـ 200 لحالات "processed already" فقط).
2. إنشاء جدول `payment_events` يُكتب فيه كل callback خام **قبل** أي معالجة — ليصبح لديك سجل تدقيق مستقل.
3. تنبيه (Slack/email) عند فشل الـ INSERT.

**هل الإصلاح آمن؟** ✅ آمن، لكن تحقق من سلوك إعادة المحاولة لدى WishMoney أولاً حتى لا تنشئ ازدواجًا (الفهرس الفريد على `wishmoney_order_id` يحميك أصلاً).

---

## 🟠 D-13 — High | نسخة احتياطية غير ذرّية لمنح العملات (race condition)

**الملفات:** `webhook-wishmoney/index.ts:180-220`, `confirm-payment/index.ts:277-295`

**المشكلة (Confirmed):**
```ts
const { data: usr } = await db.from("users").select("search_coins").eq("id", user_id).single();
const current = usr?.search_coins ?? 0;
await db.from("users").update({ search_coins: current + coinsToAdd }).eq("id", user_id);
```
قراءة ثم كتابة بلا قفل ولا `FOR UPDATE`. إذا وصل الـ POST callback والـ GET redirect في نفس اللحظة (وهو سيناريو موثّق في الكود نفسه بالسطر 399)، أحد المنحين يُفقد أو يُضاعف.

**تفاقم:** في `confirm-payment` Stage 2 (`:402-428`)، صف WishMoney قائم بـ `payment_method='wishmoney'` مع `source='paymob'` يمرّ من شرط الحماية، فيُحدَّث ثم **تُمنح العملات مرة ثانية** لنفس الشراء.

**لماذا هي مشكلة:** الرصيد يصبح غير قابل للتوفيق مع دفتر `coin_transactions`.

**كيف نصلحها:**
1. حذف النسخة الاحتياطية اليدوية بالكامل — `award_coins` RPC يعمل بشكل صحيح (تحققت من توقيعه الحي)، والاحتياطي يضيف مخاطرة بلا فائدة.
2. إذا احتُفظ به، استخدم زيادة ذرّية: `search_coins = search_coins + N` عبر RPC.
3. إضافة `UNIQUE (user_id, reference, reason)` على `coin_transactions` لمنع المنح المزدوج نهائيًا.

**هل الإصلاح آمن؟** ✅ آمن جدًا — حذف كود احتياطي ميت.

---

## 🟡 D-14 — Medium | `public-platform-stats` يستعلم جدولاً غير موجود

**الملف:** `supabase/functions/public-platform-stats/index.ts:33`

**المشكلة (Confirmed):**
```ts
admin.from("hunter_companies").select("id", { count: "exact", head: true })
```
جدول `hunter_companies` **غير موجود** في قاعدة البيانات (الجداول الفعلية: `companies` بـ 971 صف، و`discovered_companies` بـ 6).

`supabase-js` لا يرمي استثناء — يُرجع `{count: null, error}`. والكود يفعل `companies.count ?? 0`.

**النتيجة:** الصفحة الرئيسية (`Hero.tsx:247`) **تعرض دائمًا 0 شركة** رغم وجود 971.

**كيف نصلحها:** تغيير `"hunter_companies"` إلى `"companies"` وإضافة `.eq('is_active', true)`. وفحص `error` وتسجيله بدل ابتلاعه.

**هل الإصلاح آمن؟** ✅ آمن تمامًا — سطر واحد.

---

## 🟡 D-15 — Medium | `delete-account` لا يحذف كل شيء

**الملف:** `supabase/functions/delete-account/index.ts:36-98`

**مشاكل مؤكَّدة (Confirmed):**

| السطر | المشكلة | الأثر |
|---|---|---|
| `:57` | `db.from("ai_hunter_logs").delete()` — **الجدول غير موجود** | استدعاء ميت (النتيجة مهملة) |
| `:37-39` | `cv_archive.select("cv_file_path")` — **العمود غير موجود** | `cvRows = null` → تلك الملفات لا تُحذف أبدًا |
| `:77` | `profiles.delete().eq("id", uid)` — `profiles.id` ليس الـ auth uid (D-9) | لا يحذف شيئًا؛ ينقذه FK cascade فقط |
| `:93` | حذف من `cv-documents` فقط | **`cv_uploads`, `cv_imports`, `avatars`, `covers` لا تُنظَّف إطلاقًا** |
| كل الأسطر | لا فحص لأي `error` | يُرجع `success: true` حتى لو فشل كل شيء |
| — | لا معاملة (transaction) | فشل في المنتصف = حساب محذوف جزئيًا |

**لماذا هي مشكلة:** ملفات السيرة الذاتية الخام (PII كاملة) تبقى في التخزين بعد "حذف الحساب". هذا خرق لوعد الخصوصية وللوائح حماية البيانات.

**كيف نصلحها:**
1. تصحيح المراجع: حذف `ai_hunter_logs`، إزالة `cv_file_path` من الـ select، تغيير `profiles.delete().eq("id")` إلى `.eq("user_id", uid)`.
2. حذف كل الملفات تحت `${uid}/` من الأربع buckets الأخرى عبر `storage.from(b).list(uid)` ثم `remove`.
3. فحص كل `error` وإرجاع فشل جزئي بوضوح.
4. الأفضل: تحويلها إلى دالة SQL واحدة `SECURITY DEFINER` داخل معاملة، مع بقاء حذف الملفات والـ auth user في الـ Edge Function.

**هل الإصلاح آمن؟** ⚠️ **يحتاج حذر شديد** — هذا كود مدمّر. اختبره على حساب تجريبي مخصص أولاً.

---

## 🟡 D-16 — Medium | `fn_lock_profile_identity_fields` بلا trigger

**المصدر:** `pg_proc` + `pg_trigger` (حيّان)

**المشكلة (Confirmed):** الدالة موجودة ومكتوبة بشكل صحيح (تمنع تغيير `id`, `user_id`, `username`, `career_form_id`, `career_submission_id`)، لكن استعلام `pg_trigger` على schema `public` يُرجع 4 triggers فقط، **لا أحد منها على `profiles`**:
```
cv_analysis_requests.trg_immutable_submission_id_cv_analysis
cv_archive.trg_immutable_submission_id_cv_archive
users.trg_generate_promo_code
users.trg_validate_referral
```

**النتيجة:** `authenticated` يملك `UPDATE` على `profiles.username` (تحققت من صلاحيات الأعمدة)، والحماية غير مفعّلة → المستخدم يستطيع تغيير اسم المستخدم متى شاء، وسرقة اسم متاح، وكسر روابط `/u/:username` المشاركة.

**كيف نصلحها:**
```sql
CREATE TRIGGER trg_lock_profile_identity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION fn_lock_profile_identity_fields();
```
مع ضبط `search_path` (تحذير من Supabase advisor: `function_search_path_mutable`):
```sql
ALTER FUNCTION public.fn_lock_profile_identity_fields() SET search_path = public, pg_temp;
```

**هل الإصلاح آمن؟** ⚠️ سيمنع أي تدفق شرعي لتغيير اسم المستخدم. ابحث عن `username` في `MyAccount.tsx` و`PrivateProfileV2.tsx` أولاً.

---

## 🟡 D-17 — Medium | CSP يحجب مصدر الاحتياطي للمنطقة الجغرافية

**الملفات:** `vercel.json` (CSP)، `src/utils/detectRegion.ts:50`

**المشكلة (Confirmed):**
```
connect-src 'self' *.supabase.co wss://*.supabase.co accept.paymobsolutions.com;
```
و`detectRegion.ts:50`:
```ts
const res = await fetch("https://ipapi.co/json/", { ... });
```
`ipapi.co` **غير مسموح** في `connect-src` → المتصفّح يحجب الطلب → يُلتقط في `catch` الصامت → يُستخدم الافتراضي `"LB"`.

تحققت أن `ipapi.co` موجود فعلاً في الـ bundle المبني.

**النتيجة:** الطبقة الاحتياطية الرابعة **ميتة تمامًا**. إذا فشل `/api/geo` لأي سبب، **كل مستخدم مصري يرى أسعار لبنان** (25$ بدل 250 جنيه ≈ 5$) — أي 5× السعر المتوقع، وهو ما سيقتل التحويل في مصر.

**كيف نصلحها:** إما إضافة `https://ipapi.co` إلى `connect-src`، أو (الأفضل) حذف الطبقة الاحتياطية بالكامل والاعتماد على `/api/geo` وحده — فهو أسرع ومجاني وبلا حد استخدام.

**هل الإصلاح آمن؟** ✅ آمن — حذف الطبقة الاحتياطية أنظف من توسيع الـ CSP.

---

## 🟡 D-18 — Medium | pdf.js worker من CDN خارجي (استخدامان متعارضان)

**الملفات:** `src/components/CareerAnalysis.tsx:15` مقابل `src/components/ResumeForm.tsx:24`

**المشكلة (Confirmed):**
```ts
// CareerAnalysis.tsx:15 — من CDN خارجي، بروتوكول نسبي
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ResumeForm.tsx:24 — من الحزمة المحلية (صحيح)
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
```

الـ CSP يسمح بـ `worker-src 'self' blob: https://unpkg.com` فيعمل، لكن:
- تبعية وقت تشغيل على CDN طرف ثالث → انقطاع unpkg = تعطّل رفع الـ PDF في التحليل.
- مخاطرة سلسلة توريد: تنفيذ كود من نطاق خارجي داخل origin التطبيق.
- ملف الـ worker المحلي (1.24 MB) مبني ومنشور أصلاً — فالتحميل الخارجي بلا فائدة.

**كيف نصلحها:** توحيد `CareerAnalysis.tsx` على نفس نمط `ResumeForm.tsx`، ثم إزالة `https://unpkg.com` من الـ CSP.

**هل الإصلاح آمن؟** ✅ آمن — سطران، والنمط الصحيح موجود ومختبر في ملف آخر.

---

## 🟡 D-19 — Medium | `generate-cv` بلا حماية من الاستدعاء المتكرر

**الملف:** `supabase/functions/generate-cv/index.ts:1322-1420`

**المشكلة (Confirmed):** الدالة لا تفحص إطلاقًا ما إذا كان `cv_gpt_result` أو `cv_pdf_url` موجودًا مسبقًا. كل استدعاء يعيد التوليد ويستبدل الملفات.

```
gpt-4o × (8192 + 4096 توكن) + 2× تحويل DOCX + 2× رفع + 2× signed URL
```
لكل استدعاء، بلا حد.

`SuccessPage.tsx:412` يستدعيها بنمط fire-and-forget (`.catch()` بلا `await`)، وأي تحديث للصفحة قد يعيد الاستدعاء.

**كيف نصلحها:** في بداية الدالة:
```ts
if (record.cv_pdf_url && record.cl_pdf_url && !body.force) {
  return json({ success: true, url: record.cv_pdf_url, cl_url: record.cl_pdf_url, cached: true });
}
```
+ عمود `generation_status` (`pending`/`running`/`done`) لمنع التزامن.

**هل الإصلاح آمن؟** ✅ آمن — لكن أبقِ مسارًا لإعادة التوليد عند تغيير اللغة (`selectedLanguage` مختلف).

---

## 🟡 D-20 — Medium | أعمدة التوقيت تستخدم نمطًا خاطئًا

**الملف:** `supabase/migrations/20260528_order_generations_ddl.sql:68-70`

**المشكلة (Confirmed):**
```sql
agreed_at         TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Beirut'),
created_at_beirut TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Beirut'),
```
`now() AT TIME ZONE 'Asia/Beirut'` يُرجع `timestamp` **بلا منطقة زمنية**، ثم يُحوَّل ضمنيًا إلى `timestamptz` باستخدام منطقة الخادم (UTC) → **القيمة المخزَّنة مزاحة بمقدار 3 ساعات.**

**كيف نصلحها:** الاحتفاظ بـ `created_at_utc` (وهو صحيح: `timezone('utc', now())`) وحذف عمود `created_at_beirut` نهائيًا؛ العرض بتوقيت بيروت مسؤولية الواجهة.

**هل الإصلاح آمن؟** ⚠️ يحتاج حذر — تحقق من أي كود يقرأ `created_at_beirut` قبل حذفه.

---

## 🟡 D-21 — Medium | الـ token يُقرأ من localStorage يدويًا

**الملف:** `src/components/ResumeForm.tsx:2209-2215`

```ts
const lsKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
const accessToken = lsKey ? (JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null) : null;
...
Authorization: `Bearer ${accessToken ?? SUPABASE_KEY}`   // ← يسقط إلى anon key
```

**لماذا هي مشكلة:**
- يتجاوز آلية تجديد الـ token في supabase-js → token منتهٍ = فشل صامت.
- يعتمد على صيغة تخزين داخلية غير موثّقة قد تتغير مع تحديثات المكتبة.
- السقوط إلى `SUPABASE_KEY` يعني أن مستخدمًا بجلسة منتهية **ما زال يستهلك OpenAI** عبر `parse-cv-import` (لأنها `verify_jwt=false`) بلا أي هوية.

**كيف نصلحها:** `const { data: { session } } = await supabase.auth.getSession(); const accessToken = session?.access_token;` وإزالة السقوط إلى anon.

**هل الإصلاح آمن؟** ✅ آمن.

---

## 🟢 D-22 — Low | `VITE_PAYMOB_API_KEY` بادئة خطرة

**الملف:** `.env`

**المشكلة (Confirmed جزئيًا):** المتغيّر `VITE_PAYMOB_API_KEY` (سرّ خادمي بامتياز — يمنح رمز مصادقة كامل على حساب Paymob التجاري) يحمل بادئة `VITE_` التي تعرّضه للحزم في الـ bundle.

**الوضع الحالي (Confirmed):** فحصت الـ bundle المبني — القيمة **غير موجودة فيه**، لأن Vite يستبدل فقط ما يُشار إليه صراحةً، ولا يوجد أي `import.meta.env.VITE_PAYMOB_API_KEY` في `src/`.

**لماذا هي مشكلة رغم ذلك:** إشارة عرضية واحدة في المستقبل — أو استخدام `import.meta.env` ككائن كامل — تسرّبه فورًا إلى ملف JS عام. المفتاح الصحيح مستخدم فعلاً بالاسم الصحيح `PAYMOB_API_KEY` داخل `confirm-payment` (Supabase secret)، فوجوده في `.env` بلا داعٍ.

**كيف نصلحها:** حذف السطر من `.env` و`.env.local`، والتأكد من عدم وجوده في Vercel Environment Variables. **وتدوير المفتاح** احتياطًا (`.env.local` قديم — 13 مايو 2026 — ويحتوي المفتاح نفسه).

**هل الإصلاح آمن؟** ✅ آمن.

---

## 🟢 D-23 — Low | `WISHMONEY_API_URL` يسقط إلى بيئة sandbox

**الملف:** `supabase/functions/create-cv-order/index.ts:13`

```ts
const _WM_BASE = (Deno.env.get("WISHMONEY_API_URL") ?? "https://api.sandbox.whish.money/itel-service/api")...
```

إذا لم يُضبط المتغيّر في الإنتاج، تعمل الدالة صامتةً على **sandbox** → كل الدفعات وهمية وكل الباقات مجانية بحكم الأمر الواقع، بلا أي إشارة تحذير.

**Needs Verification:** تحقق أن `WISHMONEY_API_URL` مضبوط في Supabase Secrets ويشير إلى الإنتاج.

**كيف نصلحها:** جعل المتغيّر إلزاميًا (`Deno.env.get(...)!` + رمي خطأ عند غيابه). القيمة الافتراضية الآمنة يجب أن تكون "لا شيء"، لا "sandbox".

---

## 🟢 D-24 — Low | `VITE_PAYMOB_AI_SEARCH_LINK` فارغ

**الملفات:** `.env` (قيمة فارغة)، `PlansPage.tsx:119`، `create-cv-order/index.ts:20`

```ts
ai_search: Deno.env.get("PAYMOB_AI_SEARCH_LINK") ?? "",
if (!paymobLink) return 400 `No Paymob link configured for plan: ${plan}`;
```
→ **شراء باقة AI Hunter من مصر يفشل دائمًا بخطأ 400.**

**كيف نصلحها:** إنشاء الرابط في Paymob وضبطه، أو إخفاء الباقة في واجهة مصر حتى ذلك الحين.

---

## 🟢 D-25 — Low | روابط Paymob مكرّرة ومتضاربة

**الملفات:** `PlansPage.tsx:117-118` مقابل `create-cv-order/index.ts:18-19`

نفس الباقة، **مرجعان مختلفان**:
```
premium:  create-cv-order → p_LRR2cnBxcGFGYUdsY1NDVWtNN3RoWlpyUT09_...
          PlansPage       → p_LRR2djFVeWg0SWhkQzY2dnM3WGQxOFl6Zz09_...
```
الواجهة تفضّل `result?.url` (رابط الخادم)، فرابط `PlansPage` احتياطي ميت — لكن قد يُستخدم إذا فشل الخادم، **بمبلغ مختلف محتمل**.

**كيف نصلحها:** حذف الروابط من الواجهة نهائيًا. مصدر واحد للحقيقة في الخادم.

---

# E. Security Audit

## E-1 Authentication

| البند | الحالة |
|---|---|
| المزوّد | Google OAuth فقط — سطح هجوم صغير ✅ |
| JWT expiry | 3600 ثانية ✅ |
| Refresh token rotation | مفعّل، `reuse_interval = 10` ✅ |
| `site_url` / redirect URLs | مضبوطة بشكل صحيح ✅ |
| Leaked-password protection | معطّل ⚠️ (غير مؤثر — لا كلمات مرور) |
| حماية المسارات | **عميلة فقط وقابلة للتجاوز** 🔴 D-11 |
| التحقق في Edge Functions | صحيح في 10 دوال، **غائب في 5** 🔴 D-3 |

## E-2 Row Level Security

RLS مفعّلة على كل الجداول الـ 13 ✅ — لكن الفعالية تختلف جذريًا:

| الجدول | التقييم |
|---|---|
| `cv_archive` | ✅ سليم (`auth.uid() = user_id` على SELECT/INSERT/UPDATE). لا سياسة DELETE (متعمّد على الأرجح) |
| `cv_analysis_requests` | ✅ سليم |
| `downloads` | ✅ سليم |
| `coin_transactions` | ✅ SELECT فقط — لا INSERT من العميل. ممتاز |
| `profiles` | ✅ السياسات سليمة (`auth.uid() = user_id`)، لكن **صلاحيات الأعمدة تسمح بكتابة `active_plan` و`documents_generated_count`** 🟠 |
| `users` | 🔴 السياسة سليمة لكن **الأعمدة الحسّاسة قابلة للكتابة** (D-2) |
| `order_generations` | 🔴 **INSERT/UPDATE من العميل على حقول الاستحقاق** (D-1) |
| `companies`, `discovered_companies`, `hv2_*`, `profiles_backup_*` | RLS مفعّلة **بلا سياسات** → مغلقة تمامًا للعميل ✅ (تحذير INFO من الـ advisor، لكنه السلوك الآمن) |

**الملاحظة الجوهرية:** المشروع يعامل RLS كأنها حماية على مستوى الأعمدة، وهي ليست كذلك. RLS تحدد **أي صفوف** يمكن لمسها؛ `GRANT`/`REVOKE` تحدد **أي أعمدة**. التعليق في `20260522_security_coin_economy.sql:17` يوضّح هذا اللبس صراحةً:
> `-- (username, first_name, last_name only — email/phone/coins stay private)`

هذا التعليق كان يصف سياسة `users_safe_public_read ... USING (username IS NOT NULL)` التي كانت ستكشف **كل الأعمدة** لكل صف بـ username. **الخبر الجيد:** تلك السياسة **غير موجودة في قاعدة البيانات الحيّة** — على ما يبدو أُزيلت لاحقًا. لكن نفس سوء الفهم يفسّر D-1 و D-2.

## E-3 Secrets

✅ **ما هو صحيح:**
- `.gitignore` يغطي `.env`, `.env.local`, `.env*.local`, `.vercel`, `full_database_backup.sql`.
- لا `service_role` key في الواجهة (بحثت عن `service_role` و`SERVICE_ROLE` في الـ bundle — **غير موجودين**).
- `VITE_PAYMOB_API_KEY` غير موجود في الـ bundle المبني.
- الأسرار الخادمية كلها عبر `Deno.env.get()` في Supabase Secrets.

⚠️ **ما يحتاج انتباهًا:**
- `VITE_PAYMOB_API_KEY` موجود في `.env` ببادئة خطرة (D-22).
- `VERCEL_OIDC_TOKEN` في `.env` — لا داعي له.
- `.env.local` قديم (13 مايو 2026) ويحتوي 5 روابط Make.com "متقاعدة" — معلومات بنية تحتية قديمة.
- **الريبو عام** (`githubRepoVisibility: "public"`).

> **Needs Verification — مهم:** تحقق أن `.env` لم يُرفع في تاريخ الـ git قبل إضافة `.gitignore`:
> ```
> git log --all --full-history --oneline -- .env .env.local
> ```
> إذا ظهرت أي نتيجة → **دوّر فورًا:** Supabase anon + service_role, Paymob API key, WishMoney secret, OpenAI key, Brave key, Resend key.

## E-4 API Keys

| المفتاح | التخزين | التقييم |
|---|---|---|
| `VITE_SUPABASE_ANON_KEY` | Bundle | ✅ صحيح — anon key عام بالتصميم |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secrets | ✅ خادمي فقط |
| `OPENAI_API_KEY` | Supabase Secrets | ⚠️ لكن 4 دوال تستخدمه بلا مصادقة (D-3) |
| `BRAVE_SEARCH_API_KEY` | Supabase Secrets | 🔴 قابل للاستنزاف عبر `search-jobs` و`test-brave-search` |
| `PAYMOB_API_KEY` | Supabase Secrets | ⚠️ غيابه = fail-open (D-5) |
| `WISHMONEY_SECRET` | Supabase Secrets | ✅ يُستخدم للـ HMAC — سليم |
| `RESEND_API_KEY` | Supabase Secrets | ✅ |

## E-5 Edge Functions

- 5 دوال مفتوحة للعالم بلا مصادقة (D-3).
- **جميع الدوال** تستخدم `Access-Control-Allow-Origin: "*"`. مع وجود مصادقة JWT هذا مقبول تقنيًا، لكن تقييده على `https://www.resumation.co` طبقة دفاعية مجانية.
- **لا rate limiting على أي دالة** — لا بالبوابة ولا في الكود.
- تسريب تفاصيل داخلية في الأخطاء: `JSON.stringify({ error: String(err) })` يُرجع رسائل استثناءات خام للعميل (في `create-cv-order:280`, `confirm-payment:592`, `generate-cv:1541`, `webhook-wishmoney:506`).
- سجلات مطوّلة: `create-cv-order:224` يسجّل استجابة WishMoney الكاملة بتعليق "Temporary diagnostic log" — لم تُزَل.

## E-6 Payment / Webhook Security

| البند | الحالة |
|---|---|
| توقيع webhook WishMoney | ✅ HMAC-SHA256 + `timingSafeEqual` — تصميم جيد |
| تغطية الـ HMAC | 🔴 `${tid}:${fid}` فقط — **لا يشمل `plan` ولا `amount`** |
| التحقق من المبلغ (WishMoney) | 🔴 غائب تمامًا — المبلغ من العميل |
| التحقق من المعاملة (WishMoney) | 🔴 لا استدعاء تحقق مرتد إلى WishMoney |
| التحقق من المعاملة (Paymob) | 🟠 موجود لكن **fail-open ×3** |
| مطابقة المبلغ بالباقة (Paymob) | 🔴 غائب — `paid_amount_cents > 0` فقط |
| ربط الطلب بالمستخدم (Paymob) | 🔴 غائب |
| Idempotency (WishMoney) | ✅ فهرس فريد جزئي حقيقي + معالجة 23505 |
| Idempotency (Paymob) | 🔴 لا فهرس فريد + مقيّد بـ `user_id` |
| سجل تدقيق مستقل | 🔴 غائب — لا جدول `payment_events` |
| صحة الإيصالات | 🟠 السعر من جدول ثابت لا من المبلغ المدفوع فعليًا؛ الشارة تقول "PAID · VERIFIED · CONFIRMED" حتى عند تخطي التحقق |

## E-7 User Data Exposure

- `get_public_profile` يكشف الملفات الخاصة (D-8).
- `get_public_profile_stats` مفتوح لـ `anon` — يُرجع عدد السير والتحليلات لأي `user_id`. الـ UUID غير قابل للتخمين عمليًا، لكن الدالة لا تفحص الخصوصية أيضًا.
- `profiles_backup_2026_06_13` — جدول نسخ احتياطي بصف واحد ما زال في schema `public` ومرئي في GraphQL. يجب حذفه.
- `console.log` في الإنتاج يطبع بيانات المستخدم: `PlansPage.tsx` وحده فيه **48 استدعاء console** تشمل `user_id`, `form_id`, `amount`, `plan`. مجموع الواجهة **118 استدعاء**.

## E-8 File / Storage Access

مفصّل في D-6. ملخص السياسات الحيّة:

| Bucket | القراءة | الكتابة | الحذف | التقييم |
|---|---|---|---|---|
| `cv_uploads` | مالك المجلد | مالك المجلد | مالك المجلد | ✅ |
| `avatars` | عام | مالك المجلد | — | ✅ متعمّد |
| `covers` | عام | مالك المجلد | — | ✅ متعمّد |
| `cv-documents` | مالك المجلد | 🔴 **`{public}`** | — | 🔴 |
| `cv_imports` | 🔴 **أي مسجّل** | 🔴 أي مسجّل | 🔴 **أي مسجّل** | 🔴 |

روابط `cv_pdf_url` موقّعة بصلاحية **90 يومًا** ومخزّنة في قاعدة البيانات — طويلة جدًا لرابط قابل للمشاركة. اعتبر تقليصها إلى ساعة وتوليدها عند الطلب.

## E-9 Privilege Escalation

| المسار | الحالة |
|---|---|
| `search_coins` عبر UPDATE مباشر | 🔴 مفتوح (D-2) |
| `is_founder` عبر UPDATE مباشر | 🔴 مفتوح (D-2) |
| `package_name` عبر INSERT/UPDATE | 🔴 مفتوح (D-1) |
| `profiles.active_plan` عبر UPDATE | 🟠 مفتوح — يؤثر على `is_paid` في `get_public_profile` |
| `award_coins` من العميل | ✅ محجوب (`service_role` فقط) |
| `spend_coins` لمستخدم آخر | ✅ محجوب (`auth.uid()` check) |
| `service_role` من الواجهة | ✅ غير مسرَّب |
| **لا يوجد مفهوم "admin"** | ⚠️ لا دور إداري ولا لوحة تحكم — كل العمليات الإدارية يدوية عبر لوحة Supabase |

---

# F. Database & Data Integrity Audit

## F-1 الحالة الفعلية

```
auth.users              21
public.users            16     ← فجوة 5
public.profiles          8     ← تقاطع صفري مع users.id
cv_archive              11
order_generations        2     (كلاهما premium/wishmoney، مكتملان)
coin_transactions        3
downloads                0     ← الميزة لا تكتب
cv_analysis_requests     0     ← الميزة مكسورة (D-7)
companies              971
discovered_companies     6
hv2_search_log/candidate_log/seen   0 / 0 / 0
profiles_backup_2026_06_13          1
```

## F-2 `profiles` — أزمة الهوية المزدوجة (Confirmed)

الجدول يحمل **معرّفين**:
```sql
profiles_pkey       PRIMARY KEY (id)
profiles_user_id_key UNIQUE (user_id)
profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
```
والكود يستخدمهما بشكل متناقض:
- `auth-on-signup:63` → يكتب `id` (خطأ)
- كل سياسات RLS → تستخدم `user_id` (صحيح)
- `delete-account:77` → يحذف بـ `id` (خطأ)
- `get_public_profile` → يستعلم بـ `username`

**الدليل الحاسم:** 16 صف `users` × 0 مطابقة بالـ `id` مع `profiles`. المعرّفان مساحتان منفصلتان تمامًا.

**التوصية:** توحيد المعرّف. الأنظف: جعل `profiles.id` هو نفسه `auth.users.id` (كما هو نمط Supabase القياسي) وحذف `user_id`، أو العكس. مع 8 صفوف فقط، الهجرة تافهة **الآن** وستصبح مؤلمة لاحقًا.

## F-3 `users` — تناقضات

- **5 حسابات في `auth.users` بلا صف في `public.users`** → لا رصيد عملات، لا `promo_code`، ولا ظهور في `public-platform-stats`. تُنشئ فشلًا صامتًا في `PlansPage`/`MyAccount`.
- **2 مستخدمَين بـ `username = NULL`** — رغم `CHECK (char_length(username) >= 6)` (لا يمنع NULL).
- تضارب في قواعد اسم المستخدم: القيد في قاعدة البيانات `>= 6` أحرف، لكن `LoginPage.tsx:380` يستخدم `/^[a-z0-9_]{3,20}$/` — **اسم من 3–5 أحرف يمرّ التحقق في الواجهة ويُرفض من قاعدة البيانات** بخطأ constraint خام.
- `email` مكرر في `auth.users` و`public.users` و`profiles.profile_email` و`cv_archive.email`/`cv_email` و`order_generations.email`/`cv_email` — **6 نسخ**، بلا آلية توفيق.

## F-4 `order_generations` — القيود

| القيد | الحالة |
|---|---|
| `PRIMARY KEY (generation_id)` | ✅ |
| `FK form_id → cv_archive` ON DELETE CASCADE | ✅ |
| `FK user_id → auth.users` ON DELETE CASCADE | ✅ |
| `UNIQUE (wishmoney_order_id) WHERE NOT NULL` | ✅ **موجود حيًّا** (غير مذكور في ملف الـ migration) |
| `UNIQUE (paymob_order_id)` | 🔴 **غير موجود** |
| `CHECK (package_name IN (...))` | 🔴 غير موجود — أي نص مقبول |
| `CHECK (payment_method IN (...))` | 🔴 غير موجود |
| عمود `paid_amount` / `paid_currency` | 🔴 غير موجود — **لا سجل للمبلغ المدفوع فعليًا** |
| عمود `payment_verified` | 🔴 غير موجود |

> **الملاحظة الأخطر في هذا القسم:** لا يوجد في قاعدة البيانات أي عمود يسجّل **كم دُفع فعليًا**. لا يمكن التوفيق المحاسبي مع WishMoney أو Paymob، ولا كشف تلاعب D-4 بأثر رجعي.

## F-5 السجلات المكررة / غير المتّسقة

- `cv_archive` بلا فهرس فريد على `submission_id` — و`create-cv-order:118-122` يعالج ذلك بـ `.order('created_at_utc' desc).limit(1)`، ما يشير إلى وجود تكرارات فعلية.
- `confirm-payment:472-490` عند غياب `form_id` يستخدم "أحدث صف cv_archive للمستخدم" — إذا أنشأ المستخدم مسوّدة جديدة أثناء الدفع، **تُربط الدفعة بالسيرة الخاطئة**.
- `awardCoins` بلا فهرس فريد على `coin_transactions(user_id, reference, reason)` → لا حماية من المنح المزدوج (D-13).

## F-6 Race Conditions

| الموضع | الحالة |
|---|---|
| `spend_coins` RPC | ✅ محمي بـ `FOR UPDATE` |
| `awardCoinsSafely` النسخة الاحتياطية | 🔴 read-modify-write بلا قفل (D-13) |
| `webhook-wishmoney` INSERT مزدوج | ✅ محمي بالفهرس الفريد |
| `confirm-payment` INSERT مزدوج | 🔴 غير محمي (لا فهرس على `paymob_order_id`) |
| `generate-cv` استدعاءات متزامنة | 🔴 غير محمي (D-19) — قد يستبدل الملفات أثناء القراءة |
| فحص تفرّد اسم المستخدم | 🟡 TOCTOU — الفحص في `LoginPage:399` ثم الكتابة لاحقًا؛ ينقذه `UNIQUE` لكن بخطأ خام |

## F-7 عمليات الكتابة غير الآمنة

- `order_generations` INSERT/UPDATE من العميل (D-1).
- `users.search_coins` UPDATE من العميل (D-2).
- `profiles.active_plan` / `documents_generated_count` / `analyses_used_count` UPDATE من العميل — تُستخدم في `get_public_profile` لتحديد `is_paid` وعرض الإحصاءات → **إحصاءات الملف العام قابلة للتزوير من صاحبها.**
- `cv_archive.generated_under_plan` / `ats_score` UPDATE من العميل.

---

# G. UX / Product Flow Audit

## G-1 Signup / Login
✅ Google OAuth بنقرة واحدة، مع اختيار اسم مستخدم وفحص توفّر مباشر (debounced).
🟠 تضارب طول اسم المستخدم (3–20 في الواجهة، ≥6 في قاعدة البيانات) → خطأ constraint خام يظهر للمستخدم.
🟠 5 حسابات auth بلا صف `users` → هؤلاء المستخدمون في حالة معطّلة صامتة.
🟡 `NotFound` في `App.tsx:47` يعيد التوجيه إلى `/login` عند وجود `?error` — معالجة جيدة لأخطاء OAuth.

## G-2 Profile Creation
🔴 `auth-on-signup` مكسور (D-9) → إنشاء الملف غير موثوق.
🟠 وجود `PrivateProfile.tsx` (53KB، **يتيم**) و`PrivateProfileV2.tsx` (61KB، مستخدم) — نسختان في الريبو.
🟠 مفتاح "الملف العام" لا يفعل شيئًا فعليًا على مستوى الخادم (D-8): كل الملفات الـ 8 خاصة والكل مكشوف.

## G-3 CV Generation
✅ المسار الأساسي كامل: `ResumeForm` → `cv_archive` → `PlansPage` → دفع → `order_generations` → `generate-cv` → `BuildingPage` → `MyAccount`.
✅ `BuildingPage` فيه Realtime + polling + timeout 3 دقائق + فحص cache.
🟠 `generate-cv` يُستدعى fire-and-forget من `SuccessPage:412` بلا `await` — إذا فشل الطلب، المستخدم ينتظر 3 دقائق ثم يرى timeout بلا سبب واضح، **بعد أن دفع**.
🟠 خطر تجاوز المهلة: `gpt-4o` (8192 توكن) + `gpt-4o` (4096) + تحويلا DOCX متسلسلان — قد يقترب من حد Edge Function. مهلة الواجهة 3 دقائق قد تنتهي قبل اكتمال التوليد.
🟡 لا زر "إعادة المحاولة" في `BuildingPage` عند الـ timeout.

## G-4 Cover Letter
✅ يُولَّد بالتوازي مع الـ CV داخل `generate-cv` (prompt منفصل EN/AR)، ويُرفع كـ DOCX منفصل مع رابط موقّع.
🟡 لا خيار لتوليد خطاب التقديم وحده أو إعادة توليده.

## G-5 Payments
🔴 التلاعب بالسعر والباقة (D-4, D-5, D-10).
🔴 باقة AI Hunter في مصر مكسورة — رابط غير مضبوط (D-24).
🟠 خصم الإحالة 50% يُعرض في مصر لكنه لا يُطبَّق (رابط ثابت).
🟠 **مسار Paymob لم ينتج ولا طلبًا ناجحًا واحدًا** (0 صفوف) — غير مثبت إنتاجيًا.
🟡 `billing_data[phone_number]=01111111111` ثابت وهمي في `PlansPage:507`.
✅ رسائل خطأ واضحة ومترجمة عبر `payError`.

## G-6 Downloads
✅ روابط موقّعة 90 يومًا مخزّنة في الصف؛ `MyAccount` فيه بديل لتوليد رابط عند غيابه.
🔴 جدول `downloads` فيه **0 صفوف** — الكتابة الوحيدة في `generate-free-cv:471` (best-effort مع `console.warn` عند الفشل). لا تتبّع للتحميلات المدفوعة إطلاقًا.
🟡 لا سقف على عدد التحميلات ولا انتهاء صلاحية.

## G-7 AI Hunter
🔴 **`JobHunterPage.tsx` نموذج أولي داخلي منشور للمستخدمين.** الأدلة من الكود نفسه:
- العنوان: `"Job Search Validation Screen"`
- الوصف: `"Real-data prototype for testing..."`
- `debugMessage` يعرض `"Search completed. N visible/raw results received."` للمستخدم النهائي
- `console.log("AI Hunter search payload:", payload)` و`"AI Hunter raw response:"`
- رسالة الخطأ: `"Search failed. Please check the Edge Function logs."` ← رسالة موجّهة لمطوّر
- **إنجليزي فقط** في تطبيق ثنائي اللغة بالكامل
- نظام تصميم مختلف (`bg-slate-950` / `cyan-400`) بدل `cyber-*` المستخدم في كل مكان آخر
- **لا خصم عملات إطلاقًا** رغم أن الباقة تُباع بـ 10$ / 100 جنيه

## G-8 Error & Empty States
✅ رسائل خطأ مترجمة في المسارات الرئيسية؛ `Toaster` من sonner؛ `PayError` واضح.
🟠 D-7: رسالة "Insufficient coin balance" كاذبة تُعرض لكل مستخدم.
🟠 CSP يحجب ipapi.co بصمت (D-17) → أسعار خاطئة بلا أي إشارة.
🟠 `catch {}` صامتة في `detectRegion.ts:57, 66`.
🟡 `NotFound` بالعربية فقط (`"عذراً، هذه الصفحة غير موجودة."`) في تطبيق ثنائي اللغة.

---

# H. Performance Audit

## H-1 Bundle Size (Confirmed من مخرجات البناء الفعلية)

```
dist/assets/index-CD9Awczp.js      2,419,456 bytes   (2.42 MB)  ← chunk واحد!
dist/assets/index-CcGAwlHM.css        82,131 bytes
dist/assets/pdf.worker.min-*.mjs   1,239,047 bytes
public/hero-scene-desktop.webp       373,080 bytes
public/hero-scene-mobile.webp        322,086 bytes
```

**السبب المباشر:** `vite.config.ts` هو الملف الافتراضي بالكامل (6 أسطر، بلا أي تخصيص)، **ولا يوجد `React.lazy` في أي مكان في `src/`**.

**النتيجة:** المستخدم الذي يفتح الصفحة الرئيسية يُنزّل: مكتبة تحليل PDF كاملة، mammoth (DOCX)، framer-motion، typed.js، وكل صفحات التطبيق الـ 24 — قبل رؤية أول بكسل. على شبكة 3G في لبنان أو مصر، هذا **10–20 ثانية** قبل التفاعل.

**الإصلاح (أثر عالٍ، مخاطرة منخفضة):**
```ts
// vite.config.ts
build: {
  rollupOptions: { output: { manualChunks: {
    react:   ['react','react-dom','react-router-dom'],
    pdf:     ['pdfjs-dist'],
    docx:    ['mammoth'],
    motion:  ['framer-motion'],
    supabase:['@supabase/supabase-js'],
  }}},
  chunkSizeWarningLimit: 600,
}
```
```tsx
// App.tsx — تحميل كسول لكل مسار
const ResumeForm = lazy(() => import('./components/ResumeForm'));
const CareerAnalysis = lazy(() => import('./components/CareerAnalysis'));
// ... + <Suspense fallback={<Spinner/>}>
```
`ResumeForm.tsx` وحده 172 KB مصدرًا ولا يحتاجه أحد قبل `/build`. `CareerAnalysis` يجرّ pdfjs + mammoth ولا يحتاجهما أحد قبل `/analyse`.

**التقدير:** الحزمة الأولية يمكن أن تنخفض إلى ~500–700 KB — تحسّن 70%+.

## H-2 استيرادات غير ضرورية

تبعيات في `package.json` **لا تُستورد في أي مكان في `src/`**:
| الحزمة | ملاحظة |
|---|---|
| `pdf-parse` | مكتبة Node — لا تعمل في المتصفّح أصلاً. **احذفها** |
| `clsx` | غير مستخدمة |
| `tailwind-merge` | غير مستخدمة |
| `react-hot-toast` | غير مستخدمة (المشروع يستخدم `sonner` في 7 ملفات) — مكتبتا toast مثبّتتان |
| `html-to-docx` | تُستخدم فقط في Deno عبر esm.sh، لا في الواجهة |
| `autoprefixer`, `postcss`, `tailwindcss` | أدوات بناء مصنّفة خطأً في `dependencies` بدل `devDependencies` |

## H-3 Code Splitting
🔴 غائب تمامًا. لا `manualChunks`، لا `React.lazy`، لا `Suspense`، لا route-based splitting.

## H-4 مكتبات كبيرة

| المكتبة | الحجم التقريبي | الاستخدام |
|---|---|---|
| `pdfjs-dist` | ~1.2 MB (+ worker 1.24 MB) | صفحتان فقط |
| `mammoth` | ~500 KB | صفحتان فقط |
| `framer-motion` | ~120 KB | مكوّنان فقط (`SuccessPage`, `EmployerAccess` — والأخير يتيم!) |
| `typed.js` | ~30 KB | `Hero` فقط |

الأربع كلها مرشحة مثالية للتحميل الكسول.

## H-5 طلبات غير ضرورية
- `detectRegion` يستدعي `ipapi.co` الذي يحجبه الـ CSP دائمًا (D-17) — طلب مهدور + انتظار 2.5 ثانية.
- `BuildingPage` polling كل 3 ثوانٍ **بالتوازي مع** اشتراك Realtime — الأخير كافٍ في الحالة الطبيعية. اجعل الـ polling يبدأ بعد 15 ثانية من صمت Realtime فقط.
- `MyAccount:227` يستخدم `select=*,order_generations(...)` — `SELECT *` مع join متداخل يجلب أعمدة غير مستخدمة (بما فيها `cv_data` JSONB الضخم).
- `generate-cv:1373` يستخدم `.select("*")` على `order_generations` — يجلب `cv_gpt_result` JSONB الكامل بلا حاجة.

## H-6 صفحات بطيئة
- `/` (Hero) — أثقل صفحة لأنها تحمّل الحزمة كاملة + صورة 373 KB.
- `/build` (`ResumeForm` 172 KB) — أضخم مكوّن.
- `/analyse` — pdfjs + mammoth + جلب worker من unpkg.

## H-7 مخاطر زمن استجابة Edge Functions

| الدالة | المخاطرة |
|---|---|
| `generate-cv` | 🔴 **الأعلى** — استدعاءا gpt-4o متوازيان ثم تحويلا DOCX **متسلسلان** (بتعليق صريح في `:1443` يحذّر من استنفاد الذاكرة). قد يقترب من حد المهلة |
| `search-jobs` | 🔴 حتى 750 استدعاء Brave؛ الواجهة تضع مهلة 60 ثانية |
| `create-cv-order` | 🟡 مهلة 15 ثانية على WishMoney (بتعليق يذكر تعليقًا 60 ثانية سابقًا في sandbox) |
| `confirm-payment` | 🟡 استدعاءا Paymob متسلسلان + Resend |
| `discover-career-pages` | 🟡 حتى 100 نطاق لكل طلب |

---

# I. Code Quality Audit

## I-1 كود ميت / يتيم (Confirmed)

**ملفات غير مستوردة من أي مكان في `src/`:**
| الملف | الحجم | ملاحظة |
|---|---|---|
| `src/pages/PrivateProfile.tsx` | 53 KB | استُبدل بـ `PrivateProfileV2.tsx` |
| `src/components/EmployerAccess.tsx` | 8 KB | لا مسار يشير إليه |

**ملفات نسخ احتياطي في جذر المشروع (خارج مجلداتها):**
```
arabic-fresh-graduate-template.backup.ts
arabic-professional-template.backup.ts
build-cv-docx.backup.ts
build-cv-docx.step2.backup.ts
select-cv-template.backup.ts
```

**ملفات أخرى ميتة:**
| الملف | الحجم | ملاحظة |
|---|---|---|
| `supabase/functions/generate-cv/index.old-html-engine.ts` | **73 KB** | المحرك القديم — استُبدل بـ CV Engine 2.0 |
| `supabase/functions/test-brave-search/` | — | دالة اختبار **منشورة في الإنتاج** |
| `full_database_backup.sql` | 0 bytes | ملف فارغ |
| `supabase/migrations/20260504230201_remote_schema.sql` | 0 bytes | migration فارغة |
| `supabase/week1_security_migration.sql` | 13 KB | خارج مجلد migrations؛ **محتواه متجاوَز بالكامل** |
| `src/App.css` | 1.6 KB | بقايا Vite الافتراضية |
| `src/assets/react.svg`, `public/vite.svg` | — | بقايا القالب |
| `public/_redirects` | — | ملف Netlify — المشروع على Vercel |
| جدول `profiles_backup_2026_06_13` | 1 صف | في قاعدة البيانات |

**كود ميت داخل الملفات:**
- `PLAN_COINS` معرَّف في `webhook-wishmoney:12` و`confirm-payment:14` — ولا يُستخدم فعليًا في المنح (الـ RPC يحسبها داخليًا)، فقط في `if (coinsToAdd <= 0) return`.
- `finalCoins()` في `PlansPage:129` يُرسل `coins` في الـ body — الخادم يتجاهله.
- `award_referral_coins` RPC — **لا يُستدعى من أي مكان**. برنامج الإحالة نصف مبني.
- `manage-coins` — لا يُستدعى من الواجهة إطلاقًا (بحثت: لا نتائج). `CareerAnalysis` يستدعي `spend_coins` مباشرةً.

## I-2 منطق مكرّر

| المنطق | عدد النسخ | المواضع |
|---|---|---|
| **جدول الأسعار** | **4** | `PlansPage:121`, `confirm-payment:30`, `webhook-wishmoney:26`, `docs/PRICING_AND_UNIT_ECONOMICS.md` — وكلها متضاربة (انظر أدناه) |
| قالب إيصال HTML | 2 | `confirm-payment:72-171` (100 سطر)، `webhook-wishmoney:67-90` |
| `hmacSha256Hex` | 2 | `create-cv-order:26`, `webhook-wishmoney:118` |
| منطق منح العملات | 2 | `awardCoins` / `awardCoinsSafely` |
| توليد `promo_code` | 3 | trigger DB، `week1_security_migration.sql`، `auth-on-signup:8` |
| روابط Paymob | 2 (متضاربة) | `PlansPage:117-118`, `create-cv-order:18-19` |
| عنوان Supabase مكتوب حرفيًا | **5** | `CareerAnalysis:526`, `LoginPage:230`, `PlansPage:416`, `Hero:247`, `JobHunterPage:128` |
| نصوص prompts | 3 نسخ لكل واحد | `functions/generate-cv/index.ts` + `prompts/*.ts` + `prompts/*.md` + `docs/*.md` |
| كائنات الترجمة ar/en | ~12 | داخل كل مكوّن |

**تضارب الأسعار (Confirmed):**
| المصدر | مصر | لبنان |
|---|---|---|
| `PlansPage.tsx:122` (الفعلي) | 250 / 400 / 100 EGP | 25 / 40 / 10 USD |
| `confirm-payment:31` (الإيصال) | 250 / 400 / 100 EGP | 25 / 40 / 10 USD |
| `docs/PRICING_AND_UNIT_ECONOMICS.md` | **99 / 299 / 499 EGP** | **$5 / $10 / $20** |

وثيقة التسعير (يونيو 2026) لا تطابق الكود إطلاقًا.

## I-3 تسمية غير متّسقة

- المسارات: `/analyse` (بريطاني) و`/career-analysis` معًا لنفس المكوّن؛ `/account` و`/my-account`؛ `/build` و`/builder` و`/resume-builder`.
- `/employer-links` يعرض مكوّن `AnalysisLinks` (`App.tsx:130`) — تسمية خاطئة أو خطأ نسخ.
- الأعمدة: `created_at_utc` مقابل `created_at` مقابل `created_at_beirut`.
- الدفع: `'whish'` و`'wishmoney'` كلاهما مقبول (`create-cv-order:96`) لكن المخزَّن دائمًا `'wishmoney'` (`:384`).
- الجداول: `companies` مقابل `discovered_companies` مقابل `hunter_companies` (غير موجود) مقابل `hv2_*`.
- ملفات في `src/` الجذر (`FreeLinks.tsx`, `GoldLinks.tsx`, `PremiumLinks.tsx`, `AnalysisLinks.tsx`) بينما البقية في `src/components/`.

## I-4 الدين التقني

| المؤشر | القيمة |
|---|---|
| ملفات > 30 KB | **10** |
| أكبر ملف واجهة | `ResumeForm.tsx` — **172 KB** |
| أكبر ملف خادم | `generate-cv/index.ts` — **99 KB** (~80% منه prompts) |
| `console.*` في `src/` | **118** (منها 48 في `PlansPage` وحده) |
| `: any` / `as any` | **76** |
| `@ts-ignore` | 3 |
| `eslint-disable` | 2 |
| اختبارات آلية | **0** — لا vitest/jest/playwright؛ فقط سكربتات Deno يدوية |
| type-check في الـ build | **غائب** (`"build": "vite build"` بلا `tsc -b`) |

## I-5 أنماط قديمة

- جلب البيانات يدويًا في `useEffect` مع أعلام `cancelled` — لا React Query/SWR.
- `supabase-js` client + `fetch` خام إلى REST API مستخدمان معًا لنفس الجداول (`MyAccount:227`, `BuildingPage:267`, `PrivateProfile:289` يستخدمون REST خام).
- قراءة الجلسة من localStorage يدويًا (`ResumeForm:2209`, `ProtectedRoute:11`).
- `search-jobs` و`public-platform-stats` يستخدمان `serve()` من `deno.land/std@0.224.0` (نمط قديم) بينما البقية تستخدم `Deno.serve` المدمج.
- إصدارات esm.sh غير مثبّتة: `esm.sh/@supabase/supabase-js@2` (major فقط) في معظم الدوال، لكن `search-jobs` يثبّت `@2.45.4` — **عدم اتساق يعني أن دوالك قد تعمل بإصدارات مختلفة من نفس المكتبة**.

## I-6 ملفات تحتاج إعادة هيكلة (بالأولوية)

1. **`ResumeForm.tsx` (172 KB)** — يجب تقسيمه إلى: خطوات النموذج، منطق الاستيراد، تكامل pdfjs/mammoth، وطبقة الحفظ.
2. **`generate-cv/index.ts` (99 KB)** — نقل الـ prompts الأربعة إلى `prompts/` (النسخ موجودة أصلاً هناك!) → الملف ينزل إلى ~15 KB.
3. **`PrivateProfileV2.tsx` (61 KB)** + حذف `PrivateProfile.tsx`.
4. **`MyAccount.tsx` (53 KB)** و **`PlansPage.tsx` (50 KB)**.
5. استخراج جدول الأسعار وقالب الإيصال إلى وحدة مشتركة (`supabase/functions/_shared/`).

---

# J. Dependencies Audit

## J-1 الوضع الحالي

`package-lock.json` **موجود ومثبَّت** (lockfileVersion 3) — وهذا مهم جدًا لأنه ما يحمي المشروع حاليًا.

| الحزمة | مثبّتة في lock | آخر إصدار | نوع القفزة |
|---|---|---|---|
| `react` / `react-dom` | 19.2.3 | 19.2.8 | patch ✅ |
| `vite` | 7.3.3 | 7.3.6 | patch ✅ |
| `@supabase/supabase-js` | 2.90.1 | 2.115.0 | minor ✅ |
| `pdfjs-dist` | **5.5.207** | 6.3.289 | **major** ⚠️ |
| `tailwindcss` | 3.4.17 | 4.3.3 | **major** 🔴 |
| `lucide-react` | 0.562.0 | 1.41.0 | **major** ⚠️ |
| `framer-motion` | 12.38.0 | 13.2.0 | **major** ⚠️ |
| `html-to-docx` | 1.8.0 | 1.8.0 | — |
| `mammoth` | 1.12.0 | 1.12.2 | patch ✅ |

## J-2 الثغرات

`npm audit` على `package.json` وحده (بدون القفل) يعطي 3 ثغرات High. لكن **بالقفل الفعلي المستخدم في الإنتاج، الوضع مختلف** — وهذه نقطة دقيقة ومهمة:

### ⚠️ `pdfjs-dist` — GHSA-hq66-cqwq-w95j (تنفيذ JS تعسفي عند فتح PDF خبيث)
- **النطاق المصاب:** `>= 5.6.83 < 6.2.108`
- **المثبّت في `package-lock.json`: 5.5.207** → **خارج النطاق المصاب. المشروع غير مصاب حاليًا.** ✅
- 🔴 **لكن** `package.json` يحدّد `"pdfjs-dist": "^5.5.207"` — أي `npm update`، أو أي بناء يتجاهل القفل، سيرفع الإصدار إلى 5.7.x **داخل النطاق المصاب**.
- **لماذا هذا خطير تحديدًا هنا:** التطبيق يحلّل ملفات PDF **يرفعها المستخدمون** داخل المتصفّح (`CareerAnalysis:365`, `ResumeForm`). تنفيذ JS داخل origin `resumation.co` = الوصول إلى `localStorage` حيث تُخزَّن جلسة Supabase = **سرقة كاملة للجلسة**.
- **الإجراء:**
  1. **فورًا:** تثبيت الإصدار بدقة — `"pdfjs-dist": "5.5.207"` (بلا `^`).
  2. لاحقًا وبحذر: الترقية إلى `6.2.108+`. **هذه قفزة major** تغيّر واجهة `getDocument` ومسار الـ worker → تتطلب اختبار `CareerAnalysis` و`ResumeForm` مع PDF عربي وإنجليزي.

### ⚠️ `html-to-docx@1.8.0` → `image-size` (GHSA-w3rx-r6r6-pgpr + GHSA-5p2g-fcmc-qvqq — DoS بحلقة لا نهائية في محلّلات ICNS/JXL/HEIF)
- التأثير: DoS فقط، وفقط عند معالجة صور بهذه الصيغ.
- الحزمة تُستخدم عمليًا في **Deno عبر esm.sh** (`generate-cv`) لا في حزمة الواجهة.
- `npm audit` يقترح "الإصلاح" بالنزول إلى `html-to-docx@1.1.2` — **قفزة رجعية major. لا تنفّذها.**
- **الإجراء:** نقلها إلى `devDependencies` أو حذفها من `package.json` (غير مستوردة في `src/`)، ومراقبة إصدار جديد يرفع `image-size`.

## J-3 حزم يجب ألا تُرقَّى بشكل أعمى 🔴

| الحزمة | لماذا |
|---|---|
| **`tailwindcss` 3 → 4** | إعادة كتابة كاملة لمحرك التكوين. `tailwind.config.js` (3.8 KB مع ألوان `cyber-*` مخصصة) و`postcss.config.js` سيتوقفان. **هذا سيكسر التصميم بالكامل. لا ترقِّها.** |
| **`pdfjs-dist` 5 → 6** | تغييرات في الـ API ومسار الـ worker. مطلوبة أمنيًا لكن تحتاج اختبارًا مخصصًا |
| **`lucide-react` 0.x → 1.x** | تغيير أسماء أيقونات محتمل — التطبيق يستوردها في كل مكوّن تقريبًا |
| **`framer-motion` 12 → 13** | تغييرات API؛ الفائدة صفر (تُستخدم في مكوّنين، أحدهما يتيم) |
| **`html-to-docx` → 1.1.2** | نزول major يكسر محرك الـ DOCX |
| **`react-router-dom` 7.x** | ثبّت الإصدار الصغير — v7 غيّرت سلوك الـ data router |

## J-4 التوافق مع Node 24 / Vite 7 / Supabase

✅ Vercel يعمل بـ `nodeVersion: "24.x"` و`@types/node: ^24.10.1` متوافق.
✅ Vite 7 + React 19 + `@vitejs/plugin-react@5` — مجموعة متسقة.
⚠️ `pdf-parse@2.4.5` مكتبة Node — **لو استُوردت في الواجهة يومًا لكسرت البناء.** احذفها.
⚠️ إصدارات esm.sh غير موحّدة عبر Edge Functions (`@2` مقابل `@2.45.4`) — ثبّت إصدارًا واحدًا في كل الدوال.
⚠️ `supabase` CLI في `devDependencies` (`^2.98.1`) بينما `.temp/cli-latest` يشير إلى إصدار آخر — احتمال انحراف.

## J-5 توصيات فورية آمنة ✅

```
احذف:  pdf-parse, clsx, tailwind-merge, react-hot-toast
انقل إلى devDependencies:  autoprefixer, postcss, tailwindcss, html-to-docx
ثبّت بدقة (بلا ^):  pdfjs-dist@5.5.207
```
كل ما سبق **صفر مخاطر** — لا شيء منها مستورد في `src/`.

---

# K. Deployment Audit

## K-1 Vercel

| البند | القيمة | التقييم |
|---|---|---|
| Framework | `vite` | ✅ |
| Node | 24.x | ✅ |
| النطاقات | `resumation.co`, `www.resumation.co` + 3 نطاقات vercel | ✅ |
| آخر deploy | `dpl_TDDX...` — commit `1e6cb5a` "JobHunterPage_fixed_final" | — |
| تاريخ آخر deploy | **~22 يونيو 2026 (منذ ~2.5 شهر)** | ⚠️ |
| Serverless functions | 1 (`lambdaRuntimeStats: {"nodejs": 1}`) | ⚠️ انظر K-3 |
| بيئة staging/preview | **غير موجودة** | 🔴 |
| رؤية الريبو | **public** | ⚠️ |
| توقيع الـ commits | `githubCommitVerification: "unverified"` | 🟡 |

**الملاحظة الأهم:** آخر 20 deployment كلها `target: "production"` من فرع `master` مباشرة. **كل commit يذهب فورًا للإنتاج.** مع 118 `console.log` وصفحة نموذج أولي منشورة، هذا هو السبب الجذري لعدة مشاكل في هذا التقرير.

## K-2 Build

```json
"build": "vite build"
```
🔴 **لا يوجد `tsc -b`** — التحقق من الأنواع غير مشغَّل إطلاقًا في الـ build. مع 76 استخدامًا لـ `any` و3 `@ts-ignore`، أخطاء الأنواع تصل إلى الإنتاج بلا اعتراض. الـ scaffold الافتراضي لـ Vite يستخدم `"tsc -b && vite build"` — أُزيل هنا.
🔴 لا `npm run lint` في الـ CI رغم وجود `eslint.config.js` صالح.
🔴 لا خطوة اختبار (لا اختبارات أصلاً).

**الإصلاح الآمن (لكن نفّذه محليًا أولاً):**
```json
"build": "tsc -b && vite build"
```
⚠️ **قد يفشل البناء فورًا** إذا كانت هناك أخطاء أنواع متراكمة. شغّل `npx tsc -b --noEmit` محليًا أولاً لمعرفة الحجم.

## K-3 `api/geo.ts` — تناقض في وقت التشغيل

الملف يعلن:
```ts
export const config = { runtime: "edge" };
```
وتعليقه يقول *"Deployed as an Edge Function ... sub-10ms P99 response times"*.

لكن Vercel يُبلّغ `lambdaRuntimeStats: {"nodejs": 1}` — أي أن الدالة الوحيدة المنشورة تعمل بـ **Node runtime وليس Edge**.

**التأثير:** cold starts أعلى بكثير من الـ 10ms الموعودة، وتكلفة استدعاء أكبر. الوظيفة تعمل (قراءة headers فقط)، لكن الافتراض المكتوب في التعليق خاطئ.

**Needs Verification:** افحص لوحة Vercel → Functions لتأكيد وقت التشغيل الفعلي.

## K-4 متغيّرات البيئة

| المتغيّر | مستخدم؟ | ملاحظة |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ 20 مرة | لكن العنوان مكتوب حرفيًا في 5 مواضع أيضًا |
| `VITE_SUPABASE_ANON_KEY` | ✅ 18 مرة | |
| `VITE_EF_CREATE_CV_ORDER` | ✅ 3 مرات | |
| `VITE_EF_USER_SYNC` | ✅ مرة | |
| `VITE_EF_ANALYZE_CV` | ✅ مرة | |
| `VITE_EF_CONFIRM_PAYMENT` | ❌ **غير مستخدم** | `SuccessPage:271` يبني العنوان يدويًا |
| `VITE_EF_BASE` | ❌ غير مستخدم | |
| `VITE_PAYMOB_API_KEY` | ❌ غير مستخدم | 🔴 بادئة خطرة (D-22) |
| `VITE_PAYMOB_AI_SEARCH_LINK` | ⚠️ مستخدم لكن **فارغ** | يكسر شراء AI Hunter في مصر (D-24) |
| `VERCEL_OIDC_TOKEN` | ❌ | لا داعي له في `.env` |

**ملاحظة دقيقة عن `.env.local`:** الملف قديم (13 مايو 2026) ويحتوي 5 روابط `VITE_MAKE_*` متقاعدة، ولا يحتوي أي `VITE_EF_*`. Vite **يدمج** `.env` و`.env.local` (الأخير يفوز عند التعارض فقط)، لذا **متغيّرات `VITE_EF_*` تُحل بشكل صحيح محليًا** — لا يوجد كسر هنا. لكن الملف مُضلِّل ويجب حذفه أو تحديثه.

## K-5 ربط Supabase

- `supabase/.temp/project-ref` و`linked-project.json` يشيران إلى المشروع الصحيح.
- **يوجد مشروع Supabase ثانٍ:** `tbkpsebxkvsudrulneaj` ("JOB SCRAPPER", ap-northeast-1) بحالة **INACTIVE**. غير مستخدم في الكود — تأكد أنه غير مطلوب ثم احذفه (يستهلك حصة مشاريع).

## K-6 انحراف التكوين (Config Drift) 🔴

هذا أخطر جانب في قسم النشر:

### (أ) Edge Functions منشورة خارج الريبو
| الدالة | `verify_jwt` | تاريخ الإنشاء |
|---|---|---|
| `enrich-descriptions` | false | 18 مايو 2026 |
| `webhook-paymob` | false | 29 مايو 2026 |
| `hunter-v2-test` | true | 26 يونيو 2026 |

**`webhook-paymob` هو الأخطر:** webhook دفع مفتوح للعالم، **وكوده غير موجود في الريبو إطلاقًا** — لا يمكن مراجعته ولا استرجاع نسخة منه ولا معرفة ما إذا كان يتحقق من توقيع Paymob HMAC.

> **Needs Verification (أولوية عالية):**
> ```
> supabase functions download webhook-paymob --project-ref nbbxtealrhrnadlzmkev
> supabase functions download enrich-descriptions --project-ref nbbxtealrhrnadlzmkev
> supabase functions download hunter-v2-test --project-ref nbbxtealrhrnadlzmkev
> ```
> ثم راجع `webhook-paymob` فورًا — قد يكون مسار منح استحقاق مفتوحًا بالكامل.

### (ب) `config.toml` لا يعكس الواقع
الملف يحدد `verify_jwt = false` لثلاث دوال فقط (`webhook-wishmoney`, `parse-cv-import`, `generate-career-snapshot`)، لكن الواقع الحيّ فيه **10 دوال** بـ `verify_jwt = false`. الباقي ضُبط يدويًا من اللوحة.

### (ج) المخطط الحيّ ≠ ملفات الـ migrations
| العنصر | في الـ migrations | في قاعدة البيانات |
|---|---|---|
| `award_coins` | `(uuid, integer, text)` | **`(uuid, text, text DEFAULT NULL)`** |
| `spend_coins` | نسختان متعارضتان | `(uuid, integer, text, text DEFAULT NULL)` |
| `award_referral_coins` | `(uuid)` | **`(uuid, text)`** |
| `users_safe_public_read` | مُنشأة | **غير موجودة** ✅ |
| `profiles_public_read USING(true)` | مُنشأة | **غير موجودة** ✅ |
| فهرس `wishmoney_order_id` الفريد | غير موجود | **موجود** |
| `get_public_profile` / `get_public_profile_stats` | **غير موجودتين** | موجودتان |
| `fn_lock_profile_identity_fields` | غير موجودة | موجودة |
| `profiles.user_id` | غير موجود | موجود |
| جداول `companies`, `hv2_*`, `discovered_companies` | **غير موجودة** | موجودة |

**الخلاصة:** لا يمكن إعادة بناء هذه القاعدة من الـ migrations. `20260504230201_remote_schema.sql` فارغ (0 bytes). **الهجرات الموجودة مضلِّلة أكثر من كونها مفيدة** — قراءتها تعطي صورة أمنية مختلفة تمامًا عن الواقع (لحسن الحظ، الواقع أفضل في حالة سياسات `users`/`profiles`).

**الإصلاح:**
```bash
supabase db pull --project-ref nbbxtealrhrnadlzmkev   # يولّد migration مرجعية للواقع
```
ثم أرشف الملفات القديمة في `supabase/migrations/_archive/`.

---

# L. Unfinished / Forgotten Work

## L-1 TODO / FIXME صريحة

المشروع نظيف بشكل لافت من هذه العلامات — **علامة واحدة فقط**:
```ts
// src/components/ContactPage.tsx:50
// TODO: wire contact form to a Supabase Edge Function (e.g. send-contact-email via Resend)
```
**نموذج التواصل لا يُرسل أي شيء.** الصفحة معروضة، والمستخدم يملأ النموذج، ولا شيء يصل. `RESEND_API_KEY` مضبوط بالفعل ويُستخدم في الإيصالات — التوصيل سهل.

## L-2 `@ts-ignore` / `eslint-disable`
```
src/components/ResumeForm.tsx:7                 // @ts-ignore mammoth browser build
src/components/BuildingPage.tsx:226, 339        // eslint-disable react-hooks/exhaustive-deps
supabase/functions/generate-cv/index.ts:2       // @ts-ignore esm.sh default export
supabase/functions/generate-cv/docx/builders/build-cv-docx.ts:2   // @ts-ignore
```

## L-3 ميزات نصف مبنية

### 🔴 AI Hunter — نموذج أولي في الإنتاج
`src/pages/JobHunterPage.tsx` — الأدلة مفصّلة في G-7. باختصار: عنوان "Validation Screen"، وصف "Real-data prototype for testing"، `debugMessage` مرئي للمستخدم، رسالة خطأ تطلب من المستخدم فحص "Edge Function logs"، إنجليزي فقط، نظام تصميم مختلف، **بلا خصم عملات رغم أن الباقة تُباع بـ 10$**.

### 🔴 Hunter v2 — بنية جاهزة، غير موصولة
جداول `hv2_search_log`, `hv2_candidate_log`, `hv2_seen` موجودة بفهارسها (بما فيها `hv2_seen_pkey (user_id, content_fp)` — تصميم dedup مدروس)، **كلها 0 صفوف، RLS بلا سياسات، ولا كود في الريبو يشير إليها**. ودالة `hunter-v2-test` منشورة وكودها غير موجود.

### 🔴 برنامج الإحالة — نصف مبني
- ✅ `promo_code` يُولَّد، `PromoCodeBanner` يعرضه ويشاركه عبر واتساب.
- ✅ `referral_log` موجود، `fn_validate_referral` trigger يعمل.
- ✅ `award_referral_coins(uuid, text)` موجودة وصحيحة.
- 🔴 **لا أحد يستدعيها.** لا `confirm-payment` ولا `webhook-wishmoney` ولا الواجهة.
- 🔴 `hasReferral` في `PlansPage` يخصم 50% بلا أي تحقق خادمي.
- **النتيجة:** المُحيل لا يحصل على مكافأته أبدًا.

### 🔴 نظام العملات (Coin Economy) — مبني بالكامل، غير موصول
- ✅ `search_coins` + `coin_transactions` + `spend_coins` + `award_coins` + `manage-coins` — كلها مبنية بجودة عالية.
- 🔴 `manage-coins` **لا يُستدعى من الواجهة إطلاقًا**.
- 🔴 استدعاء `spend_coins` الوحيد (في `CareerAnalysis`) **مكسور** (D-7).
- 🔴 `search-jobs` — المستهلك الأساسي المفترض للعملات — لا يخصم شيئًا.
- **النتيجة:** بنية تحتية كاملة لنموذج تربّح غير مفعّل.

### 🟠 تتبّع التحميلات
جدول `downloads` + سياسات RLS جاهزة. الكتابة الوحيدة في `generate-free-cv:471` (best-effort). المسار المدفوع لا يكتب شيئًا. **0 صفوف.**

### 🟠 تحليل الـ CV (`cv_analysis_requests`)
البنية كاملة (جدول + RLS + Realtime + `analyze-cv` Edge Function مع gpt-4o). **0 صفوف** — لأن بوابة العملات مكسورة (D-7).

### 🟠 خصوصية الملف الشخصي
أعمدة `public_profile_enabled`, `profile_visibility` (مع CHECK), `cv_email_public`, `phone_public`, `qr_enabled` موجودة. الأخيران يُحترمان في `get_public_profile`؛ **الأولان يُتجاهلان تمامًا** (D-8).

### 🟠 CV Engine 2.0 — مكتمل تقنيًا، التنظيف ناقص
`docs/CV_ENGINE_2.0_PLAN.md` يقول **"Status: Planning Phase"** بينما المحرك الجديد **منشور ويعمل**. المحرك القديم `index.old-html-engine.ts` (73 KB) وملفات `.backup.ts` الخمسة ما زالت في الريبو.

## L-4 مسارات وملفات متروكة

| العنصر | الحالة |
|---|---|
| `src/pages/PrivateProfile.tsx` (53 KB) | يتيم — استُبدل بـ V2 |
| `src/components/EmployerAccess.tsx` (8 KB) | يتيم — لا مسار يشير إليه |
| مسار `/employer-links` | يعرض `AnalysisLinks` بدل `EmployerAccess` — **خطأ ربط شبه مؤكد** |
| `src/data/employersData.ts` | يُستورد في `FreeLinks`/`PremiumLinks`/`GoldLinks`/`AnalysisLinks` فقط |
| 5 ملفات `*.backup.ts` في الجذر | متروكة |
| `full_database_backup.sql` (0 bytes) | فارغ |
| `20260504230201_remote_schema.sql` (0 bytes) | فارغ |
| `week1_security_migration.sql` | خارج مجلد migrations، متجاوَز بالكامل |
| `public/_redirects` | ملف Netlify في مشروع Vercel |
| `src/App.css`, `src/assets/react.svg`, `public/vite.svg` | بقايا قالب Vite |
| `test-brave-search` | دالة اختبار منشورة في الإنتاج |
| `profiles_backup_2026_06_13` | جدول نسخ احتياطي في قاعدة البيانات |
| مشروع Supabase `JOB SCRAPPER` | INACTIVE، غير مستخدم |
| كل متغيّرات `VITE_MAKE_*` | Make.com متقاعد (موثّق في `.env`) لكن الملف باقٍ |

## L-5 تعليقات تكشف عملًا مؤقتًا

```ts
// create-cv-order/index.ts:221-223
// Temporary diagnostic log: shows the full successful WishMoney API response
// so we can identify whether WishMoney returns its own invoice/reference number
console.log("WishMoney success response:", JSON.stringify(wmData, null, 2));
```
```ts
// confirm-payment/index.ts:201-204
// Fails-open when PAYMOB_API_KEY is not configured (for backward compat during
// rollout) and on transient network errors...
```
"أثناء الطرح" (during rollout) — الطرح انتهى منذ أشهر، والـ fail-open باقٍ.
```ts
// JobHunterPage.tsx:112-113
// Keep V1 fast enough for browser validation.
// The Edge Function defaults are heavier and can timeout in production.
```

---

# M. Recommended Repair Plan

> **مبدأ عام:** الحفاظ على المعمارية الحالية بالكامل. لا rewrite. كل الإصلاحات أدناه موضعية.
>
> **نافذة الفرصة:** بوجود صفَّي طلبات فقط و16 مستخدمًا، إصلاحات قاعدة البيانات التي ستكون شبه مستحيلة بعد 1000 مستخدم **تافهة اليوم**. هذا هو أفضل وقت ممكن.

---

## 🚨 Phase 0 — Critical Blockers
**الهدف:** إيقاف النزيف المالي وتسريب البيانات. **لا تطلق أي تسويق قبل إنهاء هذه المرحلة.**
**المدة المقدّرة:** 1–2 يوم

**بالترتيب:**

1. **حذف `test-brave-search` من الإنتاج.**
   دقيقة واحدة، صفر مخاطر، يغلق نقطة استنزاف مباشرة لمفتاح Brave.

2. **إغلاق الدوال المفتوحة** — تفعيل `verify_jwt = true` على `search-jobs`, `discover-career-pages`, `parse-cv-import` من لوحة Supabase، **و** إضافة `auth.getUser()` داخل كود كل منها (حزام + حمّالة).
   *ملاحظة:* بعدها عدّل `JobHunterPage.tsx:133` ليرسل `session.access_token` بدل `VITE_SUPABASE_ANON_KEY`.

3. **إصلاح سياسات storage** (D-6) — سكربت SQL واحد:
   ```sql
   -- cv_imports: تحديد مجلد المستخدم
   DROP POLICY "Authenticated users can read CV imports"   ON storage.objects;
   DROP POLICY "Authenticated users can delete CV imports" ON storage.objects;
   DROP POLICY "Authenticated users can upload CV imports" ON storage.objects;
   CREATE POLICY cv_imports_owner_select ON storage.objects FOR SELECT TO authenticated
     USING (bucket_id='cv_imports' AND (storage.foldername(name))[1] = auth.uid()::text);
   CREATE POLICY cv_imports_owner_insert ON storage.objects FOR INSERT TO authenticated
     WITH CHECK (bucket_id='cv_imports' AND (storage.foldername(name))[1] = auth.uid()::text);
   CREATE POLICY cv_imports_owner_delete ON storage.objects FOR DELETE TO authenticated
     USING (bucket_id='cv_imports' AND (storage.foldername(name))[1] = auth.uid()::text);
   -- cv-documents: إزالة الكتابة العامة
   DROP POLICY "Service role write CVs"  ON storage.objects;
   DROP POLICY "Service role update CVs" ON storage.objects;
   ```

4. **إغلاق أعمدة `users`** (D-2):
   ```sql
   REVOKE UPDATE ON public.users FROM authenticated, anon;
   GRANT UPDATE (first_name, last_name, preferred_language, agreed_to_terms)
     ON public.users TO authenticated;
   ```
   ⚠️ **قبل التنفيذ:** ابحث عن كل `.from('users').update(` في `src/` وتأكد أنها لا تكتب خارج القائمة.

5. **إغلاق `order_generations`** (D-1) — بترتيب صارم:
   - أولًا: إنشاء Edge Function `set-generation-language` (service_role) واستبدال `SuccessPage.tsx:403`.
   - ثانيًا: نقل إنشاء صف الباقة المجانية إلى Edge Function `create-free-order`.
   - ثالثًا فقط:
     ```sql
     DROP POLICY order_gen_insert_own ON public.order_generations;
     DROP POLICY order_gen_update_own ON public.order_generations;
     REVOKE INSERT, UPDATE ON public.order_generations FROM authenticated, anon;
     ```

6. **إصلاح السعر الخادمي (WishMoney)** (D-4) — جدول أسعار في `create-cv-order`، حذف `amount` من الـ body، توسيع الـ HMAC ليشمل `plan` و`amount`.

7. **إزالة fail-open من `confirm-payment`** (D-5) + إضافة الفهرس الفريد:
   ```sql
   CREATE UNIQUE INDEX order_generations_paymob_order_id_unique
     ON public.order_generations (paymob_order_id) WHERE paymob_order_id IS NOT NULL;
   ```
   + التحقق من `PAYMOB_API_KEY` و`WISHMONEY_API_URL` في Supabase Secrets.

8. **تنزيل ومراجعة `webhook-paymob`** — كود غير مراجَع في مسار دفع مفتوح. إن لم يكن آمنًا، عطّله.

9. **إصلاح خصوصية `get_public_profile`** (D-8).

---

## 🔧 Phase 1 — Stability
**الهدف:** إعادة تشغيل الميزات المكسورة والمعروضة للمستخدمين.
**المدة المقدّرة:** 2–3 أيام

**بالترتيب:**

1. **إصلاح `spend_coins`** (D-7) — تمرير `p_user_id` في `CareerAnalysis.tsx:227` و`manage-coins/index.ts:69`. **هذا يعيد إحياء ميزة كاملة بسطرين.**
2. **تصحيح رسالة الخطأ** في `spendCoins` لتفرّق بين نقص الرصيد والخطأ التقني.
3. **إصلاح `public-platform-stats`** (D-14) — `hunter_companies` → `companies`. سطر واحد يصلح الصفحة الرئيسية.
4. **إصلاح `auth-on-signup`** (D-9) — `user_id` بدل `id`، والتحقق من تفعيل الـ Hook.
5. **Backfill البيانات:** إنشاء صفوف `users` للـ 5 حسابات الناقصة، وصفوف `profiles` للـ 16.
6. **توحيد هوية `profiles`** — قرار: `id` أم `user_id`. نفّذه الآن بـ 8 صفوف.
7. **إصلاح `delete-account`** (D-15) — المراجع المكسورة + تنظيف الـ buckets الأربعة + فحص الأخطاء.
8. **إضافة cache guard إلى `generate-cv`** (D-19).
9. **إرجاع 500 من `webhook-wishmoney` عند الفشل الحقيقي** (D-12).
10. **حذف نسخة منح العملات الاحتياطية** (D-13) واستخدام `award_coins` RPC حصرًا.
11. **إصلاح `detectRegion`** (D-17) — حذف طبقة ipapi.co المحجوبة.
12. **توحيد pdf.js worker** (D-18) — نمط `ResumeForm` في `CareerAnalysis`.
13. **توصيل نموذج التواصل** (L-1) أو إخفاؤه.

---

## 🔐 Phase 2 — Security & Data Integrity
**المدة المقدّرة:** 3–4 أيام

**بالترتيب:**

1. **إضافة أعمدة سجل الدفع:**
   ```sql
   ALTER TABLE public.order_generations
     ADD COLUMN paid_amount      numeric,
     ADD COLUMN paid_currency    text,
     ADD COLUMN payment_verified boolean NOT NULL DEFAULT false,
     ADD CONSTRAINT og_package_chk CHECK (package_name IN ('free','premium','gold','ai_search')),
     ADD CONSTRAINT og_method_chk  CHECK (payment_method IN ('free','wishmoney','paymob'));
   ```
   وفي `generate-cv`: رفض أي صف بـ `payment_verified = false`.
2. **جدول `payment_events`** — سجل خام لكل callback قبل المعالجة. سجل تدقيق مستقل.
3. **منع المنح المزدوج للعملات:**
   `CREATE UNIQUE INDEX ON coin_transactions (user_id, reference, reason) WHERE reference IS NOT NULL;`
4. **تقييد صلاحيات أعمدة `profiles`** — منع كتابة `active_plan`, `documents_generated_count`, `analyses_used_count`, `cover_letters_generated_count` من العميل.
5. **تفعيل `fn_lock_profile_identity_fields`** (D-16) + ضبط `search_path`.
6. **اشتقاق المنطقة من الخادم** (D-10) + التحقق الخادمي من الإحالة.
7. **إصلاح Stage 2 في `confirm-payment`** — منع المنح المزدوج لصفوف WishMoney.
8. **إزالة `VITE_PAYMOB_API_KEY`** من `.env`/`.env.local`/Vercel + تدوير المفتاح.
9. **فحص تاريخ git** بحثًا عن `.env` مرفوع سابقًا؛ تدوير كل الأسرار عند الاشتباه.
10. **تقييد CORS** على `https://www.resumation.co` بدل `*`.
11. **Rate limiting** على `generate-cv`, `analyze-cv`, `parse-cv-import`, `search-jobs`, `generate-career-snapshot`.
12. **حذف `profiles_backup_2026_06_13`** بعد التأكد من الاستغناء عنه.
13. **إزالة تفاصيل الأخطاء الخام** من استجابات Edge Functions.
14. **`supabase db pull`** لتوليد migration مرجعية مطابقة للواقع.

---

## 🎯 Phase 3 — Product Completion
**المدة المقدّرة:** 1–2 أسبوع

**بالترتيب:**

1. **قرار AI Hunter:** إما إخفاء `/ai-hunter` خلف علم ميزة حتى يكتمل، **أو** إنهاؤه: ترجمة عربية + نظام التصميم `cyber-*` + إزالة `debugMessage` و`console.log` + **توصيل خصم العملات**.
2. **توصيل نظام العملات فعليًا** — `search-jobs` يخصم عبر `spend_coins`، وتفعيل مسار التحليل.
3. **إكمال برنامج الإحالة** — استدعاء `award_referral_coins` من `confirm-payment` و`webhook-wishmoney` بعد الدفع المؤكد.
4. **إصلاح شراء AI Hunter في مصر** (D-24) أو إخفاء الباقة هناك.
5. **توصيل تتبّع التحميلات** — الكتابة في `downloads` من المسار المدفوع.
6. **إصلاح مسار `/employer-links`** أو حذفه مع `EmployerAccess.tsx`.
7. **مواءمة قواعد اسم المستخدم** (3–20 في الواجهة مقابل ≥6 في DB).
8. **توحيد التسعير** — مصدر واحد للحقيقة، وتحديث `docs/PRICING_AND_UNIT_ECONOMICS.md`.
9. **اختبار مسار Paymob من طرف لطرف بمعاملة حقيقية** — لم ينجح ولا مرة واحدة حتى الآن.
10. **إضافة زر إعادة المحاولة** في `BuildingPage`.

---

## ⚡ Phase 4 — Performance
**المدة المقدّرة:** 2–3 أيام

**بالترتيب:**

1. **`React.lazy` + `Suspense` لكل مسار** في `App.tsx` — أعلى أثر لأقل جهد.
2. **`manualChunks` في `vite.config.ts`** — فصل react / pdfjs / mammoth / framer-motion / supabase.
3. **حذف التبعيات غير المستخدمة** (J-5).
4. **استبدال `select("*")`** بأعمدة محددة في `generate-cv:1373` و`MyAccount:227`.
5. **تأخير polling في `BuildingPage`** حتى صمت Realtime لـ 15 ثانية.
6. **نقل prompts `generate-cv`** إلى ملفات `prompts/` (النسخ موجودة) — الملف من 99 KB إلى ~15 KB، ونشر أسرع.
7. **تحسين صور الـ Hero** (373 KB / 322 KB) — `<picture>` بأحجام متعددة + `loading="lazy"`.
8. **تقليص صلاحية الروابط الموقّعة** من 90 يومًا إلى ساعة مع التوليد عند الطلب.

---

## 🧹 Phase 5 — Cleanup
**المدة المقدّرة:** 2–3 أيام

**بالترتيب:**

1. **حذف الملفات الميتة:** `PrivateProfile.tsx`, `EmployerAccess.tsx`, الملفات الخمسة `*.backup.ts`, `index.old-html-engine.ts`, `full_database_backup.sql`, `20260504230201_remote_schema.sql`, `App.css`, `react.svg`, `vite.svg`, `public/_redirects`.
2. **حذف/تحديث `.env.local`** ومتغيّرات `VITE_MAKE_*` المتقاعدة.
3. **إزالة الـ 118 `console.*`** — أو استبدالها بأداة تسجيل تُعطَّل في الإنتاج.
4. **إضافة `tsc -b` إلى الـ build** — بعد إصلاح أخطاء الأنواع المتراكمة.
5. **إضافة `npm run lint` إلى CI.**
6. **تقسيم `ResumeForm.tsx`** (172 KB) — الأولوية القصوى للصيانة.
7. **استخراج الوحدات المشتركة** في `supabase/functions/_shared/`: جدول الأسعار، قالب الإيصال، `hmacSha256Hex`، منح العملات، رؤوس CORS.
8. **تثبيت إصدار esm.sh موحّد** عبر كل Edge Functions.
9. **توحيد أسماء المسارات** وحذف الأسماء المستعارة المكررة.
10. **إنشاء فرع `staging`** وبيئة Preview على Vercel — **إيقاف النشر المباشر من `master` إلى الإنتاج.**
11. **إضافة أول اختبارات:** `validate-cv-json`, `normalize-cv-json`, وبناء الـ DOCX (بيانات الاختبار جاهزة في `test-data/`).
12. **أرشفة الـ migrations القديمة** بعد `db pull`.
13. **حذف مشروع Supabase `JOB SCRAPPER`** إن لم يكن مطلوبًا.
14. **تحديث `docs/CV_ENGINE_2.0_PLAN.md`** من "Planning Phase" إلى "Shipped".

---

# N. Final Verdict

## هل المشروع آمن لنكمل تطويره؟

**نعم — بثقة.** الأساس المعماري سليم، والأنماط الصحيحة موجودة فعلاً في الكود (التحقق من JWT، `spend_coins`، الـ idempotency في WishMoney، بنية محرّك الـ DOCX). المشاكل ليست أخطاء تصميم عميقة، بل **حالات لم تُطبَّق فيها الأنماط الصحيحة الموجودة أصلاً**. لا حاجة لإعادة كتابة أي شيء.

الجزء الأصعب — محرّك توليد الـ CV — هو أفضل جزء في المشروع.

## هل هو آمن للإنتاج؟

**لا. ليس بحالته الحالية.**

أربع حقائق مؤكَّدة تكفي وحدها:
1. أي مستخدم مسجّل يستطيع الحصول على باقة Gold كاملة **مجانًا** بأمر `INSERT` واحد من console المتصفّح.
2. أي مستخدم مسجّل يستطيع منح نفسه **رصيد عملات لا نهائي** بأمر `UPDATE` واحد.
3. أي شخص على الإنترنت — **بدون حساب** — يستطيع استنزاف مفتاح Brave Search عبر `search-jobs`.
4. أي مستخدم مسجّل يستطيع **قراءة وحذف السير الذاتية الخام لكل المستخدمين** من bucket `cv_imports`.

هذه ليست ثغرات نظرية تحتاج أدوات متخصصة — كل واحدة منها أمر واحد من DevTools.

**لكن:** لا شيء من هذا استُغِلّ بعد (المؤشرات: صفَّان فقط في `order_generations`، 3 معاملات عملات، لا نشاط شاذ). أنت في **أفضل وضع ممكن للإصلاح**: الثغرات معروفة، ولم تُستغل، وحجم البيانات صغير جدًا.

## ما هو أكبر خطر موجود؟

> **ليس ثغرة بعينها — بل النمط المعماري الذي أنتجها جميعًا:**
>
> **الخادم يستخدم بيانات قادمة من المتصفّح كمصدر حقيقة للقرارات المالية.**

`package_name` من العميل. `amount` من العميل. `plan` من العميل. `search_coins` قابل للكتابة من العميل. `user_region` من cookie. `hasReferral` من حالة React.

أصلحت ثغرة، وسيولد النمط ثغرة أخرى في الميزة التالية.

**الخطر الملموس المصاحب:** لا يوجد في قاعدة البيانات **أي عمود يسجّل المبلغ المدفوع فعليًا**، ولا سجل معاملات مستقل. لو حصل استغلال اليوم، **لن تستطيع اكتشافه ولا قياس حجمه ولا إثباته** — لا يوجد أثر تدقيقي.

**والخطر التنظيمي:** `webhook-paymob` — دالة webhook دفع مفتوحة للعالم، منشورة منذ 29 مايو، **وكودها غير موجود في الريبو إطلاقًا**. لا أستطيع تقييمها. قد تكون آمنة، وقد تكون أوسع باب مفتوح في النظام. **هذا أول ما يجب أن تفحصه.**

## أول 5 أشياء يجب إصلاحها قبل أي feature جديد

بهذا الترتيب بالضبط:

### 1️⃣ إغلاق الكتابة من العميل على جداول المال
`order_generations` (INSERT/UPDATE) و`users.search_coins`. سكربتان SQL + Edge Function واحدة صغيرة لاختيار اللغة.
→ **يغلق ثغرتَي "المنتج المدفوع مجانًا" و"العملات اللانهائية" معًا.**

### 2️⃣ إغلاق Edge Functions المفتوحة
`verify_jwt = true` على `search-jobs` + `discover-career-pages` + `parse-cv-import`، حذف `test-brave-search`، وتنزيل ومراجعة `webhook-paymob`.
→ **يوقف الاستنزاف المالي غير المحدود ويكشف المجهول الأخطر.**

### 3️⃣ إصلاح سياسات storage
`cv_imports` بتحديد مجلد المستخدم، وحذف سياستَي الكتابة العامة على `cv-documents`.
→ **يوقف تسريب بيانات شخصية حقيقية (سير ذاتية كاملة) بين المستخدمين.**

### 4️⃣ التحقق الخادمي من المبلغ والباقة
جدول أسعار خادمي واحد، حذف `amount` و`plan` من أجسام الطلبات، إزالة كل fail-open من `confirm-payment`، وإضافة الفهرس الفريد على `paymob_order_id`.
→ **يجعل الدفع يعني الدفع.**

### 5️⃣ إصلاح `spend_coins` وإضافة عمود `paid_amount`
سطران يعيدان ميزة تحليل الـ CV إلى الحياة، وعمود واحد يمنحك أول أثر تدقيقي مالي في النظام.
→ **يصلح ميزة معطّلة أمام المستخدمين، ويعطيك القدرة على اكتشاف أي استغلال مستقبلي.**

---

## ملحق: بنود تحتاج تحققًا منك (Needs Verification)

| # | البند | الأمر أو الخطوة |
|---|---|---|
| 1 | هل `PAYMOB_API_KEY` مضبوط؟ (يحدد إن كان fail-open نشطًا الآن) | `supabase secrets list --project-ref nbbxtealrhrnadlzmkev` |
| 2 | هل `WISHMONEY_API_URL` يشير للإنتاج لا للـ sandbox؟ | نفس الأمر |
| 3 | كود `webhook-paymob` — **الأولوية القصوى** | `supabase functions download webhook-paymob --project-ref nbbxtealrhrnadlzmkev` |
| 4 | كود `enrich-descriptions` و`hunter-v2-test` | `supabase functions download <name> --project-ref ...` |
| 5 | هل رُفع `.env` في تاريخ git يومًا؟ | `git log --all --full-history --oneline -- .env .env.local` |
| 6 | هل Auth Hook لـ `auth-on-signup` مفعّل؟ | Supabase Dashboard → Auth → Hooks |
| 7 | هل `api/geo.ts` يعمل كـ Edge أم Node؟ | Vercel Dashboard → Project → Functions |
| 8 | كم خطأ نوع سيظهر عند تفعيل `tsc -b`؟ | `npx tsc -b --noEmit` |
| 9 | هل توجد `.from('users').update()` تكتب أعمدة حسّاسة؟ | `grep -rn "from('users').update\|from(\"users\").update" src/` |
| 10 | هل مشروع Supabase `JOB SCRAPPER` مطلوب؟ | مراجعة يدوية |

---

*انتهى التقرير. لم يُعدَّل أي ملف، ولم يُنفَّذ أي write على Supabase أو Vercel أو GitHub.*
