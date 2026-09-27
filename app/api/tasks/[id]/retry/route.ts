import { db } from "@/lib/db";
import { nowIso } from "@/lib/db/schema";
import { logActivity } from "@/lib/events/bus";
import { fail, handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req, params) => {
  const task = await db.byId("agent_tasks", params.id);
  if (!task || task.organizationId !== ctx.session.organizationId) return fail("Task not found", 404);

  await db.update("agent_tasks", task.id, {
    status: "QUEUED",
    progress: 0,
    error: null,
    startedAt: null,
    completedAt: null,
  });

  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    agentKey: task.agentKey,
    actionType: "task.retried",
    title: `Task requeued by owner: ${task.type}`,
    detail: task.error ?? "",
    entityType: "task",
    entityId: task.id,
    status: "OK",
  });

  // Re-run the underlying stage where we can resolve the entity.
  const leadId = task.entityType === "lead" ? task.entityId : null;
  if (leadId) {
    const { runPipeline } = await import("@/lib/workflows/pipeline");
    const result = await runPipeline(ctx.session.organizationId, leadId, { resume: false, trigger: "RETRY" });
    return json({ ok: true, requeued: true, pipeline: result.results.length });
  }

  return json({ ok: true, requeued: true });
});
