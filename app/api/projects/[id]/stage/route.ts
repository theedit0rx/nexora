import { db } from "@/lib/db";
import { nowIso, type ProjectStage } from "@/lib/db/schema";
import { logActivity } from "@/lib/events/bus";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const STAGES: ProjectStage[] = ["Planning", "Building", "QA", "Client Review", "Deployment", "Completed", "Maintenance"];

export const POST = handler(async (ctx, req, params) => {
  const project = await db.byId("projects", params.id);
  if (!project || project.organizationId !== ctx.session.organizationId) return fail("Project not found", 404);
  const body = await readBody<{ stage?: ProjectStage }>(req);
  if (!body.stage || !STAGES.includes(body.stage)) return fail("Invalid project stage", 400);

  const progressByStage: Record<ProjectStage, number> = {
    Planning: 10,
    Building: 45,
    QA: 70,
    "Client Review": 85,
    Deployment: 95,
    Completed: 100,
    Maintenance: 100,
  };

  const updated = await db.update("projects", project.id, {
    stage: body.stage,
    progress: progressByStage[body.stage],
    updatedAt: nowIso(),
  });
  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    agentKey: "production_builder",
    actionType: "project.stage_changed",
    title: `${project.name} moved to ${body.stage}`,
    detail: "Manual stage change by the owner",
    entityType: "project",
    entityId: project.id,
    projectId: project.id,
    status: "OK",
  });
  return json({ ok: true, project: updated });
});
