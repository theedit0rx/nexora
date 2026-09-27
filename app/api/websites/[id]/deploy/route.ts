import { deployerDeploy, qaRun } from "@/lib/agents/build";
import { db } from "@/lib/db";
import { createApproval } from "@/lib/approvals";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req, params) => {
  const body = await readBody<{ kind?: "PREVIEW" | "PRODUCTION"; runQa?: boolean }>(req);
  const kind = body.kind ?? "PREVIEW";
  const demo = await db.byId("demo_sites", params.id);
  const build = demo ? null : await db.byId("website_builds", params.id);
  const targetType = demo ? "DEMO" : "BUILD";
  const targetId = demo?.id ?? build?.id;
  if (!targetId) return fail("Website not found", 404);
  if (demo && demo.organizationId !== ctx.session.organizationId) return fail("Website not found", 404);
  if (build && build.organizationId !== ctx.session.organizationId) return fail("Website not found", 404);

  if (!["PREVIEW", "PRODUCTION"].includes(kind)) return fail("Invalid deployment kind", 400);
  {
    const qa = await qaRun(ctx.session.organizationId, targetType, targetId, "MANUAL");
    if (!qa.ok) return fail(qa.error, 409);
    if (qa.value.verdict === "FAIL") {
      return json({ ok: false, error: "QA failed — fix the blocking issues before deploying.", qa: qa.value }, 409);
    }
  }

  if (kind === "PRODUCTION") {
    const approval = await createApproval({
      organizationId: ctx.session.organizationId,
      action: "production_deployment",
      title: `Production deployment for ${demo?.businessName ?? build?.id ?? "site"}`,
      reason: "Production deployments are gated. Approving queues the deployment through the configured provider.",
      requestingAgent: "deployer",
      entityType: targetType === "DEMO" ? "demo" : "build",
      entityId: targetId,
      payload: { targetType, targetId },
    });
    return json({ ok: true, approvalRequired: true, approvalId: approval.id });
  }

  const result = await deployerDeploy(ctx.session.organizationId, targetType, targetId, "PREVIEW", "MANUAL");
  if (!result.ok) return fail(result.error, 409);
  return json({ ok: true, deployment: result.value });
});
