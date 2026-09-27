import { runPipeline, STAGE_ORDER, type StageName } from "@/lib/workflows/pipeline";
import { getSettings } from "@/lib/agents/sales";
import { db } from "@/lib/db";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req, params) => {
  const leadId = params.id;
  const lead = await db.byId("leads", leadId);
  if (!lead || lead.organizationId !== ctx.session.organizationId) return fail("Lead not found", 404);

  const body = await readBody<{ stages?: StageName[]; resume?: boolean }>(req);
  const stages = body.stages?.filter((s) => (STAGE_ORDER as string[]).includes(s)) as StageName[] | undefined;
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
