// Canonical payment order id from a /success return URL.
//
// create-payment sends the buyer back to /success?payment_order=<UUID>. Paymob
// adds its own redirect parameters and REPLACES any `order` parameter with its
// numeric order id, which is why our id travels as `payment_order`.
//
// The returned id is only a lookup key for the owner's RLS-protected
// payment_orders read; it proves nothing. Paymob's numeric order id and its
// success/pending/amount/currency/hmac parameters are never used here.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const firstUuid = (values: string[]): string =>
  values.map((v) => v.trim()).find((v) => UUID_RE.test(v)) ?? "";

/**
 * 1. `payment_order` — when present, it is the only source: a UUID or nothing.
 *    An invalid value never falls through to `order`.
 * 2. Otherwise the legacy `order` parameter, UUID-shaped values only, for
 *    checkout URLs created before `payment_order` existed.
 * Returns "" when no canonical id is present.
 */
export function resolveCanonicalOrderId(params: URLSearchParams): string {
  if (params.has("payment_order")) {
    return firstUuid(params.getAll("payment_order"));
  }
  return firstUuid(params.getAll("order"));
}
