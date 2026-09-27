import { db, newId } from "../db";
import type { ActivityEvent, AgentKey, RiskLevel } from "../db/schema";

/* ==========================================================================
   NEXORA — Event Bus
   --------------------------------------------------------------------------
   In-process pub/sub for workflow events. Every significant agent operation
   publishes an event; the Supervisor and the automation rules react to them.
   In Supabase mode you would back this with Postgres LISTEN/NOTIFY or
   Realtime channels — the interface stays identical.
   ========================================================================== */

export type NexoraEvent =
  | "lead.discovered"
  | "lead.research.completed"
  | "lead.audit.completed"
  | "lead.scored"
  | "lead.qualified"
  | "lead.rejected"
  | "strategy.generated"
  | "demo.requested"
  | "demo.completed"
  | "demo.failed"
  | "qa.failed"
  | "qa.passed"
  | "deployment.completed"
  | "deployment.failed"
  | "outreach.prepared"
  | "outreach.sent"
  | "message.received"
  | "message.sent"
  | "lead.interested"
  | "lead.not_interested"
  | "proposal.generated"
  | "proposal.approved"
  | "proposal.accepted"
  | "client.created"
  | "project.started"
  | "project.stage_changed"
  | "support.created"
  | "upsell.detected"
  | "approval.requested"
  | "approval.resolved"
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "automation.paused"
  | "automation.resumed"
  | "task.created"
  | "task.completed"
  | "task.failed";

export interface EventPayload {
  [key: string]: unknown;
}

type Handler = (payload: EventPayload) => void | Promise<void>;

const EVENT_NAMES: NexoraEvent[] = [
  "lead.discovered",
  "lead.research.completed",
  "lead.audit.completed",
  "lead.scored",
  "lead.qualified",
  "lead.rejected",
  "strategy.generated",
  "demo.requested",
  "demo.completed",
  "demo.failed",
  "qa.failed",
  "qa.passed",
  "deployment.completed",
  "deployment.failed",
  "outreach.prepared",
  "outreach.sent",
  "message.received",
  "message.sent",
  "lead.interested",
  "lead.not_interested",
  "proposal.generated",
  "proposal.approved",
  "proposal.accepted",
  "client.created",
  "project.started",
  "project.stage_changed",
  "support.created",
  "upsell.detected",
  "approval.requested",
  "approval.resolved",
  "agent.started",
  "agent.completed",
  "agent.failed",
  "automation.paused",
  "automation.resumed",
  "task.created",
  "task.completed",
  "task.failed",
];

class EventBus {
  private handlers = new Map<string, Set<Handler>>();
  private history: Array<{ event: NexoraEvent; payload: EventPayload; at: string }> = [];
  private queue: Array<{ event: NexoraEvent; handler: Handler; payload: EventPayload }> = [];
  private draining = false;

  on(event: NexoraEvent | "*", handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  once(event: NexoraEvent, handler: Handler): () => void {
    const off = this.on(event, async (p) => {
      off();
      await handler(p);
    });
    return off;
  }

  /**
   * Dispatch handlers on a queue rather than inline.
   *
   * Handlers routinely re-enter the bus (a build emits `demo.completed`, which
   * runs QA, which emits `qa.failed`, which rebuilds). Awaiting each handler
   * inline turns that into synchronous recursion that grows the stack and the
   * retained payloads on every cycle — a runaway rebuild loop would exhaust the
   * heap. Queueing keeps re-entrancy flat, so a bounded loop stays bounded and
   * an unbounded one is a task backlog instead of a crash.
   */
  async emit(event: NexoraEvent, payload: EventPayload = {}): Promise<void> {
    this.history.push({ event, payload, at: new Date().toISOString() });
    if (this.history.length > 500) this.history.splice(0, this.history.length - 500);

    const targets = [
      ...(this.handlers.get(event) ?? []),
      ...(this.handlers.get("*") ?? []),
    ];
    for (const handler of targets) {
      this.queue.push({ event, handler, payload });
    }
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        try {
          await job.handler(job.payload);
        } catch (err) {
          console.error(`[nexora:events] handler for ${job.event} failed`, err);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  recent(limit = 50) {
    return this.history.slice(-limit).reverse();
  }

  clear() {
    this.handlers.clear();
    this.history = [];
  }
}

export const bus = new EventBus();
export { EVENT_NAMES };

/* ------------------------------------------------------- activity logging -- */

export interface ActivityInput {
  organizationId: string;
  agentKey?: AgentKey | null;
  actorType?: ActivityEvent["actorType"];
  actionType: string;
  title: string;
  detail?: string;
  entityType?: string;
  entityId?: string;
  leadId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  riskLevel?: RiskLevel;
  status?: ActivityEvent["status"];
  meta?: Record<string, unknown>;
}

/** Persist an activity event (mission-control feed). */
export async function logActivity(input: ActivityInput): Promise<ActivityEvent> {
  const event: ActivityEvent = {
    id: newId("act"),
    organizationId: input.organizationId,
    agentKey: input.agentKey ?? null,
    actorType: input.actorType ?? (input.agentKey ? "AGENT" : "SYSTEM"),
    actionType: input.actionType,
    title: input.title,
    detail: input.detail ?? "",
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    leadId: input.leadId ?? null,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    riskLevel: input.riskLevel ?? "LOW",
    status: input.status ?? "OK",
    meta: input.meta ?? {},
    createdAt: new Date().toISOString(),
  };
  await db.insert("activity_events", event);
  return event;
}

/** Persist a notification and surface it in the notification center. */
export async function notify(input: {
  organizationId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  href?: string | null;
  severity?: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
}): Promise<void> {
  await db.insert("notifications", {
    id: newId("ntf"),
    organizationId: input.organizationId,
    type: input.type,
    title: input.title,
    body: input.body ?? "",
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    href: input.href ?? null,
    severity: input.severity ?? "INFO",
    read: false,
    createdAt: new Date().toISOString(),
  });
}
