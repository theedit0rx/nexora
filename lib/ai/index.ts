import { z } from "zod";

/* ==========================================================================
   NEXORA — AI Provider Abstraction
   --------------------------------------------------------------------------
   Agents never talk to a model directly. They call `generateStructured`,
   which routes to whichever provider is configured:
     local | openai | anthropic | google | openrouter | gateway
   Every provider must return JSON that validates against the caller's Zod
   schema. If no provider is configured (or a call fails), NEXORA falls back
   to its deterministic engine so the pipeline never silently stops.
   ========================================================================== */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  system?: string;
  messages?: ChatMessage[];
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Model override; defaults to the provider's configured model. */
  model?: string;
  signal?: AbortSignal;
}

export interface TokenUsage {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface StructuredResult<T> {
  data: T;
  provider: string;
  model: string;
  usage: TokenUsage;
  fromFallback: boolean;
  error?: string;
}

export interface AIProvider {
  readonly key: string;
  readonly model: string;
  readonly available: boolean;
  generate(options: GenerateOptions): Promise<{ text: string; usage: TokenUsage }>;
}

/* ---------------------------------------------------------------- helpers -- */

const JSON_INSTRUCTION =
  "Respond with a single valid JSON object. No markdown, no commentary, no code fences.";

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const open = cleaned[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  return JSON.parse(cleaned.slice(start));
}

/** Rough cost estimate; real accounting is wired to provider usage where available. */
function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const table: Record<string, [number, number]> = {
    "gpt-4o": [2.5, 10],
    "gpt-4o-mini": [0.15, 0.6],
    "gpt-4.1-mini": [0.4, 1.6],
    "claude-3-5-sonnet-latest": [3, 15],
    "claude-3-5-haiku-latest": [0.8, 4],
    "gemini-1.5-flash": [0.075, 0.3],
    "gemini-1.5-pro": [1.25, 5],
    "local-deterministic": [0, 0],
  };
  const rates = table[model] ?? [0.5, 1.5];
  return (tokensIn / 1e6) * rates[0] + (tokensOut / 1e6) * rates[1];
}

/* -------------------------------------------------------------- providers -- */

abstract class HttpProvider implements AIProvider {
  readonly key: string = "http";
  model: string;
  readonly available = true;
  protected apiKey: string;
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model ?? "unknown";
  }

  protected abstract buildRequest(options: GenerateOptions): {
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };

  protected abstract parseResponse(json: unknown): { text: string; tokensIn: number; tokensOut: number };

  async generate(options: GenerateOptions): Promise<{ text: string; usage: TokenUsage }> {
    const req = this.buildRequest(options);
    const res = await fetch(req.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...req.headers },
      body: JSON.stringify(req.body),
      signal: options.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${this.key} API ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as unknown;
    const parsed = this.parseResponse(json);
    return {
      text: parsed.text,
      usage: {
        tokensIn: parsed.tokensIn,
        tokensOut: parsed.tokensOut,
        costUsd: estimateCost(this.model, parsed.tokensIn, parsed.tokensOut),
      },
    };
  }
}

class OpenAIProvider extends HttpProvider {
  override readonly key: string = "openai";
  constructor(apiKey: string, model: string, baseUrl = "https://api.openai.com/v1") {
    super(apiKey, baseUrl, model);
  }
  protected buildRequest(options: GenerateOptions) {
    const messages: ChatMessage[] = [
      { role: "system", content: `${options.system ?? ""}\n\n${JSON_INSTRUCTION}`.trim() },
      ...(options.messages ?? []),
      ...(options.prompt ? [{ role: "user" as const, content: options.prompt }] : []),
    ];
    return {
      url: `${this.baseUrl}/chat/completions`,
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: {
        model: options.model ?? this.model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 2048,
        response_format: { type: "json_object" },
      },
    };
  }
  protected parseResponse(json: unknown) {
    const j = json as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: j.choices?.[0]?.message?.content ?? "",
      tokensIn: j.usage?.prompt_tokens ?? 0,
      tokensOut: j.usage?.completion_tokens ?? 0,
    };
  }
}

class OpenRouterProvider extends OpenAIProvider {
  override readonly key: string = "openrouter";
  constructor(apiKey: string, model: string) {
    super(apiKey, model, "https://openrouter.ai/api/v1");
  }
  protected buildRequest(options: GenerateOptions) {
    const req = super.buildRequest(options);
    return {
      ...req,
      headers: { ...req.headers, authorization: `Bearer ${this.apiKey}` },
    };
  }
}

class GatewayProvider extends OpenAIProvider {
  override readonly key: string = "gateway";
  constructor(apiKey: string, model: string) {
    super(apiKey, model, process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1");
  }
}

class AnthropicProvider extends HttpProvider {
  override readonly key: string = "anthropic";
  constructor(apiKey: string, model: string) {
    super(apiKey, "https://api.anthropic.com/v1", model);
  }
  protected buildRequest(options: GenerateOptions) {
    const messages: ChatMessage[] = [
      ...(options.messages ?? []),
      ...(options.prompt ? [{ role: "user" as const, content: options.prompt }] : []),
    ];
    return {
      url: `${this.baseUrl}/messages`,
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: options.model ?? this.model,
        system: `${options.system ?? ""}\n\n${JSON_INSTRUCTION}`.trim(),
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 2048,
      },
    };
  }
  protected parseResponse(json: unknown) {
    const j = json as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      text: j.content?.filter((c) => c.type === "text").map((c) => c.text).join("") ?? "",
      tokensIn: j.usage?.input_tokens ?? 0,
      tokensOut: j.usage?.output_tokens ?? 0,
    };
  }
}

