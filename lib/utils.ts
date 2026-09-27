import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------ formatting -- */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function money(amount: number, currency = "INR") {
  if (currency === "USD") return USD.format(amount);
  return INR.format(amount);
}

export function compactMoney(amount: number, currency = "INR") {
  const symbol = currency === "USD" ? "$" : "₹";
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${symbol}${(amount / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${symbol}${(amount / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${symbol}${(amount / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${symbol}${Math.round(amount)}`;
}

export function num(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function pct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function percent(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

export function relative(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function relativeStrict(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM yyyy");
  } catch {
    return "—";
  }
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM, HH:mm");
  } catch {
    return "—";
  }
}

export function timeOfDay(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "HH:mm:ss");
  } catch {
    return "—";
  }
}

export function duration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function truncate(s: string, n = 80) {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).trimEnd()}…`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function titleCase(s: string) {
  return s
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K) {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

export function sum(items: number[]) {
  return items.reduce((a, b) => a + b, 0);
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Safe JSON stringify for logging into the store. */
export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '""';
  }
}

export function hostOf(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
