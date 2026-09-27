import Link from "next/link";
import { Globe2, Rocket } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { WebsiteGrid } from "@/components/websites/grid";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEMO_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent"> = {
  QUEUED: "neutral",
  GENERATING: "brand",
  GENERATED: "brand",
  QA_FAILED: "danger",
  DEPLOYED: "success",
  FAILED: "danger",
};

export default async function WebsitesPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [demos, builds, qaRuns, deployments, leads, businesses, projects, clients] = await Promise.all([
    db.find("demo_sites", { organizationId: orgId }),
    db.find("website_builds", { organizationId: orgId }),
    db.find("qa_runs", { organizationId: orgId }),
    db.find("deployments", { organizationId: orgId }),
    db.find("leads", { organizationId: orgId }),
    db.find("businesses", { organizationId: orgId }),
    db.find("projects", { organizationId: orgId }),
    db.find("clients", { organizationId: orgId }),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const qaByTarget = new Map(qaRuns.map((q) => [`${q.targetType}:${q.targetId}`, q]));
  const deployByTarget = new Map(deployments.map((d) => [`${d.targetType}:${d.targetId}`, d]));

  const items = [
    ...demos.map((d) => {
      const lead = d.leadId ? leadById.get(d.leadId) : null;
      return {
        id: d.id,
        kind: "DEMO" as const,
        title: d.businessName,
        subtitle: `Demo · ${d.templateFamily}`,
        href: d.leadId ? `/leads/${d.leadId}` : null,
        leadId: d.leadId,
        clientId: null as string | null,
        projectId: null as string | null,
        status: d.status,
        tone: DEMO_TONE[d.status] ?? "neutral",
        previewUrl: d.previewUrl,
        productionUrl: d.status === "DEPLOYED" ? d.previewUrl : null,
        pages: d.pages,
        buildTimeMs: null,
        screenshot: null,
        createdAt: d.createdAt,
        qa: qaByTarget.get(`DEMO:${d.id}`)
          ? {
              id: qaByTarget.get(`DEMO:${d.id}`)!.id,
              verdict: qaByTarget.get(`DEMO:${d.id}`)!.verdict,
              score: qaByTarget.get(`DEMO:${d.id}`)!.score,
              checks: qaByTarget.get(`DEMO:${d.id}`)!.checks.map((c) => ({
                code: c.code,
                label: c.label,
                passed: c.passed,
                detail: c.message,
              })),
              createdAt: qaByTarget.get(`DEMO:${d.id}`)!.createdAt,
            }
          : null,
        deployment: deployByTarget.get(`DEMO:${d.id}`)
          ? {
              id: deployByTarget.get(`DEMO:${d.id}`)!.id,
              status: deployByTarget.get(`DEMO:${d.id}`)!.state,
              kind: deployByTarget.get(`DEMO:${d.id}`)!.kind,
              url: deployByTarget.get(`DEMO:${d.id}`)!.url,
              createdAt: deployByTarget.get(`DEMO:${d.id}`)!.createdAt,
            }
          : null,
        businessName: bizById.get(lead?.businessId ?? "")?.name ?? null,
      };
    }),
    ...builds.map((b) => {
      const project = projectById.get(b.projectId);
      const client = project ? clientById.get(project.clientId) : null;
      return {
        id: b.id,
        kind: "BUILD" as const,
        title: client?.name ?? project?.name ?? "Production build",
        subtitle: `Production · v${b.version}`,
        href: project ? `/projects/${project.id}` : null,
        leadId: null as string | null,
        clientId: project?.clientId ?? null,
        projectId: b.projectId,
        status: b.status,
        tone: DEMO_TONE[b.status] ?? "neutral",
        previewUrl: null as string | null,
        productionUrl: null as string | null,
        pages: [] as string[],
        buildTimeMs: null as number | null,
        screenshot: null as string | null,
        createdAt: b.createdAt,
        qa: qaByTarget.get(`BUILD:${b.id}`)
          ? {
              id: qaByTarget.get(`BUILD:${b.id}`)!.id,
              verdict: qaByTarget.get(`BUILD:${b.id}`)!.verdict,
              score: qaByTarget.get(`BUILD:${b.id}`)!.score,
              checks: qaByTarget.get(`BUILD:${b.id}`)!.checks.map((c) => ({
                code: c.code,
                label: c.label,
                passed: c.passed,
                detail: c.message,
              })),
              createdAt: qaByTarget.get(`BUILD:${b.id}`)!.createdAt,
            }
          : null,
        deployment: deployByTarget.get(`BUILD:${b.id}`)
          ? {
              id: deployByTarget.get(`BUILD:${b.id}`)!.id,
              status: deployByTarget.get(`BUILD:${b.id}`)!.state,
              kind: deployByTarget.get(`BUILD:${b.id}`)!.kind,
              url: deployByTarget.get(`BUILD:${b.id}`)!.url,
              createdAt: deployByTarget.get(`BUILD:${b.id}`)!.createdAt,
            }
          : null,
        businessName: null as string | null,
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const deployed = items.filter((i) => i.status === "DEPLOYED" || i.status === "READY").length;
  const failed = items.filter((i) => i.status === "FAILED" || i.status === "QA_FAILED").length;

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Websites"
        description="Every generated demo and production build, its QA verdict and its current deployment state."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <Globe2 className="h-2.5 w-2.5" />
            {num(items.length)} sites
          </Badge>
          <Badge tone="success">{num(deployed)} deployed</Badge>
          {failed > 0 && <Badge tone="danger">{num(failed)} need attention</Badge>}
          <span className="ml-auto text-[11.5px] text-ink-muted">
            {num(demos.length)} demos · {num(builds.length)} production builds
          </span>
        </div>

        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Globe2 className="h-4 w-4" />}
              title="No websites yet"
              description="Run the pipeline on a qualified lead and the Builder will generate a tailored demo site."
              action={
                <Link href="/leads">
                  <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink hover:border-brand-500/50">
                    Open leads
                  </button>
                </Link>
              }
            />
          </Card>
        ) : (
          <WebsiteGrid items={items} />
        )}
      </PageBody>
    </>
  );
}

