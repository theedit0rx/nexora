"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, Settings, User } from "lucide-react";
import { Badge } from "@/components/ui";
import { RiskBadge } from "@/components/dashboard/lead-detail-drawer";
import { cn, dateTime, relative } from "@/lib/utils";

export type FeedEvent = {
  id: string;
  title: string;
  detail: string;
  actorType: string;
  agentKey: string | null;
  actionType: string;
  status: string;
  riskLevel: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

const HREF: Record<string, string> = {
  lead: "/leads",
  client: "/clients",
  project: "/projects",
  proposal: "/proposals",
  conversation: "/conversations",
  ticket: "/support",
  agent: "/agents",
  demo: "/websites",
  build: "/websites",
  deployment: "/websites",
  task: "/activity",
};

export function ActivityFeed({
  events,
  agents,
}: {
  events: FeedEvent[];
  agents: Array<{ key: string; name: string }>;
}) {
  const [actor, setActor] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [risk, setRisk] = useState("ALL");

  const agentName = useMemo(() => new Map(agents.map((a) => [a.key, a.name])), [agents]);

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (actor !== "ALL" && (e.agentKey ?? e.actorType.toLowerCase()) !== actor) return false;
        if (status !== "ALL" && e.status !== status) return false;
        if (risk !== "ALL" && e.riskLevel !== risk) return false;
        return true;
      }),
    [events, actor, status, risk],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <label className="sr-only" htmlFor="feed-actor">
          Filter by actor
        </label>
        <select
          id="feed-actor"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-ink focus:border-brand-500/50 focus:outline-none"
        >
          <option value="ALL">All actors</option>
          <option value="USER">Owner</option>
          {agents.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="feed-status">
          Filter by status
        </label>
        <select
          id="feed-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-ink focus:border-brand-500/50 focus:outline-none"
        >
          {["ALL", "OK", "PENDING", "WARN", "ERROR"].map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="feed-risk">
          Filter by risk
        </label>
        <select
          id="feed-risk"
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
          className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-ink focus:border-brand-500/50 focus:outline-none"
        >
          {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
            <option key={r} value={r}>
              {r === "ALL" ? "All risk levels" : r}
            </option>
          ))}
        </select>
        <span className="ml-auto tnum text-[11px] text-ink-faint">{filtered.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[12.5px] text-ink-faint">No events match these filters.</p>
      ) : (
        <ol className="space-y-0">
          {filtered.map((event, i) => {
            const isAgent = event.actorType === "AGENT";
            const label = isAgent ? (agentName.get(event.agentKey ?? "") ?? event.agentKey ?? "agent") : "Owner";
            const href = event.entityId ? `${HREF[event.entityType] ?? ""}/${event.entityId}` : null;
            const Icon = event.actorType === "SYSTEM" ? Settings : isAgent ? Bot : User;
            return (
              <li key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[10px] font-bold uppercase",
                      event.status === "WARN"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : event.status === "ERROR"
                          ? "border-red-500/30 bg-red-500/10 text-red-300"
                          : isAgent
                            ? "border-brand-500/30 bg-brand-500/10 text-brand-300"
                            : "border-line bg-surface-2 text-ink-muted",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  {i < filtered.length - 1 && <span className="w-px flex-1 bg-line" />}
                </div>
                <div className="min-w-0 flex-1 pb-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[12.5px] font-medium leading-snug text-ink">
                      {href && event.entityType === "lead" ? (
                        <Link href={href} className="hover:text-brand-200">
                          {event.title}
                        </Link>
                      ) : (
                        event.title
                      )}
                    </p>
                    <span className="shrink-0 text-[10.5px] text-ink-faint" title={dateTime(event.createdAt)}>
                      {relative(event.createdAt)}
                    </span>
                  </div>
                  {event.detail && (
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{event.detail}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={isAgent ? "brand" : "info"}>{label}</Badge>
                    <Badge tone="neutral">{event.actionType}</Badge>
                    {event.riskLevel !== "LOW" && <RiskBadge level={event.riskLevel} />}
                    {event.status === "OK" && <CheckCircle2 className="h-3 w-3 text-emerald-400/70" />}
                    {event.status === "WARN" && <AlertTriangle className="h-3 w-3 text-amber-400/70" />}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
