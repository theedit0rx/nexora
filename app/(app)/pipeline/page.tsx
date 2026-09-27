import Link from "next/link";
import { Plus, KanbanSquare } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PipelineStage } from "@/lib/db/schema";
import { PageHeader, PageBody, SectionTitle } from "@/components/shared/page-header";
import { PipelineBoard, type BoardLead } from "@/components/pipeline/board";
import { Button, Card, CardBody, EmptyState } from "@/components/ui";
import { compactMoney, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [leads, businesses, demos, messages, conversations, settings] = await Promise.all([
    db.find("leads", { organizationId: orgId }),
    db.find("businesses", { organizationId: orgId }),
    db.find("demo_sites", { organizationId: orgId }),
    db.find("messages", { organizationId: orgId }),
    db.find("conversations", { organizationId: orgId }),
    db.findOne("settings", { organizationId: orgId }),
  ]);
  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const stageOf = (s: string) => {
    const found = PipelineStage.options.find((o) => o.toLowerCase() === s.toLowerCase());
    return (found ?? "Discovered") as string;
  };

  const convLead = new Map(conversations.map((c) => [c.id, c.leadId]));
  const repliedLeads = new Set(
    messages
      .filter((m) => m.direction === "INBOUND")
      .map((m) => convLead.get(m.conversationId))
      .filter((x): x is string => Boolean(x)),
  );
  const demoLeadIds = new Set(demos.map((d) => d.leadId).filter(Boolean) as string[]);

  const boardLeads: BoardLead[] = leads
    .filter((l) => !l.suppressed)
    .map((lead) => ({
      id: lead.id,
      name: bizById.get(lead.businessId)?.name ?? "Unknown business",
      category: bizById.get(lead.businessId)?.category ?? "",
      city: bizById.get(lead.businessId)?.city ?? "",
      score: lead.score,
      priority: lead.priority,
      status: stageOf(lead.pipelineStage),
      lastActivity: lead.updatedAt,
      estimatedValue: estimateValue(lead.score),
      waitingOn: lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() ? "follow-up due" : null,
      hasDemo: demoLeadIds.has(lead.id),
      replied: repliedLeads.has(lead.id),
      pipelineStage: stageOf(lead.pipelineStage),
    })) as BoardLead[];

  const stages = PipelineStage.options;
  const totalValue = boardLeads.reduce((acc, l) => acc + (l.estimatedValue ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Pipeline"
        description="The complete journey from discovery to delivered. Drag cards between columns or use the stage menu on any lead."
        actions={
          <>
            <Link href="/leads">
              <Button variant="outline" size="sm">
                <KanbanSquare className="h-3.5 w-3.5" />
                CRM table
              </Button>
            </Link>
            <Link href="/leads?new=1">
              <Button variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                New lead
              </Button>
            </Link>
          </>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-ink-muted">
          <span>
            <strong className="tnum text-ink">{boardLeads.length}</strong> active leads
          </span>
          <span>
            weighted value <strong className="tnum text-ink">{compactMoney(totalValue)}</strong>
          </span>
          {settings?.autonomy.paused && (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
              Autonomy paused — agents are parked
            </span>
          )}
        </div>

        {boardLeads.length === 0 ? (
          <Card>
            <EmptyState
              icon={<KanbanSquare className="h-4 w-4" />}
              title="No leads in the pipeline"
              description="Run Scout discovery from the command palette (⌘K) or add a lead manually."
              action={
                <Link href="/leads?new=1">
                  <Button size="sm">Add your first lead</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <PipelineBoard
            leads={boardLeads}
            stages={stages}
            autonomyPaused={Boolean(settings?.autonomy.paused)}
          />
        )}

        <Card>
          <CardBody>
            <SectionTitle title="Stage definitions" />
            <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {STAGE_HELP.map((s) => (
                <div key={s.stage} className="border-b border-line/40 pb-2">
                  <p className="text-[12px] font-medium text-ink">{s.stage}</p>
                  <p className="text-[11px] leading-relaxed text-ink-faint">{s.help}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}

function estimateValue(score: number | null): number {
  if (score === null) return 0;
  if (score >= 80) return 45000;
  if (score >= 65) return 30000;
  if (score >= 50) return 18000;
  return 8000;
}

const STAGE_HELP = [
  { stage: "Discovered", help: "Found by Scout from a lead source. No research done yet." },
  { stage: "Researching", help: "Researcher agent gathers business intelligence and contacts." },
  { stage: "Audited", help: "Auditor scored the website: SEO, performance, mobile, trust." },
  { stage: "Qualified", help: "Scorer accepted the lead with a HOT/WARM/COLD priority." },
  { stage: "Demo Building", help: "Builder is generating the tailored demo website." },
  { stage: "Demo Ready", help: "Demo passed QA and is deployed at a preview URL." },
  { stage: "Outreach", help: "Sales agent queued the first outreach message." },
  { stage: "Replied", help: "The prospect answered. Sales classifies intent." },
  { stage: "Interested", help: "Positive intent confirmed. Proposal generation starts." },
  { stage: "Proposal", help: "Proposal generated and awaiting approval or send." },
  { stage: "Negotiation", help: "Terms are being worked through with the prospect." },
  { stage: "Won", help: "Proposal accepted — client and project created." },
  { stage: "Lost", help: "Closed without a deal. Reason is recorded on the lead." },
];

