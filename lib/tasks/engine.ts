import { db, newId } from "../db";
import type { AgentKey, AgentTask, RiskLevel, TaskPriority, TaskStatus } from "../db/schema";
import { bus, logActivity } from "../events/bus";

/* ==========================================================================
   NEXORA — Task Engine
   --------------------------------------------------------------------------
   Every significant agent operation becomes a task with a durable status,
   progress, retries, structured output and error state. Tasks survive
   process restarts because they live in the database.
   ========================================================================== */

export interface CreateTaskInput {
  organizationId: string;
  agentKey: AgentKey;
  type: string;
  entityType?: string;
  entityId?: string;
  priority?: TaskPriority;
  input?: Record<string, unknown>;
  riskLevel?: RiskLevel;
  maxRetries?: number;
}

export async function createTask(input: CreateTaskInput): Promise<AgentTask> {
  const task: AgentTask = {
    id: newId("tsk"),
    organizationId: input.organizationId,
    agentKey: input.agentKey,
    type: input.type,
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    priority: input.priority ?? "NORMAL",
    input: input.input ?? {},
    status: "QUEUED",
    progress: 0,
    output: {},
    error: null,
    retryCount: 0,
    maxRetries: input.maxRetries ?? 2,
    riskLevel: input.riskLevel ?? "LOW",
    approvalId: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };
  await db.insert("agent_tasks", task);
  await bus.emit("task.created", { taskId: task.id, agentKey: task.agentKey, type: task.type });
  return task;
}

export async function updateTask(
  id: string,
  patch: Partial<AgentTask>,
): Promise<AgentTask> {
  const next = await db.update("agent_tasks", id, patch);
  if (patch.status === "COMPLETED") await bus.emit("task.completed", { taskId: id });
  if (patch.status === "FAILED") await bus.emit("task.failed", { taskId: id });
  return next;
}

export async function startTask(id: string) {
  return updateTask(id, { status: "RUNNING", startedAt: new Date().toISOString(), progress: 5 });
}

export async function progressTask(id: string, progress: number, label?: string) {
  return updateTask(id, { progress: Math.max(0, Math.min(100, Math.round(progress))) });
  void label;
}

export async function completeTask(id: string, output: Record<string, unknown> = {}) {
  return updateTask(id, {
    status: "COMPLETED",
    progress: 100,
    output,
    error: null,
    completedAt: new Date().toISOString(),
  });
}

export async function failTask(id: string, error: string) {
  return updateTask(id, {
    status: "FAILED",
    error,
    completedAt: new Date().toISOString(),
  });
}

export async function blockTask(id: string, reason: string) {
  return updateTask(id, { status: "BLOCKED", error: reason });
}

export async function waitTask(id: string) {
  return updateTask(id, { status: "WAITING" });
}

export async function cancelTask(id: string) {
  return updateTask(id, { status: "CANCELLED", completedAt: new Date().toISOString() });
}

/** Move a task into retry state, or fail it when retries are exhausted. */
export async function retryTask(id: string, error: string) {
  const task = await db.byId("agent_tasks", id);
  if (!task) throw new Error(`task ${id} not found`);
  if (task.retryCount >= task.maxRetries) {
    return failTask(id, `${error} (retries exhausted after ${task.retryCount})`);
  }
  return updateTask(id, {
    status: "RETRYING",
    retryCount: task.retryCount + 1,
    error,
    progress: 0,
  });
}

/* --------------------------------------------------------------- runner --- */

export interface RunContext {
  organizationId: string;
  agentKey: AgentKey;
  taskId?: string;
  trigger?: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR";
}

/**
 * Execute an agent function inside a durable task, capturing timing,
 * structured output, errors and an agent run record.
 */
