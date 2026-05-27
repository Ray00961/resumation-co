/**
 * Vercel Edge Function — /api/geo
 *
 * Reads geo headers injected by Vercel's edge network at zero cost / zero
 * rate-limit. Deployed as an Edge Function (not Node.js Serverless) for
 * near-instant cold starts and sub-10ms P99 response times.
 *
 * Key fix: Vercel returns x-vercel-ip-country-region = "BA" (ISO 3166-2:LB
 * sub-national code for the Beirut Governorate) for users in Lebanon.
 * Our payment routing layer (create-cv-order) expects the canonical country
 * code "LB", so we override `region` to "LB" whenever `country === "LB"`.
 */

export const config = { runtime: "edge" };

export default function handler(req: Request): Response {
  // Vercel injects these headers on every request at the edge — no external
  // network call needed, so the function is pure synchronous header reads.
  const country = req.headers.get("x-vercel-ip-country")        || "LB";
  let   region  = req.headers.get("x-vercel-ip-country-region") || "LB";
  const city    = req.headers.get("x-vercel-ip-city")           || "Beirut";

  // ── Region sanitization ────────────────────────────────────────────────
  // Vercel emits the ISO 3166-2 sub-national code (e.g. "BA" = Beirut
  // Governorate, "JB" = South Lebanon) instead of the country code "LB".
  // Payment routing only cares about country-level — normalize to "LB".
  if (country === "LB") {
    region = "LB";
  }

  return new Response(
    JSON.stringify({ country, region, city }),
    {
      status: 200,
      headers: {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "*",
        // Cache at the browser and CDN for 1 hour — geo data is stable.
        // detectRegion.ts also has its own memory + cookie cache layers,
        // so in practice /api/geo is only called once per 7-day cookie TTL.
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
