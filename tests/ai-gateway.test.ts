import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { classifySalesIntent } from "@/lib/ai/sales-intent";
import { listProviders } from "@/lib/ai";
const ai = { provider: "gateway", model: "local-deterministic", temperature: 0, maxTokens: 512, fallbackToLocal: true };
const fallback = () => ({ intent: "UNKNOWN" as const, confidence: 0.3 });
beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  vi.stubEnv("AI_GATEWAY_BASE_URL", "https://gateway.example/v1/");
  vi.stubEnv("AI_GATEWAY_MODEL", "sales-model");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("calls the configured endpoint, validates intent and records usage", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"intent":"PRICE_QUERY","confidence":0.95}' } }], usage: { prompt_tokens: 40, completion_tokens: 20 } })));
  vi.stubGlobal("fetch", fetchMock);
  const result = await classifySalesIntent("What does this cost?", ai, fallback);
  expect(result.data.intent).toBe("PRICE_QUERY"); expect(result.fromFallback).toBe(false);
  expect(result.usage.tokensIn).toBe(40);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://gateway.example/v1/chat/completions");
  expect(JSON.parse(options.body).model).toBe("sales-model");
  expect(options.redirect).toBe("error"); expect(options.signal).toBeInstanceOf(AbortSignal);
});
it("reports invalid model output as fallback or fails when fallback is disabled", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"intent":"INVENTED","confidence":2}' } }] }))));
  expect((await classifySalesIntent("hello", ai, fallback)).fromFallback).toBe(true);
  await expect(classifySalesIntent("hello", { ...ai, fallbackToLocal: false }, fallback)).rejects.toThrow();
});
it("preserves an opt-out without making an AI call", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const result = await classifySalesIntent("stop", ai, () => ({ intent: "NOT_INTERESTED", confidence: 0.9 }));
  expect(result.data.intent).toBe("NOT_INTERESTED"); expect(fetchMock).not.toHaveBeenCalled();
});
it("does not show missing gateway credentials as connected", () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
  expect(listProviders().find((p) => p.key === "gateway")?.available).toBe(false);
});
