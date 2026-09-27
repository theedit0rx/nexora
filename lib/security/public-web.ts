import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export function isPublicAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (isIP(ip) === 6) {
    // Only global unicast; reject mapped IPv4, local, multicast and documentation addresses.
    return /^[23][0-9a-f]{0,3}:/.test(ip) && !ip.startsWith("2001:db8:") && !ip.startsWith("2002:");
  }
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function validatePublicUrl(input: string): URL {
  const url = new URL(input);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port))) throw new Error("Unsupported website URL");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(".") && !isIP(host)) throw new Error("Public website required");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      (isIP(host) && !isPublicAddress(host))) throw new Error("Private network access blocked");
  return url;
}

/** Resolve once, validate every address, then pin the socket to the validated IP. */
export async function fetchPublicPage(input: string, options: { method?: "GET" | "HEAD"; timeoutMs?: number; maxBytes?: number } = {}) {
  const deadline = Date.now() + (options.timeoutMs ?? 8000);
  const maxBytes = options.maxBytes ?? 400_000;
  let url = validatePublicUrl(input);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) throw new Error("Private network access blocked");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Website request timed out");
    const pinned = addresses[0];
    const result = await new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
      const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
        method: options.method ?? "GET",
        family: pinned.family,
        headers: { "user-agent": "NEXORA-AuditBot/1.0", accept: "text/html,application/xhtml+xml" },
        lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.destroy(); resolve({ status, location: res.headers.location, html: "" }); return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) { res.destroy(new Error("Website response exceeds byte limit")); return; }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      });
      const timer = setTimeout(() => req.destroy(new Error("Website request timed out")), remaining);
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    });
    if (result.location) { url = validatePublicUrl(new URL(result.location, url).href); continue; }
    return { ...result, url: url.href, ok: result.status >= 200 && result.status < 300 };
  }
  throw new Error("Too many website redirects");
}
