// Offline tests for the Anthropic Messages call. fetch is injected; no network.
//
//   deno test --allow-read --allow-env --allow-net=esm.sh --no-check=remote supabase/functions/generation-worker/anthropic.test.ts

import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ANTHROPIC_MESSAGES_URL, createAnthropicChat } from "./anthropic.ts";
import { CL_MODEL, CV_MODEL, type ChatRequest } from "./worker.ts";

const KEY = "sk-ant-test-" + "k".repeat(40);
const SYSTEM = "SYSTEM-PROMPT-MARKER with candidate data";
const USER = "USER-MESSAGE-MARKER";
const MODEL_TEXT = "MODEL-OUTPUT-MARKER";

const REQ: ChatRequest = { ...CV_MODEL, system: SYSTEM, user: USER };

interface Call { url: string; init: RequestInit }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function message(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5",
    content: [{ type: "text", text: MODEL_TEXT }],
    stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 1234, output_tokens: 567 },
    ...over,
  };
}

function setup(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const logs: Record<string, unknown>[] = [];
  const chat = createAnthropicChat({
    apiKey: KEY,
    fetch: async (input, init) => {
      const call = { url: String(input), init: init ?? {} };
      calls.push(call);
      return await respond(call);
    },
    log: (e) => logs.push(e),
  });
  return { chat, calls, logs };
}

async function errorOf(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    assert(e instanceof Error);
    return e;
  }
  throw new Error("expected a rejection");
}

/** Nothing sensitive may appear in a thrown error or in the logs. */
function assertClean(what: unknown) {
  const s = JSON.stringify(what, Object.getOwnPropertyNames(what ?? {}));
  for (const t of [KEY, SYSTEM, USER, MODEL_TEXT, "RESPONSE-BODY-MARKER"]) {
    assert(!s.includes(t), `leaked ${t.slice(0, 14)}`);
  }
}

Deno.test("request: endpoint, headers, top-level system, one user message, thinking disabled, no temperature", async () => {
  const { chat, calls } = setup(() => jsonResponse(message()));
  assertEquals(await chat(REQ), MODEL_TEXT);
  assertEquals(calls.length, 1, "exactly one request, no retry");
  const { url, init } = calls[0];
  assertEquals(url, ANTHROPIC_MESSAGES_URL);
  assertEquals(url, "https://api.anthropic.com/v1/messages");
  assertEquals(init.method, "POST");
  assertEquals(init.headers, {
    "x-api-key": KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  });
  assert(init.signal instanceof AbortSignal);
  const body = JSON.parse(String(init.body));
  assertEquals(body, {
    model: "claude-sonnet-5",
    max_tokens: CV_MODEL.maxTokens,
    system: SYSTEM,
    messages: [{ role: "user", content: USER }],
    thinking: { type: "disabled" },
  });
  for (const k of ["temperature", "top_p", "top_k"]) assert(!(k in body), `${k} must not be sent`);
  assert(body.messages.every((m: { role: string }) => m.role === "user"), "no assistant prefill");
});

Deno.test("request: model and max_tokens come from the ChatRequest (CV 8192 / CL 4096)", async () => {
  const { chat, calls } = setup(() => jsonResponse(message()));
  await chat({ ...CL_MODEL, system: SYSTEM, user: USER });
  const body = JSON.parse(String(calls[0].init.body));
  assertEquals([CV_MODEL.model, CL_MODEL.model], ["claude-sonnet-5", "claude-sonnet-5"]);
  assertEquals([CV_MODEL.maxTokens, CL_MODEL.maxTokens, CV_MODEL.timeoutMs, CL_MODEL.timeoutMs], [8192, 4096, 180_000, 120_000]);
  assertEquals(body.max_tokens, 4096);
  assertEquals(body.model, "claude-sonnet-5");
});

Deno.test("response: text blocks joined in order; thinking / redacted_thinking / other blocks ignored", async () => {
  const { chat } = setup(() => jsonResponse(message({
    content: [
      { type: "thinking", thinking: "THINKING-MARKER", signature: "sig" },
      { type: "text", text: '{"a":' },
      { type: "redacted_thinking", data: "opaque" },
      { type: "text", text: "1}" },
      { type: "unknown_future_block", text: "IGNORED" },
    ],
  })));
  assertEquals(await chat(REQ), '{"a":1}');
});

