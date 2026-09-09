// ─────────────────────────────────────────────────────────────────────────────
// resolve-region — authenticated trusted-region resolver.
//
// Establishes and maintains public.users.region as the ONLY authoritative region
// for a user. Nothing here reads a region from the client: not the body, not a
// cookie, not a query string. The client IP comes from a server-observed header
// and the country comes from MaxMind.
//
// Cost model: GeoIP Country (cheap) runs on every call. GeoIP Insights (paid
// anonymizer data) runs ONLY when the user is not yet verified, when the
// observed country differs from the stored region, or when the user is flagged.
// A verified user browsing from their own country costs zero Insights queries,
// and so does a user already serving an open rapid-region-change cooldown —
// Insights cannot change that outcome, so it is not purchased. An anonymizer
// flag is likewise not re-tested more than once per recheck window, which caps
// what a single caller can spend by hammering this endpoint from a VPN.
//
// Auth pattern mirrors supabase/functions/user-sync/index.ts.
//
// ⚠ PREREQUISITES — this function does NOT create them:
//   • public.users.region_status      text
//   • public.users.region_flag_reason text
//   • public.users.region_flagged_at  timestamptz
//   • public.users.region_verified_at timestamptz
//   • `cf-connecting-ip` must be set by the platform proxy, not echoed from the
//     client. Verify with region-header-test before trusting this in production.
//
// MaxMind field names verified against dev.maxmind.com/geoip/docs/web-services/.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAXMIND_COUNTRY_URL  = "https://geoip.maxmind.com/geoip/v2.1/country";
const MAXMIND_INSIGHTS_URL = "https://geoip.maxmind.com/geoip/v2.1/insights";
const MAXMIND_TIMEOUT_MS   = 5_000;

// A verified region may not be replaced by a different country within this
// window, even when the IP looks clean. Blunts rotating-exit region shopping;
// a genuine traveller simply re-resolves after the window closes.
const RAPID_REGION_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;

// An anonymizer verdict is trusted for this long before Insights is paid for
// again. Without it every request from a VPN buys a fresh Insights query, so a
// single authenticated caller could run up the MaxMind bill at request rate.
// Short enough that a user who drops their VPN is not stuck for long.
const ANONYMIZER_RECHECK_WINDOW_MS = 15 * 60 * 1000;

// Present-and-true on any of these = positive anonymizer detection.
// Per MaxMind, these keys are omitted entirely when not true — absence is
// "no positive signal reported", NOT proof the IP is clean.
const ANONYMIZER_FLAGS = [
  "is_anonymous",
  "is_anonymous_vpn",
  "is_public_proxy",
  "is_residential_proxy",
  "is_tor_exit_node",
] as const;

type RegionStatus = "verified" | "unverified" | "flagged";

// Why a region was flagged. Written only by this function; anything else found
// in the column is treated as no reason at all.
type RegionFlagReason = "anonymizer" | "rapid_region_change";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/** Bare IPv4/IPv6 literal only — nothing else reaches a MaxMind URL path. */
function isIpLiteral(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) ||
    (value.includes(":") && /^[0-9A-Fa-f:.]{2,45}$/.test(value));
}

