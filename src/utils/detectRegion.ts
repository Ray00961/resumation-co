import Cookies from "js-cookie";

export type Region = "EG" | "LB";

// In-memory cache — only hits the network once per page session
let _memCache: Region | null = null;

/**
 * Detect the user's region with a 3-tier fallback:
 *  1. Memory cache  (instant — same JS context)
 *  2. Cookie cache  (7 days — across page loads)
 *  3. /api/geo      (Vercel Edge headers — free, no rate-limit, ~5 ms)
 *  4. ipapi.co      (external fallback — rate-limited, backup only)
 *  5. Hard default  "LB"
 *
 * Sanitization: Vercel can return sub-national region codes (e.g. "BA" for
 * Beirut Governorate). We normalise at source in /api/geo, but also guard
 * here so the logic is safe regardless of the geo response shape.
 */
export async function detectRegion(): Promise<Region> {
  // ── 1. Memory cache ──
  if (_memCache) return _memCache;

  // ── 2. Cookie cache ──
  const cookie = Cookies.get("user_region") as Region | undefined;
  if (cookie === "EG" || cookie === "LB") {
    _memCache = cookie;
    return cookie;
  }

  // ── 3. Vercel Edge headers (/api/geo) ──
  try {
    const res = await fetch("/api/geo", {
      cache:  "default",                    // respect Cache-Control: max-age=3600
      signal: AbortSignal.timeout(2_000),   // 2 s — Edge Function should be ~5 ms
    });
    if (res.ok) {
      const data: { country?: string; region?: string } = await res.json();
      // Use country (most reliable). Guard against sub-national bleed-through:
      // if country is absent but region is "LB" or "EG" treat it as country code.
      const raw = data.country || data.region || "";
      if (raw) {
        const detected: Region = raw === "EG" ? "EG" : "LB";
        _setRegion(detected);
        return detected;
      }
    }
  } catch { /* network error / timeout — try next tier */ }

  // ── 4. ipapi.co fallback ──
  try {
    const res = await fetch("https://ipapi.co/json/", {
      cache:  "no-store",
      signal: AbortSignal.timeout(2_500),   // tighter than before (was 3 s)
    });
    if (res.ok) {
      const data: { country_code?: string } = await res.json();
      if (data?.country_code) {
        const detected: Region = data.country_code === "EG" ? "EG" : "LB";
        _setRegion(detected);
        return detected;
      }
    }
  } catch { /* network error / timeout — use default */ }

  // ── 5. Final default ──
  _setRegion("LB");
  return "LB";
}

/** Force-clear cache (e.g. on logout or manual region override) */
export function clearRegionCache() {
  _memCache = null;
  Cookies.remove("user_region");
}

function _setRegion(r: Region) {
  _memCache = r;
  Cookies.set("user_region", r, { expires: 7 });
}
