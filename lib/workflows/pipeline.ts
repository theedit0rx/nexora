import { tenantById } from "../db/tenant";
import { db, newId } from "../db";
import { nowIso, type Lead, type PipelineStage } from "../db/schema";
import { bus, logActivity, notify } from "../events/bus";
import { createTask, updateTask } from "../tasks/engine";
import { getSettings } from "../agents/sales";
import { isAgentAvailable } from "../agents/registry";
import {
  researcherAnalyze,
  auditorAudit,
  scorerScore,
} from "../agents/analysis";
import { strategistPlan, builderBuildDemo, qaRun, deployerDeploy } from "../agents/build";
import { outreachDraft } from "../agents/sales";

/* ==========================================================================
   NEXORA — Autonomous Pipeline
   --------------------------------------------------------------------------
   The canonical workflow. Each stage writes a persistent status; a failure
   at any stage leaves the lead exactly where it is with a visible error,
   and the supervisor can retry from that point. Nothing is destroyed.
   ========================================================================== */

export type StageName =
  | "research"
  | "audit"
  | "score"
  | "strategy"
  | "demo"
  | "qa"
  | "deploy"
  | "outreach";

export const STAGE_ORDER: StageName[] = ["research", "audit", "score", "strategy", "demo", "qa", "deploy", "outreach"];

export interface PipelineOptions {
  /** Skip the stage if its output already exists. */
  resume?: boolean;
  /** Only run these stages. */
  stages?: StageName[];
  trigger?: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR";
}

export interface StageResult {
  stage: StageName;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  data?: Record<string, unknown>;
}

/**
 * Run the lead pipeline. Returns per-stage results so the UI can show
 * exactly where a lead stopped and why.
 */
export async function runPipeline(
  organizationId: string,
  leadId: string,
  opts: PipelineOptions = {},
): Promise<{ leadId: string; results: StageResult[]; completed: boolean }> {
  if (!(await tenantById(organizationId, "leads", leadId))) throw new Error("Lead not found");
  const trigger = opts.trigger ?? "MANUAL";
  const stages = opts.stages ?? STAGE_ORDER;
  const results: StageResult[] = [];

  for (const stage of stages) {
    const settings = await getSettings(organizationId);
    const gate = stageGate(stage, settings);
    if (!gate.allowed) {
      results.push({ stage, ok: false, skipped: true, reason: gate.reason });
      break;
    }
    if (!(await isAgentAvailable(organizationId, stageAgent(stage)))) {
      results.push({ stage, ok: false, skipped: true, reason: `${stageAgent(stage)} agent is paused` });
      break;
    }

    try {
      const data = await runStage(organizationId, leadId, stage, trigger, opts.resume ?? false);
      if (data === null) {
        results.push({ stage, ok: true, skipped: true, reason: "already complete" });
        continue;
      }
      results.push({ stage, ok: true, data });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      results.push({ stage, ok: false, reason });
      await logActivity({
        organizationId,
        agentKey: stageAgent(stage),
        actionType: `pipeline.${stage}.failed`,
        title: `Pipeline stalled at ${stage}`,
        detail: reason,
        entityType: "lead",
        entityId: leadId,
        leadId,
        riskLevel: "MEDIUM",
        status: "ERROR",
      });
      // A failed stage stops the pipeline but preserves all state.
      break;
    }
  }

  return { leadId, results, completed: stages.length > 0 && results.length === stages.length && results.every((r) => r.ok) };
}

function stageAgent(stage: StageName) {
  switch (stage) {
    case "research":
      return "researcher" as const;
    case "audit":
      return "auditor" as const;
    case "score":
      return "scorer" as const;
    case "strategy":
      return "strategist" as const;
    case "demo":
      return "builder" as const;
    case "qa":
      return "qa" as const;
    case "deploy":
      return "deployer" as const;
    case "outreach":
      return "outreach" as const;
  }
}

