"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronRight, Shield, X } from "lucide-react";
import { Badge, Button, Modal, Textarea } from "@/components/ui";
import { RiskBadge } from "@/components/dashboard/lead-detail-drawer";
import { dateTime, relative } from "@/lib/utils";

export type ApprovalItem = {
  id: string;
  action: string;
  title: string;
  reason: string;
  requestingAgent: string | null;
  permissionLevel: string;
  riskLevel: string;
  status: string;
  payload: Record<string, unknown>;
  decisionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  entityType: string;
  entityId: string;
};

const ENTITY_HREF: Record<string, string> = {
  lead: "/leads",
  proposal: "/proposals",
  demo: "/websites",
  build: "/websites",
  client: "/clients",
  project: "/projects",
};

export function ApprovalList({
  items,
  canDecide,
  autonomyPaused,
}: {
  items: ApprovalItem[];
  canDecide: boolean;
  autonomyPaused: boolean;
}) {
  const [open, setOpen] = useState<ApprovalItem | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${open.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        executed?: boolean;
        result?: string;
      };
      if (!res.ok || json.error) {
        setError(json.error ?? "The decision could not be recorded");
        return;
      }
      setOpen(null);
      setNote("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface-2 text-emerald-300">
          <Check className="h-4 w-4" />
        </span>
        <p className="text-[13px] font-medium text-ink">Nothing waiting for approval</p>
        <p className="max-w-sm text-[12px] leading-relaxed text-ink-muted">
          NEXORA will pause and ask here before anything irreversible — production deployments, external sends and
          proposal dispatch.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const href = ENTITY_HREF[item.entityType];
          return (
            <li key={item.id} className="p-3.5 transition-colors hover:bg-white/[0.02]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.status === "PENDING" ? (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                      </span>
                    ) : null}
                    <p className="text-[13px] font-medium leading-snug text-ink">{item.title}</p>
                  </div>
                  <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-muted">{item.reason}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={item.permissionLevel === "RED" ? "danger" : "warning"}>{item.permissionLevel}</Badge>
                    <RiskBadge level={item.riskLevel} />
                    <Badge tone="neutral">{item.action}</Badge>
                    {item.requestingAgent && <Badge tone="brand">{item.requestingAgent}</Badge>}
                    <span className="text-[10.5px] text-ink-faint">raised {relative(item.createdAt)}</span>
                    {href && (
                      <Link href={`${href}/${item.entityId}`} className="text-[10.5px] text-brand-300 hover:text-brand-200">
                        View {item.entityType} →
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.status === "PENDING" ? (
                    canDecide ? (
                      <Button size="sm" onClick={() => setOpen(item)}>
                        <Shield className="h-3.5 w-3.5" />
                        Review
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Badge tone="warning">owner only</Badge>
                    )
                  ) : (
                    <div className="text-right">
                      <Badge tone={item.status === "APPROVED" ? "success" : item.status === "REJECTED" ? "danger" : "neutral"}>
                        {item.status.toLowerCase()}
                      </Badge>
                      <p className="mt-0.5 text-[10.5px] text-ink-faint">
                        {item.resolvedAt ? dateTime(item.resolvedAt) : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {item.decisionNote && (
                <p className="mt-2 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-[11.5px] text-ink-muted">
                  {item.decisionNote}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Modal open={Boolean(open)} title={open?.title ?? "Approval"} onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={open.permissionLevel === "RED" ? "danger" : "warning"}>{open.permissionLevel}</Badge>
              <RiskBadge level={open.riskLevel} />
              <Badge tone="neutral">{open.action}</Badge>
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink">{open.reason}</p>

            <div className="rounded-lg border border-line bg-surface-2/50 p-3">
              <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Payload</p>
              <pre className="mt-1.5 max-h-40 overflow-auto text-[11px] leading-relaxed text-ink-muted">
                {JSON.stringify(open.payload, null, 2)}
              </pre>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <p className="text-[11.5px] leading-relaxed text-amber-200/90">
                Approving lets the requesting agent execute this action immediately. Rejecting closes the request and the
                agent records the decision on the activity feed.
                {autonomyPaused ? " Autonomy is currently paused, so execution may be deferred until you resume." : ""}
              </p>
            </div>

            <Textarea
              label="Decision note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why are you approving or rejecting this?"
            />

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11.5px] text-red-200">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" loading={busy} onClick={() => decide("REJECTED")}>
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
              <Button size="sm" loading={busy} onClick={() => decide("APPROVED")}>
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
