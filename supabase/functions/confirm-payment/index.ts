// Permanently disabled. This endpoint must never grant entitlement, coins or
// orders: Paymob fulfilment may only come from a verified provider webhook.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  console.warn("Legacy confirm-payment endpoint disabled");

  return new Response(
    JSON.stringify({ error: "legacy_paymob_confirmation_disabled" }),
    { status: 410, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
