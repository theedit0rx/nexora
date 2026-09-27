import Link from "next/link";
import { Inbox, LifeBuoy } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SupportList } from "@/components/support/list";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent"> = {
  OPEN: "danger",
  TRIAGED: "warning",
  IN_PROGRESS: "brand",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const PRIORITY_TONE: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "warning",
  URGENT: "danger",
};

export default async function SupportPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [tickets, clients] = await Promise.all([
    db.find("support_tickets", { organizationId: orgId }),
    db.find("clients", { organizationId: orgId }),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const items = tickets
    .slice()
    .sort((a, b) => {
      const order = { OPEN: 0, TRIAGED: 1, IN_PROGRESS: 2, RESOLVED: 3, CLOSED: 4 };
      const diff = order[a.status] - order[b.status];
      return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt);
    })
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      body: t.description,
      category: t.category,
      status: t.status,
      statusTone: STATUS_TONE[t.status] ?? "neutral",
      priority: t.priority,
      priorityTone: PRIORITY_TONE[t.priority] ?? "neutral",
      sentiment: t.priority === "URGENT" ? "NEGATIVE" : t.priority === "HIGH" ? "NEUTRAL" : "POSITIVE",
      suggestedAction: t.isUpsell ? "Upsell opportunity — see upsell board" : "",
      resolution: t.resolution,
      clientName: t.clientId ? (clientById.get(t.clientId)?.name ?? "Client") : "Unknown",
      clientId: t.clientId,
      projectId: t.projectId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

  const open = items.filter((t) => t.status === "OPEN").length;
  const urgent = items.filter((t) => t.priority === "URGENT" && t.status !== "RESOLVED" && t.status !== "CLOSED").length;

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Support"
        description="Client tickets triaged by the Support agent, with the suggested action it produced."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <LifeBuoy className="h-2.5 w-2.5" />
            {num(items.length)} tickets
          </Badge>
          {open > 0 && <Badge tone="danger">{num(open)} open</Badge>}
          {urgent > 0 && <Badge tone="warning">{num(urgent)} urgent</Badge>}
          <Badge tone="success">{num(items.filter((t) => t.status === "RESOLVED").length)} resolved</Badge>
        </div>

        <Card>
          <CardBody>
            {items.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-4 w-4" />}
                title="No tickets"
                description="Client requests arrive here once a client submits through their portal."
              />
            ) : (
              <SupportList items={items} />
            )}
          </CardBody>
        </Card>

        <p className="px-1 text-[11px] text-ink-faint">
          Clients submit requests from the{" "}
          <Link href="/portal" className="text-brand-300 hover:text-brand-200">
            client portal
          </Link>
          . The Support agent classifies category, sentiment and priority before triage.
        </p>
      </PageBody>
    </>
  );
}
