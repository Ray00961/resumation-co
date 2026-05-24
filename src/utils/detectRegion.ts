import Cookies from "js-cookie";

export type Region = "EG" | "LB";

// In-memory cache so we only hit the network once per page load
let _memCache: Region | null = null;

/**
 * Detect the user's region with a 3-tier fallback:
 *  1. Memory cache (instant, same session)
 *  2. Cookie cache (7 days, across page loads)
 *  3. Vercel Edge header via /api/geo  (free, no rate-limit, most reliable)
 *  4. ipapi.co fallback                (external, rate-limited, backup only)
 *  5. Hard default "LB"
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
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 3000);
    const res  = await fetch("/api/geo", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) {
      const { country } = await res.json();
      if (country) {
        const detected: Region = country === "EG" ? "EG" : "LB";
        _setRegion(detected);
        return detected;
      }
    }
  } catch { /* network error / timeout — try next fallback */ }

  // ── 4. ipapi.co fallback ──
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 3000);
    const res  = await fetch("https://ipapi.co/json/", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) {
      const data = await res.json();
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

/** Force-clear cache (e.g. on logout) */
export function clearRegionCache() {
  _memCache = null;
  Cookies.remove("user_region");
}

function _setRegion(r: Region) {
  _memCache = r;
  Cookies.set("user_region", r, { expires: 7 });
}
