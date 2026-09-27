import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LeadDetail } from "@/components/leads/lead-detail";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const lead = await db.byId("leads", id);
  if (!lead || lead.organizationId !== orgId) notFound();

  const [business, research, audits, scores, strategy, opportunities, demos, qaRuns, outreach, conversations, proposals, events, settings] =
    await Promise.all([
      db.byId("businesses", lead.businessId),
      db.find("research_reports", { organizationId: orgId, leadId: lead.id }),
      db.find("website_audits", { organizationId: orgId, leadId: lead.id }),
      db.find("lead_scores", { organizationId: orgId, leadId: lead.id }),
      db.find("strategies", { organizationId: orgId, leadId: lead.id }),
      db.find("opportunities", { organizationId: orgId, leadId: lead.id }),
      db.find("demo_sites", { organizationId: orgId, leadId: lead.id }),
      db.find("qa_runs", { organizationId: orgId, leadId: lead.id }),
      db.find("outreach_messages", { organizationId: orgId, leadId: lead.id }),
      db.find("conversations", { organizationId: orgId, leadId: lead.id }),
      db.find("proposals", { organizationId: orgId, leadId: lead.id }),
      db.find("activity_events", { organizationId: orgId, leadId: lead.id }),
      db.findOne("settings", { organizationId: orgId }),
    ]);

  const latest = <T extends { createdAt: string }>(rows: T[]): T | null =>
    rows.length === 0 ? null : rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;

  const timeline = events
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({
      id: e.id,
      title: e.title,
      detail: e.detail ?? "",
      at: e.createdAt,
      actor: e.actorType === "USER" ? "owner" : (e.agentKey ?? "system"),
      status: e.status ?? "OK",
    }));

  return (
    <LeadDetail
      data={{
        lead: {
          id: lead.id,
          name: business?.name ?? "Unknown business",
          category: business?.category ?? "",
          subcategory: business?.subcategory ?? "",
          city: business?.city ?? "",
          region: business?.region ?? "",
          country: business?.country ?? "",
          address: business?.address ?? "",
          website: business?.website ?? null,
          mapsUrl: business?.mapsUrl ?? null,
          phone: business?.phone ?? null,
          email: business?.email ?? null,
          rating: business?.rating ?? null,
          reviewCount: business?.reviewCount ?? 0,
          socialLinks: (business?.socialLinks ?? {}) as Record<string, string>,
          discoverySource: business?.discoverySource ?? "MANUAL",
          status: lead.status,
          pipelineStage: lead.pipelineStage,
          priority: lead.priority,
          score: lead.score,
          websiteStatus: lead.websiteStatus,
          tags: lead.tags,
          lastContactedAt: lead.lastContactedAt,
          nextFollowUpAt: lead.nextFollowUpAt,
          lostReason: lead.lostReason,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        },
        research: latest(research) as unknown as Record<string, unknown> | null,
        audit: latest(audits) as unknown as Record<string, unknown> | null,
        score: latest(scores) as unknown as Record<string, unknown> | null,
        strategy: latest(strategy) as unknown as Record<string, unknown> | null,
        opportunities: opportunities as unknown as Array<Record<string, unknown>>,
        demos: demos.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as unknown as Array<Record<string, unknown>>,
        qaRuns: qaRuns.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as unknown as Array<Record<string, unknown>>,
        outreach: outreach as unknown as Array<Record<string, unknown>>,
        conversations: conversations as unknown as Array<Record<string, unknown>>,
        proposals: proposals as unknown as Array<Record<string, unknown>>,
        timeline,
        autonomyPaused: Boolean(settings?.autonomy.paused),
      }}
    />
  );
}

