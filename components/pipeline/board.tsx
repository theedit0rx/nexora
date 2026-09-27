"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Globe2, GripVertical, MessageSquare, Send, X } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { PriorityBadge, ScoreRing } from "@/components/dashboard/lead-detail-drawer";
import { cn, compactMoney, relative } from "@/lib/utils";

export type BoardLead = {
  id: string;
  name: string;
  category: string;
  city: string;
  score: number | null;
  priority: string | null;
  status: string;
  lastActivity: string | null;
  estimatedValue: number | null;
  waitingOn: string | null;
  hasDemo: boolean;
  replied: boolean;
};

export type BoardColumn = { stage: string; count: number; value: number };

const STAGE_TINT: Record<string, string> = {
  Discovered: "border-t-slate-500",
  Researching: "border-t-sky-500",
  Audited: "border-t-indigo-500",
  Qualified: "border-t-emerald-500",
  "Demo Building": "border-t-violet-500",
  "Demo Ready": "border-t-fuchsia-500",
  Outreach: "border-t-amber-500",
  Replied: "border-t-cyan-500",
  Interested: "border-t-teal-500",
  Proposal: "border-t-orange-500",
  Negotiation: "border-t-yellow-500",
  Won: "border-t-emerald-400",
  Lost: "border-t-slate-600",
};

export function PipelineBoard({
  leads,
  stages,
  autonomyPaused,
}: {
  leads: BoardLead[];
  stages: string[];
  autonomyPaused: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [detail, setDetail] = useState<BoardLead | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<string, BoardLead[]>();
    for (const stage of stages) map.set(stage, []);
    for (const lead of leads) {
      const list = map.get(lead.status);
      if (list) list.push(lead);
    }
    return map;
  }, [leads, stages]);

  async function move(leadId: string, stage: string) {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/pipeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      setToast(json.ok ? `Moved to ${stage}` : (json.error ?? "Move failed"));
      if (json.ok) {
        // Reload server-rendered data without a full navigation.
        window.location.reload();
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Move failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {stages.map((stage) => {
          const items = byStage.get(stage) ?? [];
          const value = items.reduce((acc, l) => acc + (l.estimatedValue ?? 0), 0);
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/lead-id") || dragging;
                if (id) move(id, stage);
              }}
              className={cn(
                "flex w-[268px] shrink-0 flex-col rounded-xl border border-line border-t-2 bg-surface-1/40 transition-colors",
                STAGE_TINT[stage] ?? "border-t-slate-600",
                over === stage && "border-brand-500/60 bg-brand-500/5",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[12px] font-semibold text-ink">{stage}</h3>
                  <p className="tnum text-[10.5px] text-ink-faint">
                    {items.length} {items.length === 1 ? "lead" : "leads"}
                    {value > 0 && ` · ${compactMoney(value)}`}
                  </p>
                </div>
                <Badge tone="neutral">{items.length}</Badge>
              </header>
              <div className="flex max-h-[calc(100vh-330px)] min-h-[120px] flex-col gap-2 overflow-y-auto p-2">
                {items.length === 0 && (
                  <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-ink-faint">
                    Drag a lead here or use the stage menu on a lead.
                  </p>
                )}
                {items.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/lead-id", lead.id);
                      setDragging(lead.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      "group cursor-grab rounded-lg border border-line bg-surface-2/60 p-2.5 transition-all active:cursor-grabbing",
                      dragging === lead.id && "opacity-40",
                      "hover:border-brand-500/40 hover:bg-surface-2",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                      <button type="button" onClick={() => setDetail(lead)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-[12.5px] font-medium leading-snug text-ink">{lead.name}</p>
                        <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">
                          {lead.category}
                          {lead.city ? ` · ${lead.city}` : ""}
                        </p>
                      </button>
                      <ScoreRing score={lead.score} priority={lead.priority} size={30} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {lead.hasDemo && (
                        <Badge tone="accent">
                          <Globe2 className="h-2.5 w-2.5" />
                          demo
                        </Badge>
                      )}
                      {lead.replied && (
                        <Badge tone="success">
                          <MessageSquare className="h-2.5 w-2.5" />
                          replied
                        </Badge>
                      )}
                      {lead.waitingOn && (
                        <Badge tone="warning">
                          <Clock className="h-2.5 w-2.5" />
                          {lead.waitingOn}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-ink-faint">
                        {lead.lastActivity ? relative(lead.lastActivity) : "no activity"}
                      </span>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-[10.5px] font-medium text-brand-300 hover:text-brand-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {detail && (
        <Modal open title={detail.name} onClose={() => setDetail(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ScoreRing score={detail.score} priority={detail.priority} size={46} />
              <div>
                <PriorityBadge priority={detail.priority} />
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  {detail.category}
                  {detail.city ? ` · ${detail.city}` : ""}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Move to stage</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stages.map((stage) => (
                  <Button
                    key={stage}
                    size="sm"
                    variant={stage === detail.status ? "primary" : "outline"}
                    disabled={saving || stage === detail.status}
                    onClick={() => move(detail.id, stage)}
                  >
                    {stage}
                  </Button>
                ))}
              </div>
              {autonomyPaused && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  Autonomy is paused — manual moves still work, but agents will not act.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Link href={`/leads/${detail.id}`}>
                <Button size="sm">Open lead</Button>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-90 -translate-x-1/2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink shadow-glow lg:bottom-6">
          {toast}
          <button type="button" onClick={() => setToast(null)} className="ml-2 text-ink-faint hover:text-ink">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {saving && (
        <div className="fixed bottom-6 right-6 z-90 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-muted shadow-glow">
          <Send className="mr-1.5 inline h-3 w-3 animate-pulse" />
          Saving…
        </div>
      )}

    </>
  );
}
