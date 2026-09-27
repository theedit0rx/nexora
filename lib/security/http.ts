import { z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function readJson(req: Request): Promise<unknown> {
  const limit = 256 * 1024;
  if (Number(req.headers.get("content-length")) > limit) throw new HttpError(413, "Request too large");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "JSON body required");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, "Request too large"); }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new HttpError(400, "Invalid JSON"); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "JSON object required");
    return value;
  } finally { reader.releaseLock(); }
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const result = schema.safeParse(await readJson(req));
  if (!result.success) throw new HttpError(400, result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; "));
  return result.data;
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(req.url).origin)) {
    throw new HttpError(403, "Cross-site request blocked");
  }
}

export const LoginInput = z.object({
  email: z.string().trim().email().max(254), password: z.string().min(1).max(1024),
  next: z.string().max(512).optional(),
});
export const SignupInput = z.object({
  email: z.string().trim().email().max(254), password: z.string().min(12).max(1024),
  fullName: z.string().trim().min(1).max(120), organizationName: z.string().trim().min(1).max(120),
});
export function safeNext(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value) ? value : "/dashboard";
}

// Process-local protection; multi-instance production must also rate-limit at the gateway.
const attempts = new Map<string, { count: number; until: number }>();
export function limitAuth(account: string, now = Date.now()) {
  for (const [key, v] of attempts) if (v.until <= now) attempts.delete(key);
  const key = account.toLowerCase();
  const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 };
  if (++entry.count > 10 || attempts.size >= 10000) throw new HttpError(429, "Too many attempts. Try again in a minute.");
  attempts.set(key, entry);
}
