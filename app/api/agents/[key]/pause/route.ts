import { db } from "@/lib/db";
import { logActivity } from "@/lib/events/bus";
import { setAgentPaused, getAgent } from "@/lib/agents/registry";
import { fail, handler, json, readBody } from "@/lib/api";
import type { AgentKey } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const POST = handler(
  async (ctx, req, params) => {
    const key = params.key as AgentKey;
    const agent = await getAgent(ctx.session.organizationId, key);
    if (!agent) return fail(`Agent "${key}" not found`, 404);
    const body = await readBody<{ paused?: boolean }>(req);
    const paused = body.paused ?? !agent.paused;
    const updated = await setAgentPaused(ctx.session.organizationId, key, paused);
    await logActivity({
      organizationId: ctx.session.organizationId,
      actorType: "USER",
      agentKey: key,
      actionType: paused ? "agent.paused" : "agent.resumed",
      title: `${agent.name} ${paused ? "paused" : "resumed"} by owner`,
      detail: paused
        ? "The agent will not accept new tasks until resumed."
        : "The agent is accepting work again.",
      entityType: "agent",
      entityId: agent.id,
      riskLevel: "LOW",
      status: "OK",
    });
    return json({ ok: true, paused, agent: updated });
  },
);