Deno.test("response: stop_reason max_tokens / refusal / other → model_stop_<reason>", async () => {
  for (const [reason, expected] of [
    ["max_tokens", "model_stop_max_tokens"],
    ["refusal", "model_stop_refusal"],
    ["pause_turn", "model_stop_pause_turn"],
    ["stop_sequence", "model_stop_stop_sequence"],
    ["tool_use", "model_stop_tool_use"],
    [null, "model_stop_unknown"],
    ["Weird Reason! " + MODEL_TEXT, "model_stop_unknown"],
  ] as const) {
    const { chat, logs } = setup(() => jsonResponse(message({ stop_reason: reason })));
    const e = await errorOf(chat(REQ));
    assertEquals(e.message, expected);
    assertClean(e);
    assertClean(logs);
  }
});

Deno.test("response: missing / non-array / textless / blank content → model_empty_response", async () => {
  const contents: unknown[] = [
    undefined, null, "text", {},
    [],
    [{ type: "thinking", thinking: "only thinking" }],
    [{ type: "text", text: "   \n " }],
    [{ type: "text", text: 42 }],
    [null, 7],
  ];
  for (const content of contents) {
    const { chat } = setup(() => jsonResponse(message({ content })));
    const e = await errorOf(chat(REQ));
    assertEquals(e.message, "model_empty_response", JSON.stringify(content));
  }
});

Deno.test("response: non-JSON or non-object body → model_bad_response, body never echoed", async () => {
  for (const raw of ["RESPONSE-BODY-MARKER not json", "[1,2]", "null", "\"a string\""]) {
    const { chat } = setup(() => new Response(raw, { status: 200 }));
    const e = await errorOf(chat(REQ));
    assertEquals(e.message, "model_bad_response", raw);
    assertClean(e);
  }
});

Deno.test("HTTP 400/401/403/404/413/429/500/529 → model_status_<code>; body is never read", async () => {
  for (const status of [400, 401, 403, 404, 413, 429, 500, 529]) {
    let bodyRead = false;
    let cancelled = false;
    // highWaterMark 0: pull() runs only when a reader actually asks for data.
    const body = new ReadableStream({
      pull(c) { bodyRead = true; c.enqueue(new TextEncoder().encode("RESPONSE-BODY-MARKER")); c.close(); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const { chat, calls, logs } = setup(() => new Response(body, { status }));
    const e = await errorOf(chat(REQ));
    assertEquals(e.message, `model_status_${status}`);
    assertEquals(calls.length, 1, "no retry inside chat()");
    assert(!bodyRead, `body read for ${status}`);
    assert(cancelled, `body not released for ${status}`);
    assertEquals(logs.length, 0, "no usage log for a failed request");
    assertClean(e);
  }
});

Deno.test("timeout: request aborted after timeoutMs with AbortError; timer cleared", async () => {
  const { chat } = setup(({ init }) =>
    new Promise<Response>((_, reject) => {
      init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
  const started = Date.now();
  const e = await errorOf(chat({ ...REQ, timeoutMs: 30 }));
  assertEquals(e.name, "AbortError");
  assert(Date.now() - started < 5_000);
  // A successful call must not leave a timer behind (Deno's leak sanitizer
  // fails this test if the 180s timer were still pending).
  const ok = setup(() => jsonResponse(message()));
  assertEquals(await ok.chat(REQ), MODEL_TEXT);
});

Deno.test("timeout also covers a stalled response body", async () => {
  const { chat } = setup(({ init }) => {
    const body = new ReadableStream({
      start(c) { init.signal!.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError"))); },
    });
    return new Response(body, { status: 200 });
  });
  await assertRejects(() => chat({ ...REQ, timeoutMs: 30 }), DOMException);
});

Deno.test("usage log: provider, model, token counts, stop_reason only — no key, prompt or output", async () => {
  const { chat, logs } = setup(() => jsonResponse(message()));
  await chat(REQ);
  assertEquals(logs, [{
    event: "model_usage", provider: "anthropic", model: "claude-sonnet-5",
    input_tokens: 1234, output_tokens: 567, stop_reason: "end_turn",
  }]);
  assertClean(logs);

  const noUsage = setup(() => jsonResponse(message({ usage: undefined, stop_reason: "max_tokens" })));
  await errorOf(noUsage.chat(REQ));
  assertEquals(noUsage.logs[0].input_tokens, null);
  assertEquals(noUsage.logs[0].stop_reason, "max_tokens", "truncated calls are still logged");
});
