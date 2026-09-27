import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Circle, ExternalLink, GitBranch } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageBody } from "@/components/shared/page-header";
import { Badge, Button, Card, CardBody, CardHeader, Progress } from "@/components/ui";
import { DataRow } from "@/components/dashboard/lead-detail-drawer";
import { ProjectStageControl } from "@/components/projects/stage-control";
import { compactMoney, dateTime, money, num, relative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const project = await db.byId("projects", id);
  if (!project || project.organizationId !== orgId) notFound();

  const [client, requirements, builds, tasks, events] = await Promise.all([
    client_or_null(project.clientId),
    db.find("project_requirements", { organizationId: orgId, projectId: project.id }),
    db.find("website_builds", { organizationId: orgId, projectId: project.id }),
    db.find("agent_tasks", { organizationId: orgId }),
    db.find("activity_events", { organizationId: orgId, projectId: project.id }),
  ]);

  const myTasks = tasks.filter((t) => t.entityType === "project" && t.entityId === project.id);
  const done = requirements.filter((r) => r.status === "DONE").length;

  return (
    <>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <Link
          href="/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All projects
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[19px] font-semibold tracking-tight text-ink-strong">{project.name}</h1>
              <Badge tone="brand">{project.stage}</Badge>
              {builds[0] && <Badge tone="neutral">{builds[0].status.toLowerCase()}</Badge>}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {client ? (
                <Link href={`/clients/${client.id}`} className="text-brand-300 hover:text-brand-200">
                  {client.name}
                </Link>
              ) : (
                "Unknown client"
              )}{" "}
              · {project.serviceKey.replace(/-/g, " ")} · {project.progress}% complete
            </p>
            <div className="mt-3 max-w-md">
              <Progress value={project.progress} />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <ProjectStageControl projectId={project.id} current={project.stage} />
            <div className="flex gap-2">
              {project.repositoryUrl && (
                <a href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <GitBranch className="h-3.5 w-3.5" />
                    Repo
                  </Button>
                </a>
              )}
              {project.previewUrl && (
                <a href={project.previewUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                </a>
              )}
              {project.productionUrl && (
                <a href={project.productionUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="success">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Live
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <PageBody>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Requirements"
              subtitle={`${num(done)} of ${num(requirements.length)} done`}
            />
            <CardBody className="space-y-1.5">
              {requirements.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">
                  No requirements captured. The production builder derives them from the onboarding submission.
                </p>
              ) : (
                requirements.map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 rounded-lg border border-line/50 px-2.5 py-2">
                    {r.status === "DONE" ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : r.status === "IN_PROGRESS" ? (
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
                    ) : (
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-ink">{r.title}</p>
                      {r.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{r.detail}</p>}
                    </div>
                    <Badge tone={r.status === "DONE" ? "success" : r.status === "IN_PROGRESS" ? "brand" : "neutral"}>
                      {r.status.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Commercials" />
              <CardBody>
                <DataRow label="Contract value">{money(project.value)}</DataRow>
                <DataRow label="Created">{dateTime(project.createdAt)}</DataRow>
                <DataRow label="Due">
                  {project.dueDate ? (
                    <span className={new Date(project.dueDate) < new Date() ? "text-amber-300" : ""}>
                      {dateTime(project.dueDate)} ({relative(project.dueDate)})
                    </span>
                  ) : (
                    "No due date"
                  )}
                </DataRow>
                <DataRow label="Progress">
                  <span className="tnum">{project.progress}%</span>
                </DataRow>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
                  <CalendarClock className="h-3 w-3" />
                  Updated {relative(project.updatedAt)}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Agent tasks" subtitle={`${num(myTasks.length)} linked`} />
              <CardBody className="space-y-1.5">
                {myTasks.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted">No tasks linked to this project.</p>
                ) : (
                  myTasks.slice(0, 10).map((t) => (
                    <div key={t.id} className="rounded-lg border border-line/50 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-medium text-ink">{t.agentKey}</p>
                        <Badge tone={t.status === "FAILED" ? "danger" : t.status === "COMPLETED" ? "success" : "brand"}>
                          {t.status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">{t.type}</p>
                      {t.error && <p className="mt-1 text-[10.5px] leading-relaxed text-red-300">{t.error}</p>}
                      <Progress value={t.progress} className="mt-1.5" />
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {events.length > 0 && (
          <Card>
            <CardHeader title="Delivery history" subtitle={`${num(events.length)} events`} />
            <CardBody>
              <ul className="space-y-2">
                {events
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 15)
                  .map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2 last:border-0">
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-ink">{e.title}</p>
                        {e.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{e.detail}</p>}
                      </div>
                      <span className="shrink-0 text-[10.5px] text-ink-faint">{relative(e.createdAt)}</span>
                    </li>
                  ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <p className="px-1 text-[11px] text-ink-faint">
          Build {builds[0] ? `#${builds[0].id.slice(0, 8)} · ${builds[0].status.toLowerCase()}` : "not started"}.
        </p>
      </PageBody>
    </>
  );
}

async function client_or_null(clientId: string) {
  return db.byId("clients", clientId);
}
