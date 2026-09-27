"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { ONBOARDING_FIELD_LIST } from "@/lib/onboarding-fields";

const LIST_KEYS = new Set([
  "brandColors",
  "services",
  "images",
  "preferredFeatures",
  "inspiration",
  "socialUrls",
]);
const URL_KEYS = new Set(["logoUrl", "domain"]);
const EMAIL_KEYS = new Set(["email"]);

const PLACEHOLDERS: Record<string, string> = {
  companyName: "Sharma Interiors",
  logoUrl: "https://…/logo.png",
  brandColors: "One hex value per line",
  businessDescription: "A short paragraph about the business",
  services: "One service per line",
  socialUrls: "https://instagram.com/…",
  phone: "+91 …",
  email: "owner@business.com",
  address: "Street, city, PIN",
  images: "One image URL per line",
  productInfo: "Products or services to feature",
  preferredFeatures: "One feature per line",
  inspiration: "One URL per line",
  domain: "example.com",
};

/** The client onboarding form. Mirrors the fields the Onboarding agent collects. */
export function ClientOnboarding({
  clientId,
  submissionId,
  initialData,
  missing,
  locked,
}: {
  clientId: string;
  submissionId: string;
  initialData: Record<string, unknown>;
  missing: string[];
  locked: boolean;
}) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function setValue(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, data }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; submission?: { completion: number } };
      if (!res.ok || json.error) {
        setMessage(json.error ?? "Could not save the submission");
        return;
      }
      setMessage(`Saved — ${json.submission?.completion ?? 0}% complete.`);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const outstanding = new Set(missing);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {ONBOARDING_FIELD_LIST.map((field) => {
          const value = data[field.key];
          const isMissing = outstanding.has(field.label);
          const isList = LIST_KEYS.has(field.key);
          if (isList) {
            return (
              <label key={field.key} className={isList ? "block sm:col-span-2" : "block"}>
                <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  {field.label}
                  {isMissing && <span className="text-amber-400">· required</span>}
                </span>
                <Textarea
                  value={Array.isArray(value) ? value.join("\n") : String(value ?? "")}
                  onChange={(e) =>
                    setValue(
                      field.key,
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  rows={3}
                  disabled={locked}
                  placeholder="One item per line"
                />
              </label>
            );
          }
          return (
            <label key={field.key} className={isList ? "block sm:col-span-2" : "block"}>
              <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                {field.label}
                {isMissing && <span className="text-amber-400">· required</span>}
              </span>
              <input
                type={URL_KEYS.has(field.key) ? "url" : EMAIL_KEYS.has(field.key) ? "email" : "text"}
                value={String(value ?? "")}
                onChange={(e) => setValue(field.key, e.target.value)}
                disabled={locked}
        placeholder={PLACEHOLDERS[field.key] ?? ""}
                className="h-9 w-full rounded-lg border border-line bg-surface-2/60 px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
              />
            </label>
          );
        })}
      </div>

      {message && <p className="text-[11.5px] text-emerald-300">{message}</p>}

      {!locked && (
        <div className="flex justify-end">
          <Button size="sm" loading={busy} onClick={save}>
            {busy ? <Loader2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            Save onboarding data
          </Button>
        </div>
      )}
      {locked && (
        <p className="text-[11.5px] text-emerald-300">
          Onboarding is complete. The production build can start.
        </p>
      )}
    </div>
  );
}
