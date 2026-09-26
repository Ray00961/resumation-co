// Anthropic Messages API call for the generation worker.
//
// One request per call: no retries here. Every failure throws a short,
// content-free Error whose message is a fixed code; the caller turns it into a
// StageError and fail_generation_job decides whether the job is retried.
//
// Thrown errors and logs never contain the API key, the prompt, the response
// body or any model-generated text.
//
//   model_status_<NNN>     non-2xx HTTP response (body is never read)
//   model_bad_response     2xx body that is not a JSON object
//   model_stop_<reason>    stop_reason other than "end_turn"
//   model_empty_response   no text content
//   AbortError             timeout (req.timeoutMs)

import type { ChatRequest } from "./worker.ts";

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

export type UsageLog = (e: Record<string, string | number | null>) => void;

export interface AnthropicChatDeps {
  apiKey: string;
  fetch: typeof fetch;
  log: UsageLog;
}

/** A stop_reason is an API enum; anything else is reported as "unknown". */
function safeReason(v: unknown): string {
  return typeof v === "string" && /^[a-z_]{1,32}$/.test(v) ? v : "unknown";
}

function tokenCount(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function createAnthropicChat(deps: AnthropicChatDeps): (req: ChatRequest) => Promise<string> {
  return async (req: ChatRequest): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const res = await deps.fetch(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "x-api-key": deps.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
          thinking: { type: "disabled" },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        await res.body?.cancel();          // the body may echo input; never read it
        throw new Error(`model_status_${res.status}`);
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw e;
        // JSON.parse messages quote the body; never propagate them.
        throw new Error("model_bad_response");
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("model_bad_response");
      }
      const msg = data as Record<string, unknown>;
      const stopReason = safeReason(msg.stop_reason);
      const usage = (msg.usage && typeof msg.usage === "object" ? msg.usage : {}) as Record<string, unknown>;
      deps.log({
        event: "model_usage", provider: "anthropic", model: req.model,
        input_tokens: tokenCount(usage.input_tokens), output_tokens: tokenCount(usage.output_tokens),
        stop_reason: stopReason,
      });

      if (stopReason !== "end_turn") throw new Error(`model_stop_${stopReason}`);

      if (!Array.isArray(msg.content)) throw new Error("model_empty_response");
      // Only text blocks carry the answer; thinking/redacted_thinking are ignored.
      const text = msg.content
        .filter((b): b is { type: "text"; text: string } =>
          !!b && typeof b === "object" && (b as Record<string, unknown>).type === "text" &&
          typeof (b as Record<string, unknown>).text === "string")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new Error("model_empty_response");
      return text;
    } finally {
      clearTimeout(timer);
    }
  };
}
