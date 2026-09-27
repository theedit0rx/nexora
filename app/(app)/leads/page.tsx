import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { LeadTable, type LeadRow } from "@/components/leads/crm-table";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { Button, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; status?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [leads, businesses, demos, messages, conversations] = await Promise.all([
    db.find("leads", { organizationId: orgId }),
    db.find("businesses", { organizationId: orgId }),
    db.find("demo_sites", { organizationId: orgId }),
    db.find("messages", { organizationId: orgId }),
    db.find("conversations", { organizationId: orgId }),
  ]);
  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const convLead = new Map(conversations.map((c) => [c.id, c.leadId]));
  const repliedLeads = new Set(
    messages
      .filter((m) => m.direction === "INBOUND")
      .map((m) => convLead.get(m.conversationId))
      .filter((x): x is string => Boolean(x)),
  );
  const demoLeadIds = new Set(demos.map((d) => d.leadId).filter(Boolean) as string[]);

  const rows: LeadRow[] = leads.map((lead) => {
    const biz = bizById.get(lead.businessId);
    return {
      id: lead.id,
      name: biz?.name ?? "Unknown",
      category: biz?.category ?? "",
      city: biz?.city ?? "",
      website: biz?.website ?? null,
      websiteStatus: lead.websiteStatus,
      rating: biz?.rating ?? null,
      reviewCount: biz?.reviewCount ?? 0,
      status: lead.status,
      pipelineStage: lead.pipelineStage,
      priority: lead.priority,
      score: lead.score,
      source: biz?.discoverySource ?? "MANUAL",
      hasDemo: demoLeadIds.has(lead.id),
      replied: repliedLeads.has(lead.id),
      tags: lead.tags,
      updatedAt: lead.updatedAt,
      optOut: lead.optOut,
      suppressed: lead.suppressed,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description="Every prospect NEXORA has found, researched and scored. Open a lead to see the full intelligence file."
        actions={
          <>
            <Link href="/pipeline">
              <Button variant="outline" size="sm">
                Pipeline view
              </Button>
            </Link>
            <AddLeadDialog />
          </>
        }
      />
      <Card>
        <LeadTable rows={rows} />
      </Card>

      {leads.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface-2 text-ink-faint">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-medium text-ink">No leads yet</p>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink-muted">
                Add a prospect manually or connect a lead source in Settings and run Scout discovery.
              </p>
            </div>
            <div className="flex gap-2">
              <AddLeadDialog />
              <Link href="/settings?section=lead-sources">
                <Button variant="outline" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Connect sources
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