function isIsoCountry(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

/** GET a MaxMind endpoint. Returns the parsed body, or null on any failure. */
async function maxmindGet(
  baseUrl: string,
  ip: string,
  basicAuth: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), MAXMIND_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/${encodeURIComponent(ip)}`, {
      method:  "GET",
      headers: { "Authorization": `Basic ${basicAuth}`, "Accept": "application/json" },
      signal:  controller.signal,
    });
    if (!res.ok) return null;                       // raw error body never surfaced
    return asObject(await res.json().catch(() => null)) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** True only if MaxMind positively reported at least one anonymizer signal. */
function hasPositiveAnonymizerSignal(insights: Record<string, unknown>): boolean {
  const anonymizer = asObject(insights.anonymizer);   // Insights object (2025-11)
  const traits     = asObject(insights.traits);       // legacy duplicates
  return ANONYMIZER_FLAGS.some(
    (flag) => anonymizer?.[flag] === true || traits?.[flag] === true,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── JWT verification ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ ok: false, error: "Missing authorization header" }, 401);
  }
  const token = authHeader.slice(7);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  const authDb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authErr } = await authDb.auth.getUser(token);
  if (authErr || !user) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  const userId = user.id;   // the only trusted identity — never from the body
  // ──────────────────────────────────────────────────────────────────────────

  const accountId  = Deno.env.get("MAXMIND_ACCOUNT_ID")  ?? "";
  const licenseKey = Deno.env.get("MAXMIND_LICENSE_KEY") ?? "";
  if (!accountId || !licenseKey) {
    return json({ ok: false, error: "Region service is not configured" }, 500);
  }
  const basicAuth = btoa(`${accountId}:${licenseKey}`);

  const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Stored trusted state ──────────────────────────────────────────────────
  const { data: row, error: rowErr } = await db
    .from("users")
    .select(
      "region, region_status, region_flag_reason, region_flagged_at, region_verified_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (rowErr) {
    console.error("resolve-region: user lookup failed", rowErr.message);
    return json({ ok: false, error: "Could not read region state" }, 500);
  }
  if (!row) {
    // No public.users row. Fail closed rather than creating a partial record.
    return json({ ok: false, error: "User profile not found" }, 409);
  }

  const storedRegion: string | null   = isIsoCountry(row.region) ? row.region : null;
  const storedStatus: RegionStatus    =
    row.region_status === "verified" || row.region_status === "flagged"
      ? row.region_status
      : "unverified";
  const storedFlagReason: RegionFlagReason | null =
    row.region_flag_reason === "anonymizer" ||
      row.region_flag_reason === "rapid_region_change"
      ? row.region_flag_reason
      : null;
  const flaggedAtMs: number = typeof row.region_flagged_at === "string"
    ? Date.parse(row.region_flagged_at)
    : NaN;
  const verifiedAtMs: number = typeof row.region_verified_at === "string"
    ? Date.parse(row.region_verified_at)
    : NaN;

  const baseline = {
    region:                 storedRegion,
    region_status:          storedStatus,
    changed:                false,
    verification_performed: false,
    suspicious:             null as boolean | null,
  };

  // ── Client IP: server-observed header ONLY ────────────────────────────────
  const clientIp = (req.headers.get("cf-connecting-ip") ?? "").trim();
  if (!clientIp || !isIpLiteral(clientIp)) {
    // Cannot observe the client — never downgrade, never guess.
    return json({ ok: false, ...baseline, observed_country: null,
      error: "Client IP unavailable" }, 400);
  }

  // ── Step 1: cheap country lookup (every call) ─────────────────────────────
  const countryBody = await maxmindGet(MAXMIND_COUNTRY_URL, clientIp, basicAuth);
  const observedRaw = asObject(countryBody?.country)?.iso_code;
  const observed    = isIsoCountry(observedRaw) ? observedRaw : null;

  if (!observed) {
    // MaxMind unavailable. A verified user keeps their region; an unverified
    // user stays unverified. Never downgrade on a transient outage.
    return json({
      ok: storedStatus === "verified",
      ...baseline,
      observed_country: null,
    }, storedStatus === "verified" ? 200 : 503);
  }

  // ── CASE B: verified and still in the same country — no Insights, no write ─
  if (storedStatus === "verified" && storedRegion && observed === storedRegion) {
    return json({ ok: true, ...baseline, observed_country: observed });
  }

  // The stored region is too freshly verified for a move to a different country
  // to be adopted. Anchored to region_verified_at, which is never written while
  // flagged — so re-requesting cannot shorten the window. An unparseable or
  // absent region_verified_at does not trigger the cooldown.
  const withinRegionChangeCooldown =
    storedRegion !== null &&
    observed !== storedRegion &&
    Number.isFinite(verifiedAtMs) &&
    (Date.now() - verifiedAtMs) < RAPID_REGION_CHANGE_WINDOW_MS;

  // ── Cost guard: an open rapid-region-change cooldown needs no Insights ─────
  // Already flagged for exactly this reason, still in the same other country,
  // window still open. Insights cannot change the outcome, so it is not bought.
  // No write either: the stored row already holds these values, and
  // region_verified_at must keep counting from the real verification.
  if (
    storedStatus === "flagged" &&
    storedFlagReason === "rapid_region_change" &&
    withinRegionChangeCooldown
  ) {
    return json({
      ok:                     true,
      region:                 storedRegion,
      region_status:          "flagged",
      region_flag_reason:     "rapid_region_change",
      changed:                false,
      verification_performed: false,
      suspicious:             false,
      rapid_region_change:    true,
      observed_country:       observed,
    });
  }

  // ── Cost guard: a fresh anonymizer verdict is not re-tested ───────────────
  // Anchored to region_flagged_at, which is not rewritten here — so hammering
  // this endpoint cannot extend the window, and cannot buy a new Insights query
  // either. The verdict stands until the window closes; after that Insights runs
  // again and a caller who has dropped their VPN is verified normally.
  if (
    storedStatus === "flagged" &&
    storedFlagReason === "anonymizer" &&
    Number.isFinite(flaggedAtMs) &&
    (Date.now() - flaggedAtMs) < ANONYMIZER_RECHECK_WINDOW_MS
  ) {
    return json({
      ok:                     true,
      region:                 storedRegion,
      region_status:          "flagged",
      region_flag_reason:     "anonymizer",
      changed:                false,
      verification_performed: false,
      suspicious:             true,
      rapid_region_change:    false,
      observed_country:       observed,
    });
  }

  // ── CASES A / C / D: unverified, country changed, or flagged ──────────────
  const insights = await maxmindGet(MAXMIND_INSIGHTS_URL, clientIp, basicAuth);

  if (!insights) {
    // Insights unavailable: make no decision at all. Keep whatever is stored.
    return json({
      ok: storedStatus === "verified",
      ...baseline,
      observed_country: observed,
    }, storedStatus === "verified" ? 200 : 503);
  }

  const suspicious = hasPositiveAnonymizerSignal(insights);

  // Cooldown: a clean IP in a new country is still refused while the window is
  // open. Applies to "flagged" as well as "verified", otherwise the first
  // refusal would itself clear the condition on the next request.
  const rapidRegionChange =
    !suspicious &&
    (storedStatus === "verified" || storedStatus === "flagged") &&
    withinRegionChangeCooldown;

  // A positive anonymizer signal outranks the cooldown; rapidRegionChange is
  // already gated on !suspicious, so at most one reason can apply.
  const flagReason: RegionFlagReason | null = suspicious
    ? "anonymizer"
    : rapidRegionChange
    ? "rapid_region_change"
    : null;

  const flagged = flagReason !== null;

  // Flagged → flag with the reason, stamp region_flagged_at so the recheck
  //           window starts now, keep the stored region, leave
  //           region_verified_at alone.
  // Clean    → adopt the observed country, clear the reason and the flag stamp,
  //           stamp the verification.
  const patch = flagged
    ? {
        region_status:      "flagged" as const,
        region_flag_reason: flagReason,
        region_flagged_at:  new Date().toISOString(),
      }
    : {
        region:             observed,
        region_status:      "verified" as const,
        region_flag_reason: null,
        region_flagged_at:  null,
        region_verified_at: new Date().toISOString(),
      };

  const { error: updateErr } = await db.from("users").update(patch).eq("id", userId);

  if (updateErr) {
    console.error("resolve-region: region update failed", updateErr.message);
    return json({ ok: false, ...baseline, observed_country: observed,
      error: "Could not persist region" }, 500);
  }

  return json({
    ok:                     true,
    region:                 flagged ? storedRegion : observed,
    region_status:          flagged ? "flagged" : "verified",
    region_flag_reason:     flagReason,
    changed:                !flagged && observed !== storedRegion,
    verification_performed: true,
    suspicious,
    rapid_region_change:    rapidRegionChange,
    observed_country:       observed,
  });
});