export async function runTask<T>(
  ctx: RunContext,
  type: string,
  fn: (task: AgentTask) => Promise<T>,
  opts: {
    entityType?: string;
    entityId?: string;
    priority?: TaskPriority;
    riskLevel?: RiskLevel;
    input?: Record<string, unknown>;
    maxRetries?: number;
  } = {},
): Promise<{ ok: true; value: T; task: AgentTask } | { ok: false; error: string; task: AgentTask }> {
  const task = await createTask({
    organizationId: ctx.organizationId,
    agentKey: ctx.agentKey,
    type,
    entityType: opts.entityType,
    entityId: opts.entityId,
    priority: opts.priority,
    input: opts.input,
    riskLevel: opts.riskLevel,
    maxRetries: opts.maxRetries,
  });

  const [settings, agent] = await Promise.all([
    db.findOne("settings", { organizationId: ctx.organizationId }),
    db.findOne("agent_definitions", { organizationId: ctx.organizationId, key: ctx.agentKey }),
  ]);
  if (settings?.autonomy.paused || agent?.paused) {
    const error = settings?.autonomy.paused ? "Workspace automation is paused" : "Agent is paused";
    return { ok: false, error, task: await blockTask(task.id, error) };
  }

  const run = {
    id: newId("run"),
    organizationId: ctx.organizationId,
    agentKey: ctx.agentKey,
    taskId: task.id,
    trigger: ctx.trigger ?? "MANUAL",
    status: "RUNNING" as TaskStatus,
    input: opts.input ?? {},
    output: {},
    error: null as string | null,
    durationMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
  };
  await db.insert("agent_runs", run);
  await startTask(task.id);

  const started = Date.now();
  try {
    const value = await fn(task);
    const durationMs = Date.now() - started;
    const output = (value ?? {}) as Record<string, unknown>;
    const done = await completeTask(task.id, output);
    await db.update("agent_runs", run.id, {
      status: "COMPLETED",
      output,
      durationMs,
      completedAt: new Date().toISOString(),
      tokensIn: (output.__tokensIn as number) ?? 0,
      tokensOut: (output.__tokensOut as number) ?? 0,
      costUsd: (output.__costUsd as number) ?? 0,
    });
    await recordAgentSuccess(ctx.organizationId, ctx.agentKey, durationMs);
    await logActivity({
      organizationId: ctx.organizationId,
      agentKey: ctx.agentKey,
      actionType: `task.${type}.completed`,
      title: `${agentLabel(ctx.agentKey)} completed ${type.replace(/[._]/g, " ")}`,
      detail: typeof output.summary === "string" ? output.summary : "",
      entityType: opts.entityType ?? "",
      entityId: opts.entityId ?? "",
      status: "OK",
    });
    return { ok: true, value, task: done };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - started;
    const failed = await failTask(task.id, message);
    await db.update("agent_runs", run.id, {
      status: "FAILED",
      error: message,
      durationMs,
      completedAt: new Date().toISOString(),
    });
    await recordAgentFailure(ctx.organizationId, ctx.agentKey, durationMs);
    await logActivity({
      organizationId: ctx.organizationId,
      agentKey: ctx.agentKey,
      actionType: `task.${type}.failed`,
      title: `${agentLabel(ctx.agentKey)} failed ${type.replace(/[._]/g, " ")}`,
      detail: message,
      entityType: opts.entityType ?? "",
      entityId: opts.entityId ?? "",
      riskLevel: "MEDIUM",
      status: "ERROR",
    });
    return { ok: false, error: message, task: failed };
  }
}

export function agentLabel(key: AgentKey): string {
  const labels: Record<AgentKey, string> = {
    supervisor: "Supervisor",
    scout: "Scout",
    researcher: "Researcher",
    auditor: "Auditor",
    scorer: "Scorer",
    strategist: "Strategist",
    builder: "Demo Builder",
    qa: "QA Engineer",
    deployer: "Deployer",
    outreach: "Outreach",
    sales: "Sales",
    proposal: "Proposal",
    onboarding: "Onboarding",
    production_builder: "Production Builder",
    support: "Support",
  };
  return labels[key] ?? key;
}

async function recordAgentSuccess(organizationId: string, agentKey: AgentKey, durationMs: number) {
  const def = await db.findOne("agent_definitions", { organizationId, key: agentKey });
  if (!def) return;
  const total = def.runsToday;
  const rate = (def.successRate * total + 1) / (total + 1);
  await db.update("agent_definitions", def.id, {
    runsToday: total + 1,
    successRate: Math.round(rate * 1000) / 1000,
    avgExecutionMs: Math.round((def.avgExecutionMs * total + durationMs) / (total + 1)),
    lastRunAt: new Date().toISOString(),
    state: "IDLE",
    currentTaskId: null,
    currentTaskLabel: null,
    consecutiveFailures: 0,
  });
}

async function recordAgentFailure(organizationId: string, agentKey: AgentKey, durationMs: number) {
  const def = await db.findOne("agent_definitions", { organizationId, key: agentKey });
  if (!def) return;
  const total = def.runsToday;
  const rate = (def.successRate * total + 0) / (total + 1);
  await db.update("agent_definitions", def.id, {
    runsToday: total + 1,
    successRate: Math.round(rate * 1000) / 1000,
    avgExecutionMs: Math.round((def.avgExecutionMs * total + durationMs) / (total + 1)),
    lastRunAt: new Date().toISOString(),
    state: "FAILED",
    currentTaskId: null,
    currentTaskLabel: null,
    consecutiveFailures: def.consecutiveFailures + 1,
  });
}

export async function markAgentWorking(
  organizationId: string,
  agentKey: AgentKey,
  taskId: string | null,
  label: string | null,
) {
  const def = await db.findOne("agent_definitions", { organizationId, key: agentKey });
  if (!def) return;
  if (def.paused) return;
  await db.update("agent_definitions", def.id, {
    state: "WORKING",
    currentTaskId: taskId,
    currentTaskLabel: label,
  });
}

export async function markAgentWaiting(organizationId: string, agentKey: AgentKey, label: string) {
  const def = await db.findOne("agent_definitions", { organizationId, key: agentKey });
  if (!def) return;
  await db.update("agent_definitions", def.id, { state: "WAITING", currentTaskLabel: label });
}

export async function markAgentIdle(organizationId: string, agentKey: AgentKey) {
  const def = await db.findOne("agent_definitions", { organizationId, key: agentKey });
  if (!def) return;
  await db.update("agent_definitions", def.id, {
    state: def.paused ? "PAUSED" : "IDLE",
    currentTaskId: null,
    currentTaskLabel: null,
  });
}
