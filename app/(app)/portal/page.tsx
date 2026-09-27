import Link from "next/link";
import { ArrowLeft, CheckCircle2, Globe2, MessageSquare, Rocket } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { ClientPortal } from "@/components/portal/portal";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { dateTime, money, num, percent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [clients, projects, websites, deployments, tickets, conversations, onboarding] = await Promise.all([
    db.find("clients", { organizationId: orgId }),
    db.find("projects", { organizationId: orgId }),
    db.find("website_builds", { organizationId: orgId }),
    db.find("deployments", { organizationId: orgId }),
    db.find("support_tickets", { organizationId: orgId }),
    db.find("conversations", { organizationId: orgId }),
    db.find("onboarding_submissions", { organizationId: orgId }),
  ]);

  if (clients.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Client experience"
          title="Client portal"
          description="The view your clients see: onboarding progress, live sites, project status and support."
        />
        <PageBody>
          <Card>
            <EmptyState
              icon={<Globe2 className="h-4 w-4" />}
              title="No clients yet"
              description="Accept a proposal to create a client and unlock their portal."
              action={
                <Link href="/proposals">
                  <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink hover:border-brand-500/50">
                    Open proposals
                  </button>
                </Link>
              }
            />
          </Card>
        </PageBody>
      </>
    );
  }

  const items = clients.map((client) => {
    const myProjects = projects.filter((p) => p.clientId === client.id);
    const myDeployments = deployments.filter((d) => d.projectId && myProjects.some((p) => p.id === d.projectId));
    const myTickets = tickets.filter((t) => t.clientId === client.id);
    const myConversations = conversations.filter((c) => c.clientId === client.id);
    const myOnboarding = onboarding.find((o) => o.clientId === client.id);
    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
      status: client.status,
      onboardingProgress: myOnboarding?.completion ?? client.onboardingProgress,
      onboardingMissing: myOnboarding?.missing ?? [],
      contractValue: client.contractValue,
      projects: myProjects.map((p) => ({
        id: p.id,
        name: p.name,
        stage: p.stage,
        progress: p.progress,
        previewUrl: p.previewUrl,
        productionUrl: p.productionUrl,
        dueDate: p.dueDate ?? "",
      })),
      liveSites: myDeployments
        .filter((d) => d.state === "READY")
        .map((d) => ({ id: d.id, url: d.url, kind: d.kind, customDomain: d.customDomain })),
      tickets: myTickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        resolution: t.resolution,
      })),
      conversations: myConversations.map((c) => ({ id: c.id, subject: c.subject, updatedAt: c.updatedAt })),
    };
  });

  const totalLive = items.reduce((a, c) => a + c.liveSites.length, 0);
  const openTickets = items.reduce((a, c) => a + c.tickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length, 0);

  return (
    <>
      <PageHeader
        eyebrow="Client experience"
        title="Client portal"
        description="Exactly what your clients see. Onboarding progress, live sites, delivery status and support — no internal intelligence."
        actions={
          <Link href="/clients">
            <Badge tone="neutral" className="cursor-pointer hover:border-brand-500/40">
              <ArrowLeft className="h-2.5 w-2.5" />
              Internal client view
            </Badge>
          </Link>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{num(items.length)} clients</Badge>
          <Badge tone="success">{num(totalLive)} live sites</Badge>
          {openTickets > 0 && <Badge tone="warning">{num(openTickets)} open tickets</Badge>}
        </div>

        <ClientPortal items={items} />
      </PageBody>
    </>
  );
}

