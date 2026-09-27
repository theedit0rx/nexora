import { db } from "@/lib/db";
import { nowIso } from "@/lib/db/schema";
import { logActivity, notify } from "@/lib/events/bus";
import { fail, handler, json, readBody } from "@/lib/api";
import { setAgentPaused } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

/** Global kill switch + granular pause controls. */
export const POST = handler(async (ctx, req) => {
  const body = await readBody<{
    paused?: boolean;
    pauseOutreach?: boolean;
    pauseDemos?: boolean;
    pauseDeployments?: boolean;
  }>(req);
  const settings = await db.findOne("settings", { organizationId: ctx.session.organizationId });
  if (!settings) return fail("Settings not found for this workspace", 404);

  const autonomy = {
    ...settings.autonomy,
    ...(body.paused !== undefined
      ? { paused: body.paused, pausedAt: body.paused ? nowIso() : null }
      : {}),
    ...(body.pauseOutreach !== undefined ? { pauseOutreach: body.pauseOutreach } : {}),
    ...(body.pauseDemos !== undefined ? { pauseDemos: body.pauseDemos } : {}),
    ...(body.pauseDeployments !== undefined ? { pauseDeployments: body.pauseDeployments } : {}),
  };

  await db.update("settings", settings.id, { autonomy, updatedAt: nowIso() });

  // When autonomy is paused, every agent that could act externally is parked.
  if (autonomy.paused) {
    const agents = await db.find("agent_definitions", { organizationId: ctx.session.organizationId });
    for (const agent of agents) {
      if (agent.permissionLevel !== "GREEN" || agent.key === "deployer" || agent.key === "outreach") {
        await setAgentPaused(ctx.session.organizationId, agent.key, true);
      }
    }
  } else {
    const agents = await db.find("agent_definitions", { organizationId: ctx.session.organizationId });
    for (const agent of agents) {
      await db.update("agent_definitions", agent.id, { paused: false, state: "IDLE" });
    }
  }

  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    actionType: autonomy.paused ? "automation.paused" : "automation.resumed",
    title: autonomy.paused
      ? "Owner engaged the PAUSE AUTONOMY kill switch"
      : "Owner resumed autonomous operation",
    detail: `Outreach ${autonomy.pauseOutreach ? "paused" : "live"} · demos ${
      autonomy.pauseDemos ? "paused" : "live"
    } · deployments ${autonomy.pauseDeployments ? "paused" : "live"}`,
    riskLevel: autonomy.paused ? "HIGH" : "LOW",
    status: autonomy.paused ? "WARN" : "OK",
  });
  await notify({
    organizationId: ctx.session.organizationId,
    type: autonomy.paused ? "automation_paused" : "automation_resumed",
    title: autonomy.paused ? "Autonomy paused" : "Autonomy resumed",
    body: "All automated external actions are stopped." ,
    severity: autonomy.paused ? "WARNING" : "SUCCESS",
  });

  return json({
    ok: true,
    autonomy,
    message: autonomy.paused
      ? "Autonomy paused. No new automated external actions will start."
      : "Autonomy resumed.",
  });
});
