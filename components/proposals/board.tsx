"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Eye, Send, X } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { compactMoney, dateTime, money, num, relative } from "@/lib/utils";

export type ProposalCard = {
  id: string;
  number: string;
  title: string;
  status: string;
  statusTone: "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  validUntil: string | null;
  sentAt: string | null;
  clientName: string;
  leadId: string | null;
  clientId: string | null;
  problem: string;
  proposedSolution: string;
  pages: string[];
  functionality: string[];
  deliverables: string[];
  milestones: Array<{ id: string; name: string; description: string; days: number; amount: number; status: string }>;
  upgradeOptions: Array<{ id: string; label: string; price: number }>;
  revisionPolicy: string;
  maintenanceTerms: string;
  hostingTerms: string;
  createdAt: string;
  lineItems: Array<{ id: string; label: string; description: string; quantity: number; unitPrice: number; total: number; kind: string }>;
};

export function ProposalBoard({ proposals }: { proposals: ProposalCard[] }) {
  const [open, setOpen] = useState<ProposalCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/proposals/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setFeedback(json.error ?? "Could not update the proposal");
        return;
      }
      setOpen(null);
      window.location.reload();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ProposalCard>[] = [
    {
      key: "number",
      header: "Proposal",
      sortable: true,
      sortValue: (p) => p.number,
      render: (p) => (
        <div className="min-w-0">
          <button type="button" onClick={() => setOpen(p)} className="block truncate font-medium text-ink hover:text-brand-200">
            {p.number}
          </button>
          <p className="truncate text-[10.5px] text-ink-faint">{p.title}</p>
        </div>
      ),
    },
    {
      key: "clientName",
      header: "Client",
      sortable: true,
      sortValue: (p) => p.clientName,
      render: (p) =>
        p.leadId ? (
          <Link href={`/leads/${p.leadId}`} className="truncate text-ink hover:text-brand-200">
            {p.clientName}
          </Link>
        ) : (
          <span className="text-ink">{p.clientName}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (p) => p.status,
      render: (p) => <Badge tone={p.statusTone}>{p.status.replace(/_/g, " ").toLowerCase()}</Badge>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (p) => p.total,
      render: (p) => <span className="tnum font-semibold text-ink">{money(p.total, p.currency)}</span>,
    },
    {
      key: "items",
      header: "Lines",
      align: "center",
      hideBelow: "lg",
      render: (p) => <span className="tnum text-ink-muted">{p.lineItems.length}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      align: "right",
      sortable: true,
      sortValue: (p) => p.createdAt,
      hideBelow: "md",
      render: (p) => <span className="text-[11px] text-ink-faint">{relative(p.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "150px",
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setOpen(p)} aria-label={`View ${p.number}`}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {p.status === "DRAFT" || p.status === "WAITING_APPROVAL" ? (
            <Button size="sm" onClick={() => setStatus(p.id, "SENT")} loading={busy}>
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={proposals}
        columns={columns}
        pageSize={20}
        initialSort={{ key: "createdAt", dir: "desc" }}
        searchPlaceholder="Search proposal, client, title…"
      />

      <Modal open={Boolean(open)} title={open ? `${open.number} — ${open.clientName}` : "Proposal"} onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={open.statusTone}>{open.status.replace(/_/g, " ").toLowerCase()}</Badge>
              <span className="text-[11.5px] text-ink-faint">
                Created {dateTime(open.createdAt)}
                {open.sentAt ? ` · sent ${relative(open.sentAt)}` : ""}
                {open.validUntil ? ` · valid until ${dateTime(open.validUntil)}` : ""}
              </span>
            </div>

            <p className="text-[13px] leading-relaxed text-ink">{open.title}</p>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2/60">
                    <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                      Line item
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                      Unit
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {open.lineItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[12px] text-ink-faint">
                        No line items recorded.
                      </td>
                    </tr>
                  )}
                  {open.lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-line/40 last:border-0">
                      <td className="px-3 py-2 text-ink">{item.description}</td>
                      <td className="tnum px-3 py-2 text-right text-ink-muted">{num(item.quantity)}</td>
                      <td className="tnum px-3 py-2 text-right text-ink-muted">{money(item.unitPrice, open.currency)}</td>
                      <td className="tnum px-3 py-2 text-right text-ink">{money(item.total, open.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <td colSpan={3} className="px-3 py-1.5 text-right text-[11.5px] text-ink-muted">
                      Subtotal
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-ink">{money(open.subtotal, open.currency)}</td>
                  </tr>
                  {open.discount > 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-1.5 text-right text-[11.5px] text-ink-muted">
                        Discount
                      </td>
                      <td className="tnum px-3 py-1.5 text-right text-emerald-300">
                        −{money(open.discount, open.currency)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-line bg-surface-2/40">
                    <td colSpan={3} className="px-3 py-2 text-right text-[12px] font-semibold text-ink">
                      Total
                    </td>
                    <td className="tnum px-3 py-2 text-right text-[13px] font-semibold text-ink-strong">
                      {money(open.total, open.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Problem", open.problem],
                ["Proposed solution", open.proposedSolution],
                ["Revision policy", open.revisionPolicy],
                ["Maintenance", open.maintenanceTerms],
                ["Hosting", open.hostingTerms],
              ]
                .filter(([, v]) => Boolean(v))
                .map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line bg-surface-2/40 p-2.5">
                    <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">{k}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{v}</p>
                  </div>
                ))}
            </div>

            {(open.pages.length > 0 || open.functionality.length > 0 || open.deliverables.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Pages", open.pages],
                  ["Functionality", open.functionality],
                  ["Deliverables", open.deliverables],
                ].map(([k, list]) => (
                  <div key={k as string}>
                    <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">{k as string}</p>
                    <ul className="mt-1 space-y-0.5">
                      {(list as string[]).map((item, i) => (
                        <li key={i} className="text-[11.5px] leading-relaxed text-ink">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {open.milestones.length > 0 && (
              <div className="rounded-lg border border-line">
                <p className="border-b border-line px-3 py-2 text-[10.5px] uppercase tracking-wider text-ink-faint">
                  Milestones
                </p>
                <ul className="divide-y divide-line/50">
                  {open.milestones.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-ink">{m.name}</p>
                        <p className="truncate text-[10.5px] text-ink-faint">{m.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tnum text-[12px] text-ink">{money(m.amount, open.currency)}</p>
                        <p className="text-[10px] text-ink-faint">
                          {m.days}d · {m.status.toLowerCase()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {open.upgradeOptions.length > 0 && (
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Upgrade options</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {open.upgradeOptions.map((u) => (
                    <Badge key={u.id} tone="neutral">
                      {u.label} · {money(u.price, open.currency)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {feedback && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11.5px] text-red-200">
                {feedback}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
                Close
              </Button>
              {open.status !== "REJECTED" && open.status !== "ACCEPTED" && (
                <Button variant="danger" size="sm" loading={busy} onClick={() => setStatus(open.id, "REJECTED")}>
                  <X className="h-3.5 w-3.5" />
                  Mark rejected
                </Button>
              )}
              {open.status !== "SENT" && open.status !== "ACCEPTED" && (
                <Button size="sm" loading={busy} onClick={() => setStatus(open.id, "SENT")}>
                  <Send className="h-3.5 w-3.5" />
                  Mark sent
                </Button>
              )}
              {open.status !== "ACCEPTED" && (
                <Button size="sm" variant="success" loading={busy} onClick={() => setStatus(open.id, "ACCEPTED")}>
                  <Check className="h-3.5 w-3.5" />
                  Accept & create client
                </Button>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-ink-faint">
              Accepting a proposal creates the client, the onboarding checklist and the first project, and records the
              revenue event. Value shown: {compactMoney(open.total, open.currency)}.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
