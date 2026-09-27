"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, ExternalLink, GitBranch, ListChecks } from "lucide-react";
import { Badge, Button, Modal, Progress } from "@/components/ui";
import { cn, compactMoney, relative } from "@/lib/utils";

export type ProjectItem = {
  id: string;
  name: string;
  clientName: string;
  clientId: string;
  stage: string;
  progress: number;
  value: number;
  dueDate: string;
  previewUrl: string | null;
  productionUrl: string | null;
  repositoryUrl: string | null;
  serviceKey: string;
  requirements: number;
  buildStatus: string | null;
  openTasks: number;
  createdAt: string;
};

const STAGE_TINT: Record<string, string> = {
  Planning: "border-t-sky-500",
  Building: "border-t-indigo-500",
  QA: "border-t-amber-500",
  "Client Review": "border-t-fuchsia-500",
  Deployment: "border-t-teal-500",
  Completed: "border-t-emerald-400",
  Maintenance: "border-t-emerald-600",
};

const BUILD_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent"> = {
  QUEUED: "neutral",
  BUILDING: "brand",
  BUILT: "brand",
  QA_FAILED: "danger",
  READY: "success",
  FAILED: "danger",
};

export function ProjectBoard({ items, stages }: { items: ProjectItem[]; stages: string[] }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const byStage = new Map<string, ProjectItem[]>();
  for (const stage of stages) byStage.set(stage, []);
  for (const item of items) {
    const list = byStage.get(item.stage);
    if (list) list.push(item);
  }

  async function move(projectId: string, stage: string) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/stage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setToast(json.error ?? "Move failed");
        return;
      }
      setToast(`Moved to ${stage}`);
      window.location.reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Move failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {stages.map((stage) => {
          const list = byStage.get(stage) ?? [];
          const value = list.reduce((a, p) => a + p.value, 0);
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
                const id = e.dataTransfer.getData("text/project-id") || dragging;
                if (id) move(id, stage);
              }}
              className={cn(
                "flex w-[264px] shrink-0 flex-col rounded-xl border border-line border-t-2 bg-surface-1/40 transition-colors",
                STAGE_TINT[stage] ?? "border-t-slate-600",
                over === stage && "border-brand-500/60 bg-brand-500/5",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[12px] font-semibold text-ink">{stage}</h3>
                  <p className="tnum text-[10.5px] text-ink-faint">
                    {list.length} {list.length === 1 ? "project" : "projects"}
                    {value > 0 && ` · ${compactMoney(value)}`}
                  </p>
                </div>
                <Badge tone="neutral">{list.length}</Badge>
              </header>
              <div className="flex max-h-[calc(100vh-330px)] min-h-[110px] flex-col gap-2 overflow-y-auto p-2">
                {list.length === 0 && (
                  <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-ink-faint">
                    Drag a project here.
                  </p>
                )}
                {list.map((project) => (
                  <article
                    key={project.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/project-id", project.id);
                      setDragging(project.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      "cursor-grab rounded-lg border border-line bg-surface-2/60 p-2.5 transition-all active:cursor-grabbing hover:border-brand-500/40",
                      dragging === project.id && "opacity-40",
                    )}
                  >
                    <button type="button" onClick={() => setDetail(project)} className="block w-full text-left">
                      <p className="truncate text-[12.5px] font-medium text-ink">{project.name}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">{project.clientName}</p>
                    </button>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="tnum text-[11px] font-semibold text-ink">{compactMoney(project.value)}</span>
                      <span className="text-[10px] text-ink-faint">
                        {project.dueDate ? `due ${relative(project.dueDate)}` : "no date"}
                      </span>
                    </div>
                    <Progress value={project.progress} className="mt-1.5" />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {project.buildStatus && (
                        <Badge tone={BUILD_TONE[project.buildStatus] ?? "neutral"}>{project.buildStatus.toLowerCase()}</Badge>
                      )}
                      {project.requirements > 0 && (
                        <Badge tone="neutral">
                          <ListChecks className="h-2.5 w-2.5" />
                          {project.requirements}
                        </Badge>
                      )}
                      {project.openTasks > 0 && <Badge tone="warning">{project.openTasks} tasks</Badge>}
                      {project.productionUrl && <Badge tone="success">live</Badge>}
                    </div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="mt-2 block text-[10.5px] font-medium text-brand-300 hover:text-brand-200"
                    >
                      Open project →
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Modal open={Boolean(detail)} title={detail?.name ?? "Project"} onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{detail.clientName}</Badge>
              <Badge tone="brand">{detail.stage}</Badge>
              <span className="tnum text-[12px] text-ink">{compactMoney(detail.value)}</span>
            </div>
            <p className="text-[11.5px] text-ink-muted">
              {detail.serviceKey.replace(/-/g, " ")} · {detail.requirements} requirements · {detail.openTasks} open tasks
            </p>
            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Move to stage</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stages.map((stage) => (
                  <Button
                    key={stage}
                    size="sm"
                    variant={stage === detail.stage ? "primary" : "outline"}
                    disabled={busy || stage === detail.stage}
                    onClick={() => move(detail.id, stage)}
                  >
                    {stage}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.repositoryUrl && (
                <a href={detail.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <GitBranch className="h-3.5 w-3.5" />
                    Repository
                  </Button>
                </a>
              )}
              {detail.previewUrl && (
                <a href={detail.previewUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                </a>
              )}
              {detail.productionUrl && (
                <a href={detail.productionUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="success">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Live site
                  </Button>
                </a>
              )}
              <Link href={`/projects/${detail.id}`}>
                <Button size="sm">Open project</Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-90 -translate-x-1/2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink shadow-glow">
          {toast}
        </div>
      )}

      <span className="hidden">
        <CalendarClock className="h-3 w-3" />
      </span>
    </>
  );
}
