import Link from "next/link";
import { KanbanSquare, Rocket } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { ProjectBoard } from "@/components/projects/board";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { compactMoney, num } from "@/lib/utils";
import { ProjectStage } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [projects, clients, requirements, builds, tasks] = await Promise.all([
    db.find("projects", { organizationId: orgId }),
    db.find("clients", { organizationId: orgId }),
    db.find("project_requirements", { organizationId: orgId }),
    db.find("website_builds", { organizationId: orgId }),
    db.find("agent_tasks", { organizationId: orgId }),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const reqByProject = new Map<string, number>();
  for (const r of requirements) reqByProject.set(r.projectId, (reqByProject.get(r.projectId) ?? 0) + 1);
  const buildByProject = new Map(builds.map((b) => [b.projectId, b]));
  const openTasksByProject = new Map<string, number>();
  for (const t of tasks) {
    if (t.entityType === "project" && t.status !== "COMPLETED" && t.status !== "CANCELLED") {
      openTasksByProject.set(t.entityId, (openTasksByProject.get(t.entityId) ?? 0) + 1);
    }
  }

  const items = projects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: clientById.get(p.clientId)?.name ?? "Unknown client",
    clientId: p.clientId,
    stage: p.stage,
    progress: p.progress,
    value: p.value,
    dueDate: p.dueDate ?? "",
    previewUrl: p.previewUrl,
    productionUrl: p.productionUrl,
    repositoryUrl: p.repositoryUrl,
    serviceKey: p.serviceKey,
    requirements: reqByProject.get(p.id) ?? 0,
    buildStatus: buildByProject.get(p.id)?.status ?? null,
    openTasks: openTasksByProject.get(p.id) ?? 0,
    createdAt: p.createdAt,
  }));

  const stages = ProjectStage.options;
  const totalValue = items.reduce((a, p) => a + p.value, 0);

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description="Production websites being planned, built, reviewed and deployed. Drag cards between stages to update delivery."
        actions={
          <Link href="/websites">
            <Badge tone="neutral" className="cursor-pointer hover:border-brand-500/40">
              <Rocket className="h-2.5 w-2.5" />
              Website builds
            </Badge>
          </Link>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-ink-muted">
          <span>
            <strong className="tnum text-ink">{items.length}</strong> projects
          </span>
          <span>
            contract value <strong className="tnum text-ink">{compactMoney(totalValue)}</strong>
          </span>
          <span>
            <strong className="tnum text-ink">{num(items.filter((p) => p.stage === "Completed").length)}</strong> delivered
          </span>
        </div>

        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<KanbanSquare className="h-4 w-4" />}
              title="No projects yet"
              description="Accepting a proposal creates the first project automatically."
              action={
                <Link href="/proposals">
                  <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink hover:border-brand-500/50">
                    Open proposals
                  </button>
                </Link>
              }
            />
          </Card>
        ) : (
          <ProjectBoard items={items} stages={stages} />
        )}
      </PageBody>
    </>
  );
}