class GoogleProvider extends HttpProvider {
  override readonly key: string = "google";
  constructor(apiKey: string, model: string) {
    super(apiKey, "https://generativelanguage.googleapis.com/v1beta", model);
  }
  protected buildRequest(options: GenerateOptions) {
    const parts = [
      { text: `${options.system ?? ""}\n\n${JSON_INSTRUCTION}`.trim() },
      ...(options.messages ?? []).map((m) => ({ text: m.content })),
      ...(options.prompt ? [{ text: options.prompt }] : []),
    ];
    return {
      url: `${this.baseUrl}/models/${options.model ?? this.model}:generateContent?key=${this.apiKey}`,
      headers: {},
      body: {
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxTokens ?? 2048,
          responseMimeType: "application/json",
        },
      },
    };
  }
  protected parseResponse(json: unknown) {
    const j = json as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    return {
      text: j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "",
      tokensIn: j.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: j.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}

/**
 * Deterministic local provider.
 * Used in Demo Mode and whenever no external key is configured. It does not
 * fabricate research — it signals `fromFallback: true` so the caller's
 * deterministic engine (which is derived from real signals) produces output.
 */
class LocalProvider implements AIProvider {
  readonly key = "local";
  readonly model = "local-deterministic";
  readonly available = true;
  async generate(): Promise<{ text: string; usage: TokenUsage }> {
    return {
      text: "{}",
      usage: { tokensIn: 0, tokensOut: 0, costUsd: 0 },
    };
  }
}

/* -------------------------------------------------------------- registry --- */

const cache = new Map<string, AIProvider>();

export function getProvider(key: string, model?: string): AIProvider {
  const cacheKey = `${key}:${model ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  let provider: AIProvider;
  switch (key) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      provider = apiKey
        ? new OpenAIProvider(apiKey, model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini")
        : new LocalProvider();
      break;
    }
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      provider = apiKey
        ? new AnthropicProvider(apiKey, model ?? process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest")
        : new LocalProvider();
      break;
    }
    case "google": {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      provider = apiKey
        ? new GoogleProvider(apiKey, model ?? process.env.GOOGLE_MODEL ?? "gemini-1.5-flash")
        : new LocalProvider();
      break;
    }
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      provider = apiKey
        ? new OpenRouterProvider(apiKey, model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.1-70b-instruct")
        : new LocalProvider();
      break;
    }
    case "gateway": {
      const apiKey = process.env.AI_GATEWAY_API_KEY;
      provider = apiKey ? new GatewayProvider(apiKey, model ?? "gpt-4o-mini") : new LocalProvider();
      break;
    }
    default:
      provider = new LocalProvider();
  }
  cache.set(cacheKey, provider);
  return provider;
}

export interface ProviderStatus {
  key: string;
  label: string;
  available: boolean;
  model: string;
  envVars: string[];
}

export function listProviders(): ProviderStatus[] {
  const defs: Array<{ key: string; label: string; envVars: string[] }> = [
    { key: "local", label: "NEXORA Deterministic Engine", envVars: [] },
    { key: "openai", label: "OpenAI", envVars: ["OPENAI_API_KEY"] },
    { key: "anthropic", label: "Anthropic", envVars: ["ANTHROPIC_API_KEY"] },
    { key: "google", label: "Google Gemini", envVars: ["GOOGLE_GENERATIVE_AI_API_KEY"] },
    { key: "openrouter", label: "OpenRouter", envVars: ["OPENROUTER_API_KEY"] },
    { key: "gateway", label: "AI Gateway", envVars: ["AI_GATEWAY_API_KEY"] },
  ];
  return defs.map((d) => {
    const provider = getProvider(d.key);
    return {
      key: d.key,
      label: d.label,
      available: provider.available && provider.key !== "local" ? hasAnyEnv(d.envVars) : provider.key === "local",
      model: provider.model,
      envVars: d.envVars,
    };
  });
}

function hasAnyEnv(vars: string[]) {
  return vars.some((v) => Boolean(process.env[v]));
}

/* --------------------------------------------------------- generate call -- */

export interface StructuredOptions<T extends z.ZodType> {
  schema: T;
  system: string;
  prompt: string;
  /** Deterministic result used when no provider is configured or a call fails. */
  fallback: () => z.infer<T>;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Skip the model entirely and use the deterministic engine. */
  offline?: boolean;
}

export async function generateStructured<T extends z.ZodType>(
  opts: StructuredOptions<T>,
): Promise<StructuredResult<z.infer<T>>> {
  const key = opts.provider ?? "local";
  const provider = getProvider(key, opts.model);

  if (opts.offline || provider.key === "local") {
    return {
      data: opts.fallback(),
      provider: "local",
      model: "local-deterministic",
      usage: { tokensIn: 0, tokensOut: 0, costUsd: 0 },
      fromFallback: true,
    };
  }

  try {
    const { text, usage } = await provider.generate({
      system: opts.system,
      prompt: opts.prompt,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });
    const parsed = extractJson(text);
    const validated = opts.schema.safeParse(parsed);
    if (!validated.success) {
      return {
        data: opts.fallback(),
        provider: provider.key,
        model: provider.model,
        usage,
        fromFallback: true,
        error: `Schema validation failed: ${validated.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      };
    }
    return {
      data: validated.data,
      provider: provider.key,
      model: provider.model,
      usage,
      fromFallback: false,
    };
  } catch (err) {
    return {
      data: opts.fallback(),
      provider: provider.key,
      model: provider.model,
      usage: { tokensIn: 0, tokensOut: 0, costUsd: 0 },
      fromFallback: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