function stageGate(stage: StageName, settings: Awaited<ReturnType<typeof getSettings>>) {
  const autonomy = settings.autonomy;
  if (settings.autonomy.paused) {
    return { allowed: false, reason: "Autonomy is paused — resume from the kill switch before running the pipeline." };
  }
  switch (stage) {
    case "research":
      return settings.automation.automaticResearch
        ? { allowed: true }
        : { allowed: false, reason: "Automatic research is disabled in Settings → Automation." };
    case "audit":
      return settings.automation.automaticAudit
        ? { allowed: true }
        : { allowed: false, reason: "Automatic audit is disabled in Settings → Automation." };
    case "score":
      return settings.automation.automaticScoring
        ? { allowed: true }
        : { allowed: false, reason: "Automatic scoring is disabled in Settings → Automation." };
    case "strategy":
      return { allowed: true };
    case "demo":
      return settings.automation.automaticDemoCreation
        ? { allowed: true }
        : { allowed: false, reason: "Automatic demo creation is disabled in Settings → Automation." };
    case "qa":
      return settings.automation.automaticQa
        ? { allowed: true }
        : { allowed: false, reason: "Automatic QA is disabled in Settings → Automation." };
    case "deploy":
      return settings.automation.automaticPreviewDeployment && !settings.autonomy.pauseDeployments
        ? { allowed: true }
        : { allowed: false, reason: "Preview deployments are paused or disabled." };
    case "outreach":
      return !settings.autonomy.pauseOutreach
        ? { allowed: true }
        : { allowed: false, reason: "Outreach is paused." };
  }
}

async function runStage(
  organizationId: string,
  leadId: string,
  stage: StageName,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR",
  resume: boolean,
): Promise<Record<string, unknown> | null> {
  const lead = await db.byId("leads", leadId);
  if (!lead || lead.organizationId !== organizationId) throw new Error(`Lead ${leadId} not found`);

  switch (stage) {
    case "research": {
      if (resume && (await db.count("research_reports", { leadId })) > 0) return null;
      const r = await researcherAnalyze(organizationId, leadId, trigger);
      if (!r.ok) throw new Error(r.error);
      return { reportId: r.value.reportId };
    }
    case "audit": {
      if (resume && (await db.count("website_audits", { leadId })) > 0) return null;
      const r = await auditorAudit(organizationId, leadId, trigger);
      if (!r.ok) throw new Error(r.error);
      return { auditId: r.value.auditId, grade: r.value.grade };
    }
    case "score": {
      if (resume && (await db.count("lead_scores", { leadId })) > 0) return null;
      const r = await scorerScore(organizationId, leadId, trigger);
      if (!r.ok) throw new Error(r.error);
      return { score: r.value.total, priority: r.value.priority };
    }
    case "strategy": {
      if (resume && (await db.count("strategies", { leadId })) > 0) return null;
      const r = await strategistPlan(organizationId, leadId, trigger);
      if (!r.ok) throw new Error(r.error);
      return { strategyId: r.value.strategyId, templateFamily: r.value.templateFamily };
    }
    case "demo": {
      const r = await builderBuildDemo(organizationId, leadId, {}, trigger);
      if (!r.ok) throw new Error(r.error);
      return { demoId: r.value.demoId, slug: r.value.slug };
    }
    case "qa": {
      const demo = (await db.find("demo_sites", { leadId })).at(-1);
      if (!demo) throw new Error("No demo site to QA — run the demo stage first.");
      const r = await qaRun(organizationId, "DEMO", demo.id, trigger);
      if (!r.ok) throw new Error(r.error);
      if (r.value.verdict === "FAIL") throw new Error("QA failed. Resolve the reported issues before deployment.");
      return { verdict: r.value.verdict, score: r.value.score, issues: r.value.issues };
    }
    case "deploy": {
      const demo = (await db.find("demo_sites", { leadId })).at(-1);
      if (!demo) throw new Error("No demo site to deploy — run the demo stage first.");
      const r = await deployerDeploy(organizationId, "DEMO", demo.id, "PREVIEW", trigger);
      if (!r.ok) throw new Error(r.error);
      if (r.value.state !== "READY") throw new Error("Deployment is not ready; wait for provider confirmation before outreach.");
      return { deploymentId: r.value.deploymentId, url: r.value.url };
    }
    case "outreach": {
      const r = await outreachDraft(organizationId, { leadId }, trigger);
      if (!r.ok) throw new Error(r.error);
      return { messageId: r.value.messageId, status: r.value.status };
    }
  }
}

/* ------------------------------------------------------- stage transitions -- */

