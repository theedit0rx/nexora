import Link from "next/link";
import { Building2, Plus, Users } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { ClientTable } from "@/components/clients/table";
import { Badge, Button, Card, CardBody, EmptyState } from "@/components/ui";
import { compactMoney, money, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [clients, projects, tickets, onboarding, leads, businesses, proposals] = await Promise.all([
    db.find("clients", { organizationId: orgId }),
    db.find("projects", { organizationId: orgId }),
    db.find("support_tickets", { organizationId: orgId }),
    db.find("onboarding_submissions", { organizationId: orgId }),
    db.find("leads", { organizationId: orgId }),
    db.find("businesses", { organizationId: orgId }),
    db.find("proposals", { organizationId: orgId }),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const onboardingByClient = new Map(onboarding.map((o) => [o.clientId, o]));

  const rows = clients.map((client) => {
    const lead = client.leadId ? leadById.get(client.leadId) : null;
    const biz = lead ? bizById.get(lead.businessId) : null;
    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
      status: client.status,
      lifetimeValue: client.lifetimeValue,
      monthlyRecurring: client.monthlyRecurring,
      contractValue: client.contractValue,
      onboardingProgress: onboardingByClient.get(client.id)?.completion ?? client.onboardingProgress,
      projects: projects.filter((p) => p.clientId === client.id).length,
      openTickets: tickets.filter((t) => t.clientId === client.id && t.status !== "RESOLVED" && t.status !== "CLOSED").length,
      proposals: proposals.filter((p) => p.clientId === client.id).length,
      email: client.primaryEmail || (biz?.email ?? ""),
      phone: client.primaryPhone || (biz?.phone ?? ""),
      city: biz?.city ?? "",
      category: biz?.category ?? "",
      createdAt: client.createdAt,
    };
  });

  const active = rows.filter((r) => r.status === "ACTIVE").length;
  const onboardingCount = rows.filter((r) => r.status === "ONBOARDING").length;
  const totalLtv = rows.reduce((a, r) => a + r.lifetimeValue, 0);

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Clients"
        description="Every signed client, their onboarding state, projects and support load."
        actions={
          <Button variant="primary" size="sm" disabled title="Clients are created when a proposal is accepted">
            <Plus className="h-3.5 w-3.5" />
            Add client
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <Users className="h-2.5 w-2.5" />
            {num(rows.length)} clients
          </Badge>
          <Badge tone="success">{num(active)} active</Badge>
          <Badge tone="warning">{num(onboardingCount)} onboarding</Badge>
          <Badge tone="brand">{totalLtv > 0 ? `${compactMoney(totalLtv)} lifetime value` : "no revenue yet"}</Badge>
        </div>

        <Card>
          <CardBody>
            {rows.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-4 w-4" />}
                title="No clients yet"
                description="Accepting a proposal automatically creates the client, onboarding checklist and first project."
                action={
                  <Link href="/proposals">
                    <Button size="sm">Open proposals</Button>
                  </Link>
                }
              />
            ) : (
              <ClientTable rows={rows} />
            )}
          </CardBody>
        </Card>

        <p className="px-1 text-[11px] text-ink-faint">
          Lifetime value sums accepted proposal value. Recurring revenue is recorded against maintenance retainers.
        </p>
      </PageBody>
    </>
  );
}

