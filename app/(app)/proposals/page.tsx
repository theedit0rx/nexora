import Link from "next/link";
import { FileText, Send } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { ProposalBoard } from "@/components/proposals/board";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { compactMoney, money, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent"> = {
  DRAFT: "neutral",
  WAITING_APPROVAL: "warning",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
};

export default async function ProposalsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [proposals, items, leads, businesses, clients] = await Promise.all([
    db.find("proposals", { organizationId: orgId }),
    db.find("proposal_items", { organizationId: orgId }),
    db.find("leads", { organizationId: orgId }),
    db.find("businesses", { organizationId: orgId }),
    db.find("clients", { organizationId: orgId }),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const itemsByProposal = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByProposal.get(item.proposalId) ?? [];
    list.push(item);
    itemsByProposal.set(item.proposalId, list);
  }

  const cards = proposals
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => {
      const lead = p.leadId ? leadById.get(p.leadId) : null;
      const biz = lead ? bizById.get(lead.businessId) : null;
      return {
        id: p.id,
        number: p.number,
        title: p.title,
        status: p.status,
        statusTone: STATUS_TONE[p.status] ?? "neutral",
        currency: p.currency,
        subtotal: p.subtotal,
        discount: p.discount,
        total: p.total,
        validUntil: p.validUntil,
        sentAt: p.sentAt,
        clientName: clientById.get(p.clientId ?? "")?.name ?? biz?.name ?? "Prospect",
        leadId: p.leadId,
        clientId: p.clientId,
        problem: p.problem,
        proposedSolution: p.proposedSolution,
        pages: p.pages,
        functionality: p.functionality,
        deliverables: p.deliverables,
        milestones: p.milestones,
        upgradeOptions: p.upgradeOptions,
        revisionPolicy: p.revisionPolicy ?? "",
        maintenanceTerms: p.maintenanceTerms ?? "",
        hostingTerms: p.hostingTerms ?? "",
        createdAt: p.createdAt,
        lineItems: (itemsByProposal.get(p.id) ?? []).map((i) => ({
          id: i.id,
          label: i.label,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.amount,
          kind: i.kind,
        })),
      };
    });

  const sent = cards.filter((c) => c.status === "SENT" || c.status === "ACCEPTED" || c.status === "REJECTED");
  const decided = cards.filter((c) => c.status === "ACCEPTED" || c.status === "REJECTED");
  const acceptance = decided.length > 0 ? decided.filter((c) => c.status === "ACCEPTED").length / decided.length : null;
  const openValue = cards
    .filter((c) => c.status === "DRAFT" || c.status === "WAITING_APPROVAL" || c.status === "SENT")
    .reduce((acc, c) => acc + c.total, 0);

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Proposals"
        description="Every proposal generated from a qualified opportunity, with its line items and current decision state."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{num(cards.length)} proposals</Badge>
          <Badge tone="brand">{num(sent.length)} sent</Badge>
          <Badge tone="warning">{openValue > 0 ? `${compactMoney(openValue)} open` : "none open"}</Badge>
          <Badge tone={acceptance === null ? "neutral" : acceptance >= 0.5 ? "success" : "warning"}>
            acceptance {acceptance === null ? "—" : `${Math.round(acceptance * 100)}%`}
          </Badge>
          <span className="ml-auto text-[11.5px] text-ink-muted">
            Won value{" "}
            <strong className="tnum text-emerald-300">
              {money(cards.filter((c) => c.status === "ACCEPTED").reduce((a, c) => a + c.total, 0))}
            </strong>
          </span>
        </div>

        <Card>
          <CardBody>
            {cards.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-4 w-4" />}
                title="No proposals yet"
                description="The Proposal agent writes one once a prospect shows interest. Approve it, then send it."
              />
            ) : (
              <ProposalBoard proposals={cards} />
            )}
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}

