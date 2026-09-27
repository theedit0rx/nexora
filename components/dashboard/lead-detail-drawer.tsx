"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Globe2,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button, Modal, Progress, Textarea } from "@/components/ui";
import { cn, money, relative } from "@/lib/utils";

/* ==========================================================================
   Shared lead / client list primitives used across the CRM and pipeline.
   ========================================================================== */

export function ScoreRing({
  score,
  priority,
  size = 38,
}: {
  score: number | null;
  priority?: string | null;
  size?: number;
}) {
  const value = score ?? 0;
  const tone =
    priority === "HOT"
      ? "text-red-300"
      : priority === "WARM"
        ? "text-amber-300"
        : priority === "COLD"
          ? "text-sky-300"
          : "text-ink-faint";
  const stroke = priority === "HOT" ? "#ef4444" : priority === "WARM" ? "#f59e0b" : priority === "COLD" ? "#3b82f6" : "#64748b";
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
        />
      </svg>
      <span className={cn("absolute text-[11px] font-bold tnum", tone)}>{score ?? "—"}</span>
    </span>
  );
}

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  HOT: "danger",
  WARM: "warning",
  COLD: "info",
  REJECTED: "neutral",
};

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <Badge tone="neutral">Unscored</Badge>;
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"} dot>{priority}</Badge>;
}

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent"> = {
  DISCOVERED: "neutral",
  RESEARCHING: "brand",
  AUDITING: "brand",
  AUDITED: "brand",
  SCORED: "brand",
  QUALIFIED: "success",
  REJECTED: "neutral",
  STRATEGY: "brand",
  DEMO_BUILDING: "accent",
  DEMO_READY: "accent",
  OUTREACH: "warning",
  CONTACTED: "warning",
  REPLIED: "info",
  INTERESTED: "success",
  PROPOSAL: "brand",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "neutral",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"}>
      {status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </Badge>
  );
}

export function WebsiteStatusBadge({ status }: { status: string }) {
  const tone =
    status === "NONE" || status === "BROKEN"
      ? "danger"
      : status === "OUTDATED"
        ? "warning"
        : status === "MODERN"
          ? "success"
          : "neutral";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

export function AgentStateBadge({ state }: { state: string }) {
  const tone =
    state === "WORKING"
      ? "brand"
      : state === "FAILED"
        ? "danger"
        : state === "PAUSED"
          ? "warning"
          : state === "WAITING"
            ? "accent"
            : "neutral";
  return (
    <Badge tone={tone} dot={state === "WORKING"}>
      {state.toLowerCase()}
    </Badge>
  );
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  const tone = verdict === "PASS" ? "success" : verdict === "FAIL" ? "danger" : "warning";
  return <Badge tone={tone}>{verdict.replace(/_/g, " ").toLowerCase()}</Badge>;
}

export function RiskBadge({ level }: { level: string }) {
  const tone =
    level === "CRITICAL" ? "danger" : level === "HIGH" ? "warning" : level === "MEDIUM" ? "info" : "neutral";
  return <Badge tone={tone}>{level.toLowerCase()}</Badge>;
}

/* ------------------------------------------------------------ quick actions */

export interface QuickActionContext {
  organizationId: string;
  leadId?: string;
  onDone?: (message: string) => void;
}

export function RunPipelineButton({
  leadId,
  stages,
  label = "Run pipeline",
  variant = "primary",
  size = "sm",
}: {
  leadId: string;
  stages?: string[];
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant={variant}
        size={size}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setResult(null);
          try {
            const res = await fetch(`/api/leads/${leadId}/run`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ stages, resume: false }),
            });
            const json = (await res.json()) as {
              ok: boolean;
              error?: string;
              results?: Array<{ stage: string; ok: boolean; skipped?: boolean; reason?: string }>;
            };
            if (!res.ok || json.error) {
              setResult(json.error ?? "Pipeline failed");
              return;
            }
            const failed = json.results?.find((r) => !r.ok);
            const skipped = json.results?.filter((r) => r.skipped).length ?? 0;
            setResult(
              failed
                ? `Stopped at ${failed.stage}: ${failed.reason}`
                : `Completed ${json.results?.length ?? 0} stages${skipped ? `, ${skipped} skipped` : ""}`,
            );
          } catch (err) {
            setResult(err instanceof Error ? err.message : "Request failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </Button>
      {result && (
        <span className="max-w-[260px] text-[11px] leading-relaxed text-ink-faint" role="status">
          {result}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- utilities */

export function DataRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line/50 py-2 last:border-0", className)}>
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="min-w-0 text-right text-[12.5px] text-ink">{children}</span>
    </div>
  );
}

export function InfoChip({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/50 px-2 py-1 text-[11px] text-ink-muted">
      {Icon && <Icon className="h-3 w-3 text-ink-faint" />}
      {children}
    </span>
  );
}

export { ArrowRight, Building2, CheckCircle2, ChevronRight, Clock, Gauge, Globe2, Loader2, Mail, MapPin, MessageSquare, Phone, Search, Send, X, Modal, Progress, Textarea, Link, money, relative, useMemo, useState };
