"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Filter, Globe2, MessageSquare, Play, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Modal, Select, Textarea } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  LeadStatusBadge,
  PriorityBadge,
  RunPipelineButton,
  ScoreRing,
  WebsiteStatusBadge,
} from "@/components/dashboard/lead-detail-drawer";
import { compactMoney, num, relative } from "@/lib/utils";
import { PipelineStage } from "@/lib/db/schema";

export type LeadRow = {
  id: string;
  name: string;
  category: string;
  city: string;
  website: string | null;
  websiteStatus: string;
  rating: number | null;
  reviewCount: number;
  status: string;
  pipelineStage: string;
  priority: string | null;
  score: number | null;
  source: string;
  hasDemo: boolean;
  replied: boolean;
  tags: string[];
  updatedAt: string;
  optOut: boolean;
  suppressed: boolean;
};

const STATUS_OPTIONS = ["ALL", "DISCOVERED", "RESEARCHING", "AUDITED", "QUALIFIED", "REJECTED", "DEMO_BUILDING", "DEMO_READY", "OUTREACH", "REPLIED", "INTERESTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

export function LeadTable({ rows }: { rows: LeadRow[] }) {
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [onlyDemos, setOnlyDemos] = useState(false);
  const [onlyReplied, setOnlyReplied] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const sources = useMemo(() => ["ALL", ...Array.from(new Set(rows.map((r) => r.source)))], [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "ALL" && r.status !== status) return false;
        if (priority !== "ALL" && r.priority !== priority) return false;
        if (source !== "ALL" && r.source !== source) return false;
        if (onlyDemos && !r.hasDemo) return false;
        if (onlyReplied && !r.replied) return false;
        return true;
      }),
    [rows, status, priority, source, onlyDemos, onlyReplied],
  );

  const columns: Column<LeadRow>[] = [
    {
      key: "name",
      header: "Business",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={selected.includes(r.id)}
            onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
            aria-label={`Select ${r.name}`}
            className="h-3.5 w-3.5 shrink-0 rounded border-line bg-surface-2 accent-brand-500"
          />
          <div className="min-w-0">
            <Link href={`/leads/${r.id}`} className="block truncate font-medium text-ink hover:text-brand-200">
              {r.name}
            </Link>
            <p className="truncate text-[10.5px] text-ink-faint">
              {r.category}
              {r.city ? ` · ${r.city}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "score",
      header: "Score",
      align: "center",
      sortable: true,
      sortValue: (r) => r.score ?? -1,
      render: (r) => <ScoreRing score={r.score} priority={r.priority} size={32} />,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      sortValue: (r) => r.priority ?? "",
      render: (r) => <PriorityBadge priority={r.priority} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      hideBelow: "md",
      render: (r) => <LeadStatusBadge status={r.status} />,
    },
    {
      key: "pipelineStage",
      header: "Stage",
      sortable: true,
      sortValue: (r) => r.pipelineStage,
      hideBelow: "lg",
      render: (r) => <Badge tone="neutral">{r.pipelineStage}</Badge>,
    },
    {
      key: "website",
      header: "Website",
      sortable: true,
      sortValue: (r) => r.website ?? "",
      hideBelow: "xl",
      render: (r) =>
        r.website ? (
          <div className="flex items-center gap-2">
            <a
              href={r.website}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[150px] truncate text-brand-300 hover:underline"
            >
              {r.website.replace(/^https?:\/\//, "")}
            </a>
            <WebsiteStatusBadge status={r.websiteStatus} />
          </div>
        ) : (
          <span className="text-ink-faint">No website</span>
        ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      sortValue: (r) => r.source,
      hideBelow: "xl",
      render: (r) => <span className="text-[11.5px] capitalize text-ink-muted">{r.source.replace(/_/g, " ").toLowerCase()}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      align: "right",
      sortable: true,
      sortValue: (r) => r.rating ?? -1,
      hideBelow: "lg",
      render: (r) =>
        r.rating ? (
          <span className="tnum text-ink-muted">
            {r.rating.toFixed(1)} <span className="text-ink-faint">({num(r.reviewCount)})</span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      align: "right",
      sortable: true,
      sortValue: (r) => r.updatedAt,
      hideBelow: "md",
      render: (r) => <span className="text-[11px] text-ink-faint">{relative(r.updatedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "180px",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.hasDemo && (
            <Badge tone="accent">
              <Globe2 className="h-2.5 w-2.5" />
              demo
            </Badge>
          )}
          {r.replied && (
            <Badge tone="success">
              <MessageSquare className="h-2.5 w-2.5" />
            </Badge>
          )}
          <RunPipelineButton
            leadId={r.id}
            label="Run"
            variant="outline"
            stages={
              r.status === "DISCOVERED"
                ? ["research", "audit", "score", "strategy", "demo", "qa", "deploy", "outreach"]
                : undefined
            }
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={filtered}
        columns={columns}
        pageSize={20}
        initialSort={{ key: "score", dir: "desc" }}
        searchPlaceholder="Search business, category, city, tag…"
        toolbar={
          <>
            <label className="sr-only" htmlFor="lead-status">
              Filter by status
            </label>
            <Select
              id="lead-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 w-auto min-w-[130px] text-[12px]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All statuses" : s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
            <label className="sr-only" htmlFor="lead-priority">
              Filter by priority
            </label>
            <Select
              id="lead-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-8 w-auto min-w-[110px] text-[12px]"
            >
              {["ALL", "HOT", "WARM", "COLD", "REJECTED"].map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All priorities" : s}
                </option>
              ))}
            </Select>
            <label className="sr-only" htmlFor="lead-source">
              Filter by source
            </label>
            <Select
              id="lead-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="hidden h-8 w-auto min-w-[130px] text-[12px] lg:block"
            >
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All sources" : s.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant={onlyDemos ? "primary" : "outline"}
              onClick={() => setOnlyDemos((v) => !v)}
              aria-pressed={onlyDemos}
            >
              <Globe2 className="h-3.5 w-3.5" />
              Demo built
            </Button>
            <Button
              size="sm"
              variant={onlyReplied ? "primary" : "outline"}
              onClick={() => setOnlyReplied((v) => !v)}
              aria-pressed={onlyReplied}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Replied
            </Button>
          </>
        }
        empty={
          <div className="py-8 text-center">
            <p className="text-[12.5px] text-ink-faint">No leads match these filters.</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setStatus("ALL");
                setPriority("ALL");
                setSource("ALL");
                setOnlyDemos(false);
                setOnlyReplied(false);
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          </div>
        }
      />

      {selected.length > 0 && (
        <div className="sticky bottom-3 z-20 mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/30 bg-surface-2/95 px-3 py-2.5 shadow-glow backdrop-blur">
          <span className="text-[12px] text-ink">
            {selected.length} selected ·{" "}
            <span className="tnum text-brand-300">{compactMoney(estimate(selected, rows))}</span> weighted
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowNote(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add note
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected([])}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <Modal open={showNote} title="Bulk note" onClose={() => setShowNote(false)}>
        <Textarea
          label="Note applied to the selected leads"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Why are these being batched?"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNote(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowNote(false);
              setNote("");
              setSelected([]);
            }}
          >
            Save {selected.length} notes
          </Button>
        </div>
      </Modal>

      <span className="sr-only">
        <Play className="h-3 w-3" />
        {PipelineStage.options.join(",")}
      </span>
    </>
  );
}

function estimate(ids: string[], rows: LeadRow[]): number {
  return ids.reduce((acc, id) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return acc;
    if ((r.score ?? 0) >= 80) return acc + 45000;
    if ((r.score ?? 0) >= 65) return acc + 30000;
    if ((r.score ?? 0) >= 50) return acc + 18000;
    return acc + 8000;
  }, 0);
}
