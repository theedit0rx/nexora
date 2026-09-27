"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge, Button, Modal, Select, Textarea } from "@/components/ui";
import { dateTime, relative } from "@/lib/utils";

export type SupportItem = {
  id: string;
  subject: string;
  body: string;
  category: string;
  status: string;
  statusTone: "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";
  priority: string;
  priorityTone: "neutral" | "warning" | "danger" | "success";
  sentiment: string;
  suggestedAction: string;
  resolution: string | null;
  clientName: string;
  clientId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function SupportList({ items }: { items: SupportItem[] }) {
  const [open, setOpen] = useState<SupportItem | null>(null);
  const [status, setStatus] = useState(items[0]?.status ?? "OPEN");
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/${open.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, resolution: resolution || undefined }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Could not update the ticket");
        return;
      }
      setOpen(null);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((ticket) => (
          <li key={ticket.id} className="p-3.5 transition-colors hover:bg-white/[0.02]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium leading-snug text-ink">{ticket.subject}</p>
                  <Badge tone={ticket.priorityTone}>{ticket.priority.toLowerCase()}</Badge>
                  <Badge tone={ticket.statusTone}>{ticket.status.replace(/_/g, " ").toLowerCase()}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 max-w-2xl text-[12px] leading-relaxed text-ink-muted">{ticket.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{ticket.category.replace(/_/g, " ").toLowerCase()}</Badge>
                  <Badge tone={ticket.sentiment === "NEGATIVE" ? "danger" : ticket.sentiment === "POSITIVE" ? "success" : "neutral"}>
                    {ticket.sentiment.toLowerCase()}
                  </Badge>
                  {ticket.clientId ? (
                    <Link href={`/clients/${ticket.clientId}`} className="text-[10.5px] text-brand-300 hover:text-brand-200">
                      {ticket.clientName}
                    </Link>
                  ) : (
                    <span className="text-[10.5px] text-ink-faint">{ticket.clientName}</span>
                  )}
                  <span className="text-[10.5px] text-ink-faint">opened {relative(ticket.createdAt)}</span>
                </div>
                {ticket.suggestedAction && (
                  <p className="mt-2 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                    <span className="font-medium text-ink">Suggested action:</span> {ticket.suggestedAction}
                  </p>
                )}
                {ticket.resolution && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-emerald-200/90">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                    {ticket.resolution}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  setOpen(ticket);
                  setStatus(ticket.status);
                  setResolution(ticket.resolution ?? "");
                }}>
                  Manage
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={Boolean(open)} title={open?.subject ?? "Ticket"} onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-4">
            <p className="text-[12.5px] leading-relaxed text-ink">{open.body}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="neutral">{open.category.replace(/_/g, " ").toLowerCase()}</Badge>
              <Badge tone={open.priorityTone}>{open.priority.toLowerCase()}</Badge>
              <span className="text-[11px] text-ink-faint">opened {dateTime(open.createdAt)}</span>
            </div>

            <Select
              id="ticket-status"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </Select>

            <Textarea
              label="Resolution note"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              placeholder="What was done to resolve this?"
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
              <Button size="sm" loading={busy} onClick={save}>
                {busy ? <Loader2 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Save ticket
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
