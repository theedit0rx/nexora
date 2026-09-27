"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, Globe2, LifeBuoy, MessageSquare, Rocket } from "lucide-react";
import { Badge, Progress } from "@/components/ui";
import { cn, dateTime, money, num, percent, relative } from "@/lib/utils";

export type PortalItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  onboardingProgress: number;
  onboardingMissing: string[];
  contractValue: number;
  projects: Array<{
    id: string;
    name: string;
    stage: string;
    progress: number;
    previewUrl: string | null;
    productionUrl: string | null;
    dueDate: string;
  }>;
  liveSites: Array<{ id: string; url: string; kind: string; customDomain: string | null }>;
  tickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    resolution: string;
  }>;
  conversations: Array<{ id: string; subject: string; updatedAt: string }>;
};

export function ClientPortal({ items }: { items: PortalItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const active = items.find((c) => c.id === activeId) ?? items[0];
  if (!active) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <nav className="panel h-fit p-1.5" aria-label="Clients">
        {items.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => setActiveId(client.id)}
            className={cn(
              "block w-full rounded-lg px-2.5 py-2 text-left transition-colors",
              client.id === active.id ? "bg-brand-500/12" : "hover:bg-white/[0.03]",
            )}
          >
            <p className="truncate text-[12.5px] font-medium text-ink">{client.name}</p>
            <p className="truncate text-[10.5px] text-ink-faint">
              {client.liveSites.length} live · {client.projects.length} projects
            </p>
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        {/* ------------------------------------------------------ header */}
        <div className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold tracking-tight text-ink-strong">{active.name}</h2>
              <Badge tone={active.status === "ACTIVE" ? "success" : "warning"}>{active.status.toLowerCase()}</Badge>
            </div>
            <p className="mt-1 text-[12px] text-ink-muted">
              Contract value <span className="tnum text-ink">{money(active.contractValue)}</span> · portal {active.slug}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Onboarding", percent(active.onboardingProgress)],
              ["Live sites", num(active.liveSites.length)],
              ["Open tickets", num(active.tickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
                <p className="tnum mt-0.5 text-[15px] font-semibold text-ink-strong">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* -------------------------------------------------- onboarding */}
        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink-strong">Onboarding progress</h3>
            <span className="tnum text-[11.5px] text-ink-muted">{active.onboardingProgress}% complete</span>
          </div>
          <Progress value={active.onboardingProgress} tone={active.onboardingProgress >= 100 ? "success" : "warning"} className="mt-2.5" />
          {active.onboardingProgress >= 100 ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All set — the production build can start.
            </p>
          ) : (
            <>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-muted">
                We still need {active.onboardingMissing.length} items before the build can start:
              </p>
              <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {active.onboardingMissing.map((m) => (
                  <li key={m} className="flex items-center gap-1.5 text-[11.5px] text-ink">
                    <Circle className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                    {m}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ---------------------------------------------------- live sites */}
        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">Live websites</h3>
          {active.liveSites.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-ink-muted">
              No live sites yet. Your first deployment will appear here with a permanent URL.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {active.liveSites.map((site) => (
                <li
                  key={site.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/60 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Globe2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-ink">
                        {site.customDomain ?? site.url.replace(/^https?:\/\//, "")}
                      </p>
                      <p className="text-[10.5px] uppercase tracking-wide text-ink-faint">{site.kind.toLowerCase()} deployment</p>
                    </div>
                  </div>
                  <a href={site.url} target="_blank" rel="noopener noreferrer">
                    <Badge tone="success" className="cursor-pointer">
                      <ExternalLink className="h-2.5 w-2.5" />
                      Visit site
                    </Badge>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ------------------------------------------------------ projects */}
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink-strong">Projects</h3>
            <Link href="/projects" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
              Delivery board →
            </Link>
          </div>
          {active.projects.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-ink-muted">No projects yet.</p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {active.projects.map((p) => (
                <li key={p.id} className="rounded-lg border border-line/60 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] font-medium text-ink">{p.name}</p>
                    <Badge tone="brand">{p.stage}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-ink-faint">
                    {p.dueDate ? `Due ${dateTime(p.dueDate)} (${relative(p.dueDate)})` : "No due date"}
                  </p>
                  <Progress value={p.progress} className="mt-1.5" />
                  <div className="mt-2 flex gap-2">
                    {p.previewUrl && (
                      <a href={p.previewUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-300 hover:text-brand-200">
                        Preview →
                      </a>
                    )}
                    {p.productionUrl && (
                      <a href={p.productionUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-300 hover:text-emerald-200">
                        Live →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ------------------------------------------------------- support */}
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink-strong">Support requests</h3>
            <Link href="/support" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
              Open tickets →
            </Link>
          </div>
          {active.tickets.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <LifeBuoy className="h-3.5 w-3.5" />
              No support requests. Everything is running smoothly.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {active.tickets.map((t) => (
                <li key={t.id} className="rounded-lg border border-line/60 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] text-ink">{t.subject}</p>
                    <Badge tone={t.status === "RESOLVED" ? "success" : t.priority === "URGENT" ? "danger" : "warning"}>
                      {t.status.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </div>
                  {t.resolution && <p className="mt-1 text-[11.5px] leading-relaxed text-emerald-300/90">{t.resolution}</p>}
                  <p className="mt-1 text-[10.5px] text-ink-faint">Raised {relative(t.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* -------------------------------------------------- conversation */}
        <div className="panel p-4">
          <h3 className="text-[13px] font-semibold text-ink-strong">Messages</h3>
          {active.conversations.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <MessageSquare className="h-3.5 w-3.5" />
              No message threads yet.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-1.5">
              {active.conversations.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                  <span className="truncate text-[12px] text-ink">{c.subject}</span>
                  <span className="shrink-0 text-[10.5px] text-ink-faint">{relative(c.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-faint">
          <Rocket className="h-3 w-3" />
          This portal is generated from the same data the internal team sees, with internal intelligence removed.
        </p>
      </div>
    </div>
  );
}
