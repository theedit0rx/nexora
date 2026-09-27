import { db } from "@/lib/db";
import { researcherAnalyze } from "@/lib/agents/analysis";
import { getSettings } from "@/lib/agents/sales";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req) => {
  const body = await readBody<{ action?: string; leadId?: string }>(req);
  const orgId = ctx.session.organizationId;
  const settings = await getSettings(orgId);

  if (settings.autonomy.paused && body.action !== "retry") {
    return fail("Autonomy is paused. Resume from the kill switch before running agents.", 409);
  }

  switch (body.action) {
    case "research_latest":
    case "research": {
      const leadId =
        body.leadId ??
        (
          await db.find("leads", { organizationId: orgId })
        )
          .filter((l) => l.status === "DISCOVERED")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
      if (!leadId) return fail("No lead available to research. Run Scout discovery first.", 404);
      const r = await researcherAnalyze(orgId, leadId, "MANUAL");
      if (!r.ok) return fail(r.error, 409);
      return json({ ok: true, message: `Research complete for ${leadId}`, result: r.value });
    }
    default:
      return fail(`Unknown agent action "${body.action}"`, 400);
  }
});
