"use client";

import { useState } from "react";
import { Check, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, Modal, Switch, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export type SettingsShape = {
  automation: Record<string, boolean>;
  permissions: Record<string, boolean>;
  outreach: Record<string, unknown>;
  leadSources: Record<string, unknown>;
  ai: Record<string, unknown>;
  company: Record<string, string>;
  autonomy: Record<string, unknown>;
  notifications: Record<string, boolean>;
};

const AUTOMATION_LABELS: Record<string, { label: string; help: string; risk?: string }> = {
  leadDiscovery: { label: "Automatic lead discovery", help: "Scout searches for new prospects on a schedule." },
  automaticResearch: { label: "Automatic research", help: "Researches every newly discovered lead." },
  automaticAudit: { label: "Automatic website audit", help: "Audits the prospect's website right after research." },
  automaticScoring: { label: "Automatic scoring", help: "Scores and prioritises the lead." },
  automaticDemoCreation: { label: "Automatic demo creation", help: "Builds a demo site without asking first.", risk: "consumes compute" },
  automaticQa: { label: "Automatic QA", help: "Runs the QA suite after every build." },
  automaticPreviewDeployment: { label: "Automatic preview deployment", help: "Deploys passing demos to a preview URL." },
  automaticOutreachDraft: { label: "Automatic outreach drafting", help: "Writes the first message for your review." },
  automaticOutreachSending: { label: "Automatic outreach sending", help: "Sends outreach without approval.", risk: "external action" },
  automaticFollowUp: { label: "Automatic follow-ups", help: "Sends scheduled follow-ups.", risk: "external action" },
  automaticReplySuggestions: { label: "Automatic reply suggestions", help: "Suggests replies to inbound messages." },
  automaticProposalDrafts: { label: "Automatic proposal drafts", help: "Drafts proposals when intent is positive." },
  automaticMinorMaintenance: { label: "Automatic minor maintenance", help: "Applies small content fixes to live sites.", risk: "modifies live site" },
};

const PERMISSION_LABELS: Record<string, { label: string; help: string }> = {
  allowAutoOutreach: { label: "Send outreach without approval", help: "Lets the Sales agent dispatch messages directly." },
  allowAutoReplies: { label: "Reply automatically", help: "Sends AI replies without your review." },
  allowAutoFollowUps: { label: "Send follow-ups automatically", help: "Applies the follow-up sequence without asking." },
  allowAutoMinorEdits: { label: "Apply minor edits to live sites", help: "Lets maintenance change production content." },
  allowAutoPreviewUpdates: { label: "Update preview deployments", help: "Safe — only affects preview URLs." },
};

const NOTIFICATION_LABELS: Record<string, string> = {
  hotLead: "Hot lead found",
  prospectReply: "Prospect replied",
  proposalRequested: "Proposal requested",
  approvalRequired: "Approval required",
  paymentEvent: "Payment received",
  buildCompleted: "Build completed",
  qaFailed: "QA failed",
  deploymentFailed: "Deployment failed",
  newClient: "New client",
  supportIssue: "Support issue",
};

const SECTIONS = [
  { key: "automation", label: "Automation" },
  { key: "permissions", label: "Permissions" },
  { key: "outreach", label: "Outreach" },
  { key: "lead-sources", label: "Lead sources" },
  { key: "ai", label: "AI provider" },
  { key: "company", label: "Company" },
  { key: "notifications", label: "Notifications" },
  { key: "integrations", label: "Integrations" },
  { key: "danger", label: "Danger zone" },
] as const;

export function SettingsForm({
  settings,
  integrations,
}: {
  settings: SettingsShape;
  integrations: Array<{ id: string; name: string; status: string; category: string; description: string }>;
}) {
  const [form, setForm] = useState<SettingsShape>(settings);
  const [section, setSection] = useState<string>("automation");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  function set(path: string, value: unknown) {
    setForm((prev) => {
      const next = structuredClone(prev) as Record<string, Record<string, unknown>>;
      next[path.split(".")[0]!]![path.split(".")[1]!] = value;
      return next as unknown as SettingsShape;
    });
  }

  function get(path: string): unknown {
    const [a, b] = path.split(".");
    return (form[a as keyof SettingsShape] as Record<string, unknown>)[b!];
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patch: form }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Could not save settings");
        return;
      }
      setSaved("Settings saved. Changes apply to the next agent run.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Reset failed");
        return;
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* ------------------------------------------------------- nav */}
      <nav className="panel h-fit p-1.5" aria-label="Settings sections">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            aria-current={section === s.key ? "true" : undefined}
            className={cn(
              "block w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors",
              section === s.key ? "bg-brand-500/12 font-medium text-ink-strong" : "text-ink-muted hover:bg-white/[0.03] hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        {/* ------------------------------------------------ automation */}
        {section === "automation" && (
          <Card>
            <CardTitle
              title="Automation"
              description="What NEXORA may do without asking. Everything off by default requires a manual run."
            />
            <div className="divide-y divide-line">
              {Object.entries(AUTOMATION_LABELS).map(([key, meta]) => (
                <Row
                  key={key}
                  label={meta.label}
                  help={meta.help}
                  risk={meta.risk}
                  control={
                    <Switch
                      checked={Boolean(get(`automation.${key}`))}
                      onChange={(v) => set(`automation.${key}`, v)}
                      aria-label={meta.label}
                    />
                  }
                />
              ))}
            </div>
          </Card>
        )}

        {/* ----------------------------------------------- permissions */}
        {section === "permissions" && (
          <Card>
            <CardTitle
              title="Permissions"
              description="Hard boundaries. Turning these on removes the approval step for the matching action."
            />
            <div className="divide-y divide-line">
              {Object.entries(PERMISSION_LABELS).map(([key, meta]) => (
                <Row
                  key={key}
                  label={meta.label}
                  help={meta.help}
                  risk={key !== "allowAutoPreviewUpdates" ? "removes approval" : undefined}
                  control={
                    <Switch
                      checked={Boolean(get(`permissions.${key}`))}
                      onChange={(v) => set(`permissions.${key}`, v)}
                      aria-label={meta.label}
                    />
                  }
                />
              ))}
            </div>
          </Card>
        )}

        {/* -------------------------------------------------- outreach */}
        {section === "outreach" && (
          <Card>
            <CardTitle title="Outreach" description="Sending cadence, limits and the signature appended to every message." />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <NumberField
                label="Daily send limit"
                value={Number(get("outreach.dailyLimit"))}
                onChange={(v) => set("outreach.dailyLimit", v)}
              />
              <NumberField
                label="Follow-up delay (days)"
                value={Number(get("outreach.followUpDelayDays"))}
                onChange={(v) => set("outreach.followUpDelayDays", v)}
              />
              <NumberField
                label="Maximum follow-ups"
                value={Number(get("outreach.maxFollowUps"))}
                onChange={(v) => set("outreach.maxFollowUps", v)}
              />
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Default channel
                </span>
                <select
                  value={String(get("outreach.defaultChannel"))}
                  onChange={(e) => set("outreach.defaultChannel", e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2/60 px-2.5 text-[13px] text-ink focus:border-brand-500/70 focus:outline-none"
                >
                  {["EMAIL", "WHATSAPP", "SMS", "MANUAL"].map((c) => (
                    <option key={c} value={c}>
                      {c.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <Row
                  label="Require approval before sending"
                  help="Every outreach message waits for your approval in the approval centre."
                  control={
                    <Switch
                      checked={Boolean(get("outreach.requireApproval"))}
                      onChange={(v) => set("outreach.requireApproval", v)}
                      aria-label="Require approval before sending"
                    />
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Signature"
                  value={String(get("outreach.signature") ?? "")}
                  onChange={(e) => set("outreach.signature", e.target.value)}
                  rows={3}
                  placeholder="Best regards, …"
                />
              </div>
            </div>
          </Card>
        )}

        {/* ---------------------------------------------- lead sources */}
        {section === "lead-sources" && (
          <Card>
            <CardTitle title="Lead sources" description="Where Scout is allowed to look for prospects." />
            <div className="divide-y divide-line">
              {[
                ["googlePlaces", "Google Places", "Local business listings."],
                ["webSearch", "Web search", "Broad web search results."],
                ["csvImport", "CSV import", "Upload a spreadsheet of prospects."],
                ["manual", "Manual entry", "Type a prospect in by hand."],
              ].map(([key, label, help]) => (
                <Row
                  key={key}
                  label={label}
                  help={help}
                  control={
                    <Switch
                      checked={Boolean(get(`leadSources.${key}`))}
                      onChange={(v) => set(`leadSources.${key}`, v)}
                      aria-label={label}
                    />
                  }
                />
              ))}
            </div>
            <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
              <ListField
                label="Default cities"
                values={(get("leadSources.defaultCities") as string[]) ?? []}
                onChange={(v) => set("leadSources.defaultCities", v)}
                placeholder="Lucknow"
              />
              <ListField
                label="Default categories"
                values={(get("leadSources.defaultCategories") as string[]) ?? []}
                onChange={(v) => set("leadSources.defaultCategories", v)}
                placeholder="Interior Designer"
              />
            </div>
          </Card>
        )}

        {/* -------------------------------------------------------- ai */}
        {section === "ai" && (
          <Card>
            <CardTitle title="AI provider" description="Which model powers the agents. The deterministic local engine always works." />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Provider</span>
                <select
                  value={String(get("ai.provider"))}
                  onChange={(e) => set("ai.provider", e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2/60 px-2.5 text-[13px] text-ink focus:border-brand-500/70 focus:outline-none"
                >
                  {["local", "openai", "anthropic", "groq", "gemini"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Model</span>
                <input
                  value={String(get("ai.model"))}
                  onChange={(e) => set("ai.model", e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2/60 px-2.5 text-[13px] text-ink focus:border-brand-500/70 focus:outline-none"
                />
              </label>
              <NumberField
                label="Temperature"
                step={0.1}
                value={Number(get("ai.temperature"))}
                onChange={(v) => set("ai.temperature", v)}
              />
              <NumberField
                label="Max tokens"
                value={Number(get("ai.maxTokens"))}
                onChange={(v) => set("ai.maxTokens", v)}
              />
              <div className="sm:col-span-2">
                <Row
                  label="Fall back to the local engine"
                  help="If the remote provider fails, agents continue with the deterministic engine instead of stopping."
                  control={
                    <Switch
                      checked={Boolean(get("ai.fallbackToLocal"))}
                      onChange={(v) => set("ai.fallbackToLocal", v)}
                      aria-label="Fall back to the local engine"
                    />
                  }
                />
              </div>
            </div>
          </Card>
        )}

        {/* --------------------------------------------------- company */}
        {section === "company" && (
          <Card>
            <CardTitle title="Company" description="Details used on proposals and outreach signatures." />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              {[
                ["agencyName", "Agency name"],
                ["ownerName", "Owner name"],
                ["website", "Website"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["gstin", "GSTIN"],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
                  <input
                    value={String(get(`company.${key}`) ?? "")}
                    onChange={(e) => set(`company.${key}`, e.target.value)}
                    className="h-9 w-full rounded-lg border border-line bg-surface-2/60 px-2.5 text-[13px] text-ink focus:border-brand-500/70 focus:outline-none"
                  />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Address</span>
                <Textarea
                  value={String(get("company.address") ?? "")}
                  onChange={(e) => set("company.address", e.target.value)}
                  rows={2}
                />
              </label>
            </div>
          </Card>
        )}

        {/* ---------------------------------------------- notifications */}
        {section === "notifications" && (
          <Card>
            <CardTitle title="Notifications" description="Which events raise a bell notification." />
            <div className="divide-y divide-line">
              {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
                <Row
                  key={key}
                  label={label}
                  help=""
                  control={
                    <Switch
                      checked={Boolean(get(`notifications.${key}`))}
                      onChange={(v) => set(`notifications.${key}`, v)}
                      aria-label={label}
                    />
                  }
                />
              ))}
            </div>
          </Card>
        )}

        {/* ----------------------------------------------- integrations */}
        {section === "integrations" && (
          <Card>
            <CardTitle
              title="Integrations"
              description="Connect a provider to send real messages and deployments. Without one, NEXORA simulates the external call and tells you it did."
            />
            <div className="divide-y divide-line">
              {integrations.map((i) => (
                <Row
                  key={i.id}
                  label={i.name}
                  help={i.description}
                  control={
                    <Badge tone={i.status === "CONNECTED" ? "success" : i.status === "ERROR" ? "danger" : "neutral"}>
                      {i.status.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  }
                />
              ))}
              {integrations.length === 0 && (
                <p className="p-4 text-[12.5px] text-ink-muted">No integrations registered yet.</p>
              )}
            </div>
          </Card>
        )}

        {/* ------------------------------------------------ danger zone */}
        {section === "danger" && (
          <Card>
            <CardTitle title="Danger zone" description="Irreversible actions on this workspace." />
            <div className="space-y-3 p-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-[12.5px] font-medium text-amber-200">Reset the demo dataset</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-amber-200/80">
                  Deletes every lead, client, project and proposal in this workspace and regenerates a fresh demo dataset.
                  This cannot be undone.
                </p>
                <Button variant="danger" size="sm" className="mt-2.5" onClick={() => setResetOpen(true)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset workspace
                </Button>
              </div>
            </div>
          </Card>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">{error}</p>
        )}
        {saved && (
          <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-200">
            <Check className="h-3.5 w-3.5" />
            {saved}
          </p>
        )}

        {section !== "integrations" && section !== "danger" && (
          <div className="flex justify-end">
            <Button size="sm" loading={busy} onClick={save}>
              {busy ? <Loader2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              Save settings
            </Button>
          </div>
        )}
      </div>

      <Modal open={resetOpen} title="Reset this workspace?" onClose={() => setResetOpen(false)}>
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            Every lead, client, project, proposal and message will be deleted and replaced with a fresh demo dataset.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={busy} onClick={resetDemo}>
              Reset everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CardTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-line p-4">
      <h2 className="text-[13px] font-semibold text-ink-strong">{title}</h2>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}

function Row({
  label,
  help,
  risk,
  control,
}: {
  label: string;
  help: string;
  risk?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] font-medium text-ink">{label}</p>
          {risk && <Badge tone="warning">{risk}</Badge>}
        </div>
        {help && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{help}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-full rounded-lg border border-line bg-surface-2/60 px-2.5 text-[13px] text-ink focus:border-brand-500/70 focus:outline-none"
      />
    </label>
  );
}

function ListField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-ink"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="text-ink-faint hover:text-red-300"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              if (!values.includes(draft.trim())) onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder={placeholder}
          className="h-8 flex-1 rounded-lg border border-line bg-surface-2/60 px-2.5 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-brand-500/70 focus:outline-none"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!draft.trim()}
          onClick={() => {
            if (draft.trim() && !values.includes(draft.trim())) onChange([...values, draft.trim()]);
            setDraft("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