const STAGE_TO_PIPELINE: Record<string, PipelineStage> = {
  DISCOVERED: "Discovered",
  RESEARCHING: "Researching",
  AUDITED: "Audited",
  QUALIFIED: "Qualified",
  STRATEGY: "Qualified",
  DEMO_BUILDING: "Demo Building",
  DEMO_READY: "Demo Ready",
  OUTREACH: "Outreach",
  CONTACTED: "Outreach",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export async function moveLeadToStage(leadId: string, stage: PipelineStage, status?: Lead["status"]) {
  const lead = await db.byId("leads", leadId);
  if (!lead) throw new Error(`Lead ${leadId} not found`);
  const updated = await db.update("leads", leadId, {
    pipelineStage: stage,
    ...(status ? { status } : {}),
    updatedAt: nowIso(),
  });
  await bus.emit("project.stage_changed", { leadId, stage });
  return updated;
}

export function stageForStatus(status: string): PipelineStage {
  return STAGE_TO_PIPELINE[status] ?? "Discovered";
}

/* ------------------------------------------------------- supervisor agent -- */

/**
 * The Supervisor inspects workflow state and reacts to events. It never
 * performs an irreversible action itself — it delegates to specialised
 * agents and raises approvals when a gated action is needed.
 */
export async function supervisorReact(
  organizationId: string,
  event: string,
  payload: Record<string, unknown> = {},
) {
  const settings = await getSettings(organizationId);
  if (settings.autonomy.paused && !event.startsWith("approval.")) {
    return { handled: false, reason: "Autonomy paused" };
  }

  const leadId = payload.leadId as string | undefined;

  // Bounded re-entrancy: a workflow that feeds itself stops here.
  const guardKey = `${event}:${
    (payload.targetId as string) ?? (payload.leadId as string) ?? (payload.conversationId as string) ?? ""
  }`;
  const seen = eventHandles.get(guardKey) ?? 0;
  if (seen >= MAX_EVENT_HANDLES) {
    return { handled: false, reason: "event handled too many times" };
  }
  eventHandles.set(guardKey, seen + 1);
  if (eventHandles.size > 500) {
    for (const k of [...eventHandles.keys()].slice(0, 250)) eventHandles.delete(k);
  }

  switch (event) {
    case "lead.discovered": {
      if (!settings.automation.automaticResearch) return { handled: false, reason: "auto research off" };
      const lead = payload.leadId ? await db.byId("leads", payload.leadId as string) : null;
      if (!lead || lead.organizationId !== organizationId) return { handled: false };
      const task = await createTask({
        organizationId,
        agentKey: "supervisor",
        type: "supervisor.route",
        entityType: "lead",
        entityId: lead.id,
        priority: "NORMAL",
        input: { event, leadId: lead.id },
      });
      await updateTask(task.id, { status: "COMPLETED", progress: 100, completedAt: nowIso(), output: { routed: "researcher" } });
      const r = await researcherAnalyze(organizationId, lead.id, "SUPERVISOR");
      return { handled: true, delegated: "researcher", ok: r.ok };
    }
    case "lead.research.completed": {
      if (!settings.automation.automaticAudit || !leadId) return { handled: false };
      const r = await auditorAudit(organizationId, leadId, "SUPERVISOR");
      return { handled: true, delegated: "auditor", ok: r.ok };
    }
    case "lead.audit.completed": {
      if (!settings.automation.automaticScoring || !leadId) return { handled: false };
      const r = await scorerScore(organizationId, leadId, "SUPERVISOR");
      return { handled: true, delegated: "scorer", ok: r.ok };
    }
    case "lead.qualified": {
      const priority = payload.priority as string | undefined;
      if (priority !== "HOT" && priority !== "WARM") return { handled: false, reason: "not a qualified priority" };
      const r = await strategistPlan(organizationId, leadId!, "SUPERVISOR");
      return { handled: true, delegated: "strategist", ok: r.ok };
    }
    case "strategy.generated": {
      if (!settings.automation.automaticDemoCreation || !leadId) return { handled: false };
      const r = await builderBuildDemo(organizationId, leadId, {}, "SUPERVISOR");
      return { handled: true, delegated: "builder", ok: r.ok };
    }
    case "demo.completed": {
      if (!settings.automation.automaticQa) return { handled: false };
      const demoId = payload.demoId as string | undefined;
      if (!demoId) return { handled: false };
      const r = await qaRun(organizationId, "DEMO", demoId, "SUPERVISOR");
      return { handled: true, delegated: "qa", ok: r.ok };
    }
    case "qa.passed": {
      if (!settings.automation.automaticPreviewDeployment || settings.autonomy.pauseDeployments) {
        return { handled: false };
      }
      const passedId = payload.targetId as string | undefined;
      if (passedId) repairAttempts.delete(passedId);
      const targetId = payload.targetId as string | undefined;
      if (!targetId) return { handled: false };
      const r = await deployerDeploy(organizationId, "DEMO", targetId, "PREVIEW", "SUPERVISOR");
      return { handled: true, delegated: "deployer", ok: r.ok };
    }
    case "qa.failed": {
      // Send the exact problems back to the builder — but only a bounded number
      // of times. QA is deterministic, so an unrepairable defect would otherwise
      // rebuild the same broken site forever.
      const targetId = payload.targetId as string | undefined;
      const demo = targetId ? await db.byId("demo_sites", targetId) : null;
      if (!demo) return { handled: false };
      const attempts = repairAttempts.get(demo.id) ?? 0;
      if (attempts >= MAX_REPAIR_ATTEMPTS) {
        await logActivity({
          organizationId,
          agentKey: "supervisor",
          actionType: "supervisor.repair_abandoned",
          title: `Supervisor stopped repairing ${demo.businessName} after ${attempts} attempts`,
          detail: (payload.issues as string[] | undefined)?.slice(0, 3).join(" | ") ?? "",
          entityType: "demo",
          entityId: demo.id,
          leadId: demo.leadId,
          status: "WARN",
        });
        await notify({
          organizationId,
          type: "qa_failed",
          title: `QA still failing for ${demo.businessName}`,
          body: `Stopped after ${attempts} repair attempts. Open the site to fix it manually.`,
          entityType: "demo",
          entityId: demo.id,
          severity: "WARNING",
        });
        return { handled: false, reason: "repair attempts exhausted" };
      }
      repairAttempts.set(demo.id, attempts + 1);
      await logActivity({
        organizationId,
        agentKey: "supervisor",
        actionType: "supervisor.repair_dispatch",
        title: `Supervisor returned the build to Demo Builder`,
        detail: (payload.issues as string[] | undefined)?.slice(0, 3).join(" | ") ?? "",
        entityType: "demo",
        entityId: demo.id,
        leadId: demo.leadId,
        status: "WARN",
      });
      const r = await builderBuildDemo(organizationId, demo.leadId, { strategyId: demo.strategyId ?? undefined }, "SUPERVISOR");
      return { handled: true, delegated: "builder", ok: r.ok };
    }
    case "deployment.completed": {
      if (!settings.automation.automaticOutreachDraft || !leadId) return { handled: false };
      const r = await outreachDraft(organizationId, { leadId }, "SUPERVISOR");
      return { handled: true, delegated: "outreach", ok: r.ok };
    }
    case "lead.interested": {
      if (!settings.automation.automaticProposalDrafts || !leadId) return { handled: false };
      const { proposalGenerate } = await import("../agents/sales");
      const r = await proposalGenerate(organizationId, leadId, {}, "SUPERVISOR");
      return { handled: true, delegated: "proposal", ok: r.ok };
    }
    case "message.received": {
      if (!settings.automation.automaticReplySuggestions) return { handled: false };
      const conversationId = payload.conversationId as string | undefined;
      const messageId = payload.messageId as string | undefined;
      if (!conversationId || !messageId) return { handled: false };
      const { salesHandleInbound } = await import("../agents/sales");
      const r = await salesHandleInbound(organizationId, conversationId, messageId, "SUPERVISOR");
      return { handled: true, delegated: "sales", ok: r.ok };
    }
    default:
      return { handled: false, reason: `no route for ${event}` };
  }
}

/* --------------------------------------------------------- repair guard --- */

/** How many times the Supervisor may send a single build back to the Builder. */
const MAX_REPAIR_ATTEMPTS = 2;

/** Per-demo repair counter, reset whenever a build passes QA. */
const repairAttempts = new Map<string, number>();

/**
 * Safety net against cyclic workflows. Counts how often each (event, entity)
 * pair has been handled in this process and refuses to handle it further once
 * the ceiling is hit, so a bug anywhere in the chain degrades into a skipped
 * step rather than an unbounded loop.
 */
const MAX_EVENT_HANDLES = 25;
const eventHandles = new Map<string, number>();

/** Wire the supervisor to the event bus. Called once per process. */
export function registerSupervisor(organizationId: string) {
  const events = [
    "lead.discovered",
    "lead.research.completed",
    "lead.audit.completed",
    "lead.qualified",
    "strategy.generated",
    "demo.completed",
    "qa.failed",
    "qa.passed",
    "deployment.completed",
    "lead.interested",
    "message.received",
  ] as const;
  const offs = events.map((e) =>
    bus.on(e, async (payload) => {
      await supervisorReact(organizationId, e, payload);
    }),
  );
  return () => offs.forEach((off) => off());
}

export { notify, newId };
