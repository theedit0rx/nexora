import { db } from "@/lib/db";
import { nowIso, type PipelineStage } from "@/lib/db/schema";
import { logActivity } from "@/lib/events/bus";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const STAGES: PipelineStage[] = [
  "Discovered",
  "Researching",
  "Audited",
  "Qualified",
  "Demo Building",
  "Demo Ready",
  "Outreach",
  "Replied",
  "Interested",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
];

export const POST = handler(async (ctx, req, params) => {
  const lead = await db.byId("leads", params.id);
  if (!lead || lead.organizationId !== ctx.session.organizationId) return fail("Lead not found", 404);
  const body = await readBody<{ stage?: PipelineStage }>(req);
  if (!body.stage || !STAGES.includes(body.stage)) return fail("Invalid pipeline stage", 400);

  const statusByStage: Partial<Record<PipelineStage, string>> = {
    Discovered: "DISCOVERED",
    Researching: "RESEARCHING",
    Audited: "AUDITED",
    Qualified: "QUALIFIED",
    "Demo Building": "DEMO_BUILDING",
    "Demo Ready": "DEMO_READY",
    Outreach: "OUTREACH",
    Replied: "REPLIED",
    Interested: "INTERESTED",
    Proposal: "PROPOSAL",
    Negotiation: "NEGOTIATION",
    Won: "WON",
    Lost: "LOST",
  };

  const updated = await db.update("leads", lead.id, {
    pipelineStage: body.stage,
    status: (statusByStage[body.stage] ?? lead.status) as typeof lead.status,
    lostReason: body.stage === "Lost" ? lead.lostReason ?? "Moved manually by owner" : null,
    updatedAt: nowIso(),
  });
  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    actionType: "lead.stage_changed",
    title: `Lead moved to ${body.stage}`,
    detail: "Manual pipeline move by the owner",
    entityType: "lead",
    entityId: lead.id,
    leadId: lead.id,
    status: "OK",
  });
  return json({ ok: true, lead: updated });
});
