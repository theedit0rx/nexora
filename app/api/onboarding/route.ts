import { db, newId } from "@/lib/db";
import { nowIso } from "@/lib/db/schema";
import { onboardingCompletion } from "@/lib/agents/sales";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req) => {
  const body = await readBody<{ clientId?: string; data?: Record<string, unknown> }>(req);
  if (!body.clientId) return fail("clientId is required", 400);
  const submission = await db.findOne("onboarding_submissions", { clientId: body.clientId, organizationId: ctx.session.organizationId });
  if (!submission) return fail("Onboarding submission not found", 404);

  const merged = { ...submission.data, ...(body.data ?? {}) } as Record<string, unknown>;
  const { completion, missing } = onboardingCompletion(merged);
  const updated = await db.update("onboarding_submissions", submission.id, {
    data: merged as typeof submission.data,
    completion,
    missing,
    status: completion >= 100 ? "COMPLETE" : completion > 0 ? "PARTIAL" : "PENDING",
    submittedAt: completion >= 100 ? nowIso() : submission.submittedAt,
    updatedAt: nowIso(),
  });
  const client = await db.byId("clients", body.clientId);
  if (client && client.organizationId === ctx.session.organizationId) await db.update("clients", client.id, { onboardingProgress: completion, updatedAt: nowIso() });
  void newId;
  return json({ ok: true, submission: updated });
});
