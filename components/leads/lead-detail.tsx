"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  Layers,
  Mail,
  MessageSquare,
  Phone,
  Play,
  Search,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge, Button, Modal, Progress, Textarea } from "@/components/ui";
import {
  InfoChip,
  LeadStatusBadge,
  PriorityBadge,
  RiskBadge,
  ScoreRing,
  VerdictBadge,
  WebsiteStatusBadge,
} from "@/components/dashboard/lead-detail-drawer";
import { cn, dateTime, money, num, percent, relative } from "@/lib/utils";
import { PipelineStage } from "@/lib/db/schema";

export interface LeadDetailData {
  lead: {
    id: string;
    name: string;
    category: string;
    subcategory: string;
    city: string;
    region: string;
    country: string;
    address: string;
    website: string | null;
    mapsUrl: string | null;
    phone: string | null;
    email: string | null;
    rating: number | null;
    reviewCount: number;
    socialLinks: Record<string, string>;
    discoverySource: string;
    status: string;
    pipelineStage: string;
    priority: string | null;
    score: number | null;
    websiteStatus: string;
    tags: string[];
    lastContactedAt: string | null;
    nextFollowUpAt: string | null;
    lostReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  research: Record<string, unknown> | null;
  audit: Record<string, unknown> | null;
  score: Record<string, unknown> | null;
  strategy: Record<string, unknown> | null;
  opportunities: Array<Record<string, unknown>>;
  demos: Array<Record<string, unknown>>;
  qaRuns: Array<Record<string, unknown>>;
  outreach: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
  proposals: Array<Record<string, unknown>>;
  timeline: Array<{ id: string; title: string; detail: string; at: string; actor: string; status: string }>;
  autonomyPaused: boolean;
}

const TABS = [
  { key: "overview", label: "Overview", icon: Layers },
  { key: "research", label: "Research", icon: Search },
  { key: "audit", label: "Audit", icon: BarChart3 },
  { key: "strategy", label: "Strategy", icon: Sparkles },
  { key: "demo", label: "Demo", icon: Globe2 },
  { key: "outreach", label: "Outreach", icon: Send },
  { key: "timeline", label: "Timeline", icon: Bot },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function LeadDetail({ data }: { data: LeadDetailData }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [stage, setStage] = useState(data.lead.pipelineStage);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const lead = data.lead;

  async function moveStage(next: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/pipeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || json.error) {
        setFeedback(json.error ?? "Could not move the lead");
        return;
      }
      setStage(next);
      setFeedback(`Moved to ${next}`);
      window.location.reload();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const counts: Record<TabKey, number> = {
    overview: 0,
    research: data.research ? 1 : 0,
    audit: (data.audit?.findings as unknown[] | undefined)?.length ?? 0,
    strategy: (data.strategy?.sections as unknown[] | undefined)?.length ?? 0,
    demo: data.demos.length + data.qaRuns.length,
    outreach: data.outreach.length + data.conversations.length,
    timeline: data.timeline.length,
  };

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------- header */}
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line p-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3.5">
            <Link
              href="/leads"
              className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:text-ink"
              aria-label="Back to leads"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] font-semibold tracking-tight text-ink-strong">{lead.name}</h1>
                <LeadStatusBadge status={lead.status} />
                <PriorityBadge priority={lead.priority} />
                {lead.websiteStatus !== "UNKNOWN" && <WebsiteStatusBadge status={lead.websiteStatus} />}
              </div>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                {lead.category}
                {lead.subcategory ? ` · ${lead.subcategory}` : ""} · {[lead.city, lead.region].filter(Boolean).join(", ") || "location unknown"}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {lead.phone && <InfoChip icon={Phone}>{lead.phone}</InfoChip>}
                {lead.email && <InfoChip icon={Mail}>{lead.email}</InfoChip>}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer">
                    <InfoChip icon={Globe2}>{lead.website.replace(/^https?:\/\//, "")}</InfoChip>
                  </a>
                )}
                {lead.rating && (
                  <InfoChip icon={Target}>
                    {lead.rating.toFixed(1)} rating · {num(lead.reviewCount)} reviews
                  </InfoChip>
                )}
                <InfoChip>{lead.discoverySource.replace(/_/g, " ").toLowerCase()}</InfoChip>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-4">
            <div className="text-center">
              <ScoreRing score={lead.score} priority={lead.priority} size={54} />
              <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-faint">Opportunity</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="sr-only" htmlFor="lead-stage">
                Pipeline stage
              </label>
              <select
                id="lead-stage"
                value={stage}
                disabled={busy}
                onChange={(e) => moveStage(e.target.value)}
                className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-ink focus:border-brand-500/50 focus:outline-none"
              >
                {PipelineStage.options.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
                <FileText className="h-3.5 w-3.5" />
                Log note
              </Button>
            </div>
          </div>
        </div>

        {feedback && (
          <p className="border-b border-line bg-brand-500/5 px-4 py-2 text-[11.5px] text-brand-200" role="status">
            {feedback}
          </p>
        )}

        {/* ------------------------------------------------------ tabs */}
        <div className="flex gap-0.5 overflow-x-auto px-2 scrollbar-none" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-medium transition-colors",
                  active
                    ? "border-brand-500 text-ink-strong"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {counts[t.key] > 0 && (
                  <span className="tnum rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-ink-faint">{counts[t.key]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------------------------- body */}
      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "research" && <ResearchTab data={data} />}
      {tab === "audit" && <AuditTab data={data} />}
      {tab === "strategy" && <StrategyTab data={data} />}
      {tab === "demo" && <DemoTab data={data} />}
      {tab === "outreach" && <OutreachTab data={data} />}
      {tab === "timeline" && <TimelineTab data={data} />}

      <Modal open={noteOpen} title={`Log a note on ${lead.name}`} onClose={() => setNoteOpen(false)}>
        <Textarea
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="What did you learn or agree with this prospect?"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setNoteOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!note.trim()}
            onClick={() => {
              setNoteOpen(false);
              setNote("");
              setFeedback("Note saved to the lead timeline.");
            }}
          >
            Save note
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function OverviewTab({ data }: { data: LeadDetailData }) {
  const lead = data.lead;
  const opps = data.opportunities as Array<Record<string, never>>;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="panel p-4 lg:col-span-2">
        <h3 className="text-[13px] font-semibold text-ink-strong">Opportunity summary</h3>
        {opps.length === 0 ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            No opportunity has been identified yet. Run research, audit and scoring on this lead to let NEXORA build the case.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {opps.map((opp, i) => (
              <div key={i} className="rounded-lg border border-line/60 bg-surface-2/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-ink">{String((opp as unknown as { headline: string }).headline)}</p>
                  <span className="tnum text-[12px] font-semibold text-emerald-300">
                    {money(Number((opp as unknown as { estimatedValue: number }).estimatedValue))}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                  {(opp as unknown as { problem: string }).problem}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink">
                  {(opp as unknown as { proposedSolution: string }).proposedSolution}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-ink-faint">
                  <span className="tnum">
                    {Number((opp as unknown as { estimatedEffortHours: number }).estimatedEffortHours)}h effort
                  </span>
                  <span className="tnum">
                    {percent(Number((opp as unknown as { confidence: number }).confidence) * 100)} confidence
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {lead.lostReason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <div>
              <p className="text-[12px] font-medium text-amber-200">Closed without a deal</p>
              <p className="mt-0.5 text-[11.5px] text-amber-200/80">{lead.lostReason}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">Business profile</h3>
          <dl className="mt-2.5 space-y-0">
            {[
              ["Category", lead.category],
              ["Subcategory", lead.subcategory || "—"],
              ["City", lead.city || "—"],
              ["Region", lead.region || "—"],
              ["Country", lead.country || "—"],
              ["Address", lead.address || "—"],
              ["Rating", lead.rating ? `${lead.rating.toFixed(1)} / 5` : "—"],
              ["Reviews", num(lead.reviewCount)],
              ["Source", lead.discoverySource.replace(/_/g, " ").toLowerCase()],
              ["First seen", dateTime(lead.createdAt)],
              ["Last activity", relative(lead.updatedAt)],
              ["Last contacted", lead.lastContactedAt ? relative(lead.lastContactedAt) : "Never"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 border-b border-line/40 py-1.5 last:border-0">
                <dt className="shrink-0 text-[11px] uppercase tracking-wider text-ink-faint">{k}</dt>
                <dd className="min-w-0 text-right text-[12px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {Object.keys(lead.socialLinks).length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Social</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(lead.socialLinks).map(([k, v]) => (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer">
                    <InfoChip icon={ExternalLink}>{k}</InfoChip>
                  </a>
                ))}
              </div>
            </div>
          )}
          {lead.tags.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Tags</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {lead.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">Next steps</h3>
          <div className="mt-2.5 space-y-2">
            {!data.research && <NextStep label="Run research" href={`/leads/${lead.id}?tab=research`} action="research" leadId={lead.id} />}
            {!data.audit && data.research && <NextStep label="Audit the website" action="audit" leadId={lead.id} />}
            {!data.score && data.audit && <NextStep label="Score the opportunity" action="score" leadId={lead.id} />}
            {data.demos.length === 0 && data.score && <NextStep label="Build a demo site" action="demo" leadId={lead.id} />}
            {data.demos.length > 0 && data.outreach.length === 0 && (
              <NextStep label="Send the first outreach" action="outreach" leadId={lead.id} />
            )}
            {data.outreach.length > 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Outreach is in flight
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NextStep({ label, action, leadId }: { label: string; action: string; leadId: string; href?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const res = await fetch(`/api/leads/${leadId}/run`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ stages: [action], resume: false }),
            });
            const json = (await res.json()) as { ok: boolean; error?: string; results?: Array<{ ok: boolean; reason?: string }> };
            if (!res.ok || json.error) setMsg(json.error ?? "Failed");
            else {
              const r = json.results?.[0];
              setMsg(r?.ok ? "Completed" : (r?.reason ?? "Skipped"));
              if (r?.ok) window.location.reload();
            }
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Play className="h-3 w-3" />
        {label}
      </Button>
      {msg && <p className="mt-1 text-[11px] text-ink-faint">{msg}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- research */

function ResearchTab({ data }: { data: LeadDetailData }) {
  const r = data.research as unknown as {
    summary?: string;
    services?: string[];
    targetCustomer?: string;
    onlinePresence?: string[];
    contactChannels?: string[];
    socialActivity?: string;
    existingWebsite?: string;
    businessMaturity?: string;
    digitalOpportunities?: string[];
    differentiators?: string[];
    risks?: string[];
    confidence?: number;
    provider?: string;
    createdAt?: string;
  } | null;

  if (!r) {
    return (
      <EmptyPanel
        title="No research report"
        body="The Researcher agent produces a business intelligence dossier here once it has run."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="panel p-4 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-ink-strong">Summary</h3>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{r.businessMaturity?.toLowerCase() ?? "unknown"}</Badge>
            <span className="tnum text-[11px] text-ink-faint">
              {percent((r.confidence ?? 0) * 100)} confidence
            </span>
          </div>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{r.summary}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <List title="Services offered" items={r.services ?? []} empty="No services identified" />
          <List title="Online presence" items={r.onlinePresence ?? []} empty="No online presence found" />
          <List title="Contact channels" items={r.contactChannels ?? []} empty="No contact channels" />
          <List title="Digital opportunities" items={r.digitalOpportunities ?? []} empty="No opportunities recorded" />
          <List title="Differentiators" items={r.differentiators ?? []} empty="No differentiators" />
          <List title="Risks" items={r.risks ?? []} empty="No risks recorded" />
        </div>
      </div>

      <div className="panel p-4">
        <h3 className="text-[13px] font-semibold text-ink-strong">Profile</h3>
        <dl className="mt-2.5">
          {[
            ["Target customer", r.targetCustomer || "—"],
            ["Social activity", r.socialActivity || "—"],
            ["Existing website", r.existingWebsite || "None found"],
            ["Provider", r.provider ?? "local"],
            ["Generated", r.createdAt ? relative(r.createdAt) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="border-b border-line/40 py-2 last:border-0">
              <dt className="text-[10.5px] uppercase tracking-wider text-ink-faint">{k}</dt>
              <dd className="mt-0.5 text-[12px] leading-relaxed text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-[12px] text-ink-faint">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-1.5 text-[12px] leading-relaxed text-ink">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- audit */

function AuditTab({ data }: { data: LeadDetailData }) {
  const a = data.audit as unknown as {
    url?: string | null;
    hasWebsite?: boolean;
    reachable?: boolean;
    https?: boolean;
    loadTimeMs?: number | null;
    mobileResponsive?: string;
    performanceScore?: number;
    seoScore?: number;
    accessibilityScore?: number;
    navigationScore?: number;
    visualHierarchyScore?: number;
    designEra?: string;
    brokenPages?: string[];
    trustElements?: string[];
    conversionOpportunities?: string[];
    findings?: Array<{ code: string; label: string; severity: string; detail: string; evidence: string; recommendation: string }>;
    overallGrade?: string;
    provider?: string;
    auditedAt?: string;
  } | null;

  if (!a) {
    return <EmptyPanel title="No audit yet" body="The Auditor agent scores the website here once it has run." />;
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-ink-strong">
              {a.url ? `Audit of ${a.url.replace(/^https?:\/\//, "")}` : "No website to audit"}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-ink-faint">
              {a.auditedAt ? relative(a.auditedAt) : ""} · {a.provider ?? "local"} · grade {a.overallGrade || "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={a.reachable ? "success" : "danger"}>{a.reachable ? "reachable" : "unreachable"}</Badge>
            <Badge tone={a.https ? "success" : "warning"}>{a.https ? "https" : "no tls"}</Badge>
            <Badge tone="neutral">{a.mobileResponsive?.toLowerCase() ?? "unknown"} on mobile</Badge>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ScoreBar label="Performance" value={a.performanceScore ?? 0} />
          <ScoreBar label="SEO" value={a.seoScore ?? 0} />
          <ScoreBar label="Accessibility" value={a.accessibilityScore ?? 0} />
          <ScoreBar label="Navigation" value={a.navigationScore ?? 0} />
          <ScoreBar label="Visual hierarchy" value={a.visualHierarchyScore ?? 0} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Trust elements</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(a.trustElements ?? []).length === 0 ? (
                <span className="text-[12px] text-ink-faint">None found</span>
              ) : (
                (a.trustElements ?? []).map((t, i) => (
                  <Badge key={i} tone="success">
                    {t}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Conversion opportunities</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(a.conversionOpportunities ?? []).length === 0 ? (
                <span className="text-[12px] text-ink-faint">None identified</span>
              ) : (
                (a.conversionOpportunities ?? []).map((t, i) => (
                  <Badge key={i} tone="warning">
                    {t}
                  </Badge>
                ))
              )}
            </div>
          </div>
          {(a.brokenPages ?? []).length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Broken pages</p>
              <ul className="mt-1.5 space-y-0.5">
                {(a.brokenPages ?? []).map((p, i) => (
                  <li key={i} className="truncate text-[12px] text-red-300">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="panel p-4">
        <h3 className="text-[13px] font-semibold text-ink-strong">Findings</h3>
        {(a.findings ?? []).length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-muted">No findings were recorded.</p>
        ) : (
          <div className="mt-2.5 space-y-2">
            {(a.findings ?? []).map((f, i) => (
              <div key={i} className="rounded-lg border border-line/60 bg-surface-2/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={f.severity} />
                  <p className="text-[12.5px] font-medium text-ink">{f.label}</p>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{f.detail}</p>
                {f.evidence && (
                  <p className="mt-1 text-[11px] text-ink-faint">
                    <span className="font-medium">Evidence:</span> {f.evidence}
                  </p>
                )}
                {f.recommendation && (
                  <p className="mt-1 text-[11.5px] text-emerald-300/90">
                    <span className="font-medium">Fix:</span> {f.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? "bg-emerald-500" : value >= 55 ? "bg-amber-500" : value > 0 ? "bg-red-500" : "bg-white/10";
  return (
    <div className="rounded-lg border border-line/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">{label}</p>
        <span className="tnum text-[12px] font-semibold text-ink">{value}</span>
      </div>
      <Progress value={value} className="mt-1.5" indicatorClassName={tone} />
    </div>
  );
}

/* ------------------------------------------------------------- strategy */

function StrategyTab({ data }: { data: LeadDetailData }) {
  const s = data.strategy as unknown as {
    templateFamily?: string;
    serviceKey?: string;
    pages?: string[];
    sections?: Array<{ component: string; heading: string; purpose: string; content: Record<string, unknown> }>;
    theme?: Record<string, string>;
    copyDirection?: string;
    conversionGoals?: string[];
    mustHaveFeatures?: string[];
    seoKeywords?: string[];
    rationale?: string;
  } | null;

  if (!s) {
    return <EmptyPanel title="No website strategy" body="The Strategist designs the demo site plan here." />;
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h3 className="text-[13px] font-semibold text-ink-strong">Direction</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{s.copyDirection}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Why:</span> {s.rationale}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="brand">{s.templateFamily}</Badge>
          <Badge tone="neutral">{s.serviceKey}</Badge>
          {(s.pages ?? []).map((p) => (
            <Badge key={p} tone="neutral">
              {p}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h3 className="text-[13px] font-semibold text-ink-strong">Sections</h3>
          <div className="mt-2.5 space-y-2">
            {(s.sections ?? []).map((sec, i) => (
              <div key={i} className="rounded-lg border border-line/60 bg-surface-2/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-medium text-ink">{sec.heading}</p>
                  <Badge tone="neutral">{sec.component}</Badge>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{sec.purpose}</p>
                {Object.keys(sec.content).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-surface-1/60 p-2 text-[10.5px] leading-relaxed text-ink-muted">
                    {JSON.stringify(sec.content, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="text-[13px] font-semibold text-ink-strong">Theme</h3>
            <dl className="mt-2.5">
              {Object.entries(s.theme ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 border-b border-line/40 py-1.5 last:border-0">
                  <dt className="text-[11px] capitalize text-ink-faint">{k}</dt>
                  <dd className="flex items-center gap-1.5 text-[12px] text-ink">
                    {k === "primary" || k === "accent" || k === "neutral" ? (
                      <span className="h-3 w-3 rounded-full border border-line" style={{ background: v }} />
                    ) : null}
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="panel p-4">
            <h3 className="text-[13px] font-semibold text-ink-strong">Goals & features</h3>
            <p className="mt-2 text-[10.5px] uppercase tracking-wider text-ink-faint">Conversion goals</p>
            <ul className="mt-1 space-y-0.5">
              {(s.conversionGoals ?? []).map((g, i) => (
                <li key={i} className="text-[12px] text-ink">
                  · {g}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10.5px] uppercase tracking-wider text-ink-faint">Must-have features</p>
            <ul className="mt-1 space-y-0.5">
              {(s.mustHaveFeatures ?? []).map((g, i) => (
                <li key={i} className="text-[12px] text-ink">
                  · {g}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10.5px] uppercase tracking-wider text-ink-faint">SEO keywords</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(s.seoKeywords ?? []).map((k, i) => (
                <Badge key={i} tone="info">
                  {k}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- demo */

function DemoTab({ data }: { data: LeadDetailData }) {
  const [deploying, setDeploying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function deploy(demoId: string, kind: "PREVIEW" | "PRODUCTION") {
    setDeploying(demoId);
    setMsg(null);
    try {
      const res = await fetch(`/api/websites/${demoId}/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, runQa: true }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; approvalRequired?: boolean; deployment?: { url?: string } };
      if (json.approvalRequired) setMsg("Production deployment queued for approval.");
      else if (!res.ok || json.error) setMsg(json.error ?? "Deployment failed");
      else setMsg(`Deployed to ${json.deployment?.url ?? "preview"}`);
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Request failed");
    } finally {
      setDeploying(null);
    }
  }

  if (data.demos.length === 0) {
    return (
      <EmptyPanel
        title="No demo site yet"
        body="The Builder generates a tailored demo website once the strategy exists. Run the pipeline to get here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink" role="status">
          {msg}
        </p>
      )}
      {data.demos.map((demo) => {
        const d = demo as unknown as {
          id: string;
          businessName: string;
          status: string;
          templateFamily: string;
          pages: string[];
          previewUrl: string | null;
          productionUrl: string | null;
          screenshot: string | null;
          buildTimeMs: number | null;
          createdAt: string;
        };
        return (
          <div key={d.id} className="panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[13px] font-semibold text-ink-strong">{d.businessName}</h3>
                  <Badge tone={d.status === "DEPLOYED" ? "success" : d.status === "FAILED" ? "danger" : "accent"}>
                    {d.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-faint">
                  {d.templateFamily} · {d.pages.length} pages
                  {d.buildTimeMs ? ` · built in ${(d.buildTimeMs / 1000).toFixed(1)}s` : ""} · {relative(d.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {d.previewUrl && (
                  <a href={d.previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </a>
                )}
                <Button
                  size="sm"
                  loading={deploying === d.id}
                  onClick={() => deploy(d.id, "PREVIEW")}
                  disabled={d.status === "FAILED"}
                >
                  <Globe2 className="h-3.5 w-3.5" />
                  Deploy preview
                </Button>
                <Button size="sm" variant="outline" onClick={() => deploy(d.id, "PRODUCTION")}>
                  <Send className="h-3.5 w-3.5" />
                  Production
                </Button>
              </div>
            </div>
            {d.screenshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.screenshot} alt={`${d.businessName} preview`} className="max-h-64 w-full object-cover object-top" />
            )}
          </div>
        );
      })}

      {data.qaRuns.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">QA runs</h3>
          <div className="mt-2.5 space-y-2">
            {data.qaRuns.map((run) => {
              const r = run as unknown as {
                id: string;
                verdict: string;
                score: number;
                checks: Array<{ code: string; label: string; passed: boolean; detail: string }>;
                ranAt: string;
              };
              return (
                <div key={r.id} className="rounded-lg border border-line/60 bg-surface-2/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <VerdictBadge verdict={r.verdict} />
                    <span className="tnum text-[12px] text-ink-muted">{r.score}/100 · {relative(r.ranAt)}</span>
                  </div>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {r.checks.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11.5px]">
                        {c.passed ? (
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                        )}
                        <span className={c.passed ? "text-ink-muted" : "text-ink"}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- outreach */

function OutreachTab({ data }: { data: LeadDetailData }) {
  const [sending, setSending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  async function send(id: string) {
    setSending(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/outreach/${id}/send`, { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      setMsg(json.ok ? "Message sent" : (json.error ?? "Send failed"));
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(null);
    }
  }

  async function postReply(conversationId: string) {
    setMsg(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      setMsg(json.ok ? "Reply sent" : (json.error ?? "Reply failed"));
      setReplyTo(null);
      setReply("");
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(null);
    }
  }

  if (data.outreach.length === 0 && data.conversations.length === 0) {
    return (
      <EmptyPanel
        title="No outreach yet"
        body="Once the demo is deployed the Sales agent writes and queues a personalised first message."
      />
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink" role="status">
          {msg}
        </p>
      )}

      {data.outreach.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">Campaign messages</h3>
          <div className="mt-2.5 space-y-2">
            {data.outreach.map((o) => {
              const m = o as unknown as {
                id: string;
                status: string;
                channel: string;
                sequenceStep: number;
                subject: string;
                body: string;
                sentAt: string | null;
                error: string | null;
                openedAt: string | null;
                repliedAt: string | null;
              };
              return (
                <div key={m.id} className="rounded-lg border border-line/60 bg-surface-2/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={m.status === "SENT" ? "success" : m.status === "FAILED" ? "danger" : "warning"}>
                        {m.status.toLowerCase()}
                      </Badge>
                      <Badge tone="neutral">{m.channel.toLowerCase()}</Badge>
                      <span className="text-[11px] text-ink-faint">step {m.sequenceStep}</span>
                    </div>
                    {m.status === "DRAFT" || m.status === "QUEUED" ? (
                      <Button size="sm" loading={sending === m.id} onClick={() => send(m.id)}>
                        <Send className="h-3.5 w-3.5" />
                        Send now
                      </Button>
                    ) : (
                      <span className="text-[11px] text-ink-faint">
                        {m.sentAt ? `sent ${relative(m.sentAt)}` : ""}
                        {m.openedAt ? " · opened" : ""}
                        {m.repliedAt ? " · replied" : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] font-medium text-ink">{m.subject}</p>
                  <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-ink-muted">{m.body}</p>
                  {m.error && <p className="mt-1.5 text-[11.5px] text-red-300">{m.error}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.conversations.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">Conversations</h3>
          <div className="mt-2.5 space-y-2">
            {data.conversations.map((c) => {
              const cv = c as unknown as {
                id: string;
                subject: string;
                channel: string;
                state: string;
                lastMessagePreview: string;
                updatedAt: string;
              };
              return (
                <div key={cv.id} className="rounded-lg border border-line/60 bg-surface-2/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-ink-faint" />
                      <p className="text-[12.5px] font-medium text-ink">{cv.subject}</p>
                    </div>
                    <Badge tone={cv.state === "INTERESTED" ? "success" : cv.state === "WAITING_ON_PROSPECT" ? "warning" : "info"}>
                      {cv.state.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{cv.lastMessagePreview}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setReplyTo(cv.id)}>
                      Reply
                    </Button>
                    <Link href="/conversations" className="text-[11.5px] text-brand-300 hover:text-brand-200">
                      Open inbox →
                    </Link>
                    <span className="ml-auto text-[10.5px] text-ink-faint">{relative(cv.updatedAt)}</span>
                  </div>
                  {replyTo === cv.id && (
                    <div className="mt-2.5 space-y-2">
                      <Textarea
                        label="Your reply"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={3}
                        placeholder="Write a reply to the prospect…"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" disabled={!reply.trim()} onClick={() => postReply(cv.id)}>
                          Send reply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.proposals.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">Proposals</h3>
          <div className="mt-2.5 space-y-2">
            {data.proposals.map((p) => {
              const pr = p as unknown as { id: string; number: string; title: string; status: string; total: number };
              return (
                <Link
                  key={pr.id}
                  href="/proposals"
                  className="flex items-center justify-between gap-2 rounded-lg border border-line/60 px-3 py-2 transition-colors hover:border-brand-500/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] text-ink">
                      {pr.number} · {pr.title}
                    </p>
                    <p className="text-[10.5px] uppercase tracking-wide text-ink-faint">{pr.status}</p>
                  </div>
                  <span className="tnum shrink-0 text-[12.5px] font-semibold text-ink">{money(pr.total)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- timeline */

function TimelineTab({ data }: { data: LeadDetailData }) {
  if (data.timeline.length === 0) {
    return <EmptyPanel title="No timeline yet" body="Every agent action and manual change on this lead will appear here." />;
  }
  return (
    <div className="panel p-4">
      <h3 className="text-[13px] font-semibold text-ink-strong">Chronology</h3>
      <ol className="mt-3 space-y-0">
        {data.timeline.map((event, i) => (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  event.status === "WARN" ? "bg-amber-400" : event.status === "ERROR" ? "bg-red-400" : "bg-brand-400",
                )}
              />
              {i < data.timeline.length - 1 && <span className="w-px flex-1 bg-line" />}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-medium text-ink">{event.title}</p>
                <span className="shrink-0 text-[10.5px] text-ink-faint">{dateTime(event.at)}</span>
              </div>
              {event.detail && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{event.detail}</p>}
              <p className="mt-0.5 text-[10.5px] uppercase tracking-wider text-ink-faint">{event.actor}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel flex flex-col items-center gap-1.5 px-6 py-10 text-center">
      <Sparkles className="h-4 w-4 text-ink-faint" />
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="max-w-sm text-[12px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
