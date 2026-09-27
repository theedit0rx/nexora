import { z } from "zod";
import { parseBody } from "@/lib/security/http";
import { runPipeline, STAGE_ORDER, type StageName } from "@/lib/workflows/pipeline";
import { getSettings } from "@/lib/agents/sales";
import { db } from "@/lib/db";
import { fail, handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req, params) => {
  const leadId = params.id;
  const lead = await db.byId("leads", leadId);
  if (!lead || lead.organizationId !== ctx.session.organizationId) return fail("Lead not found", 404);

  const body = await parseBody(req, z.object({
    stages: z.array(z.enum(STAGE_ORDER as [StageName, ...StageName[]])).min(1).max(STAGE_ORDER.length).optional(),
    resume: z.boolean().optional(),
  }));
  const stages = body.stages;
  const settings = await getSettings(ctx.session.organizationId);
  if (settings.autonomy.paused) {
    return fail("Autonomy is paused. Resume from the kill switch to run the pipeline.", 409);
  }

  const result = await runPipeline(ctx.session.organizationId, leadId, {
    stages,
    resume: body.resume ?? true,
    trigger: "MANUAL",
  });
  return json({
    ok: result.completed,
    results: result.results.map((r) => ({
      stage: r.stage,
      ok: r.ok,
      skipped: r.skipped,
      reason: r.reason,
      data: r.data,
    })),
  });
});
