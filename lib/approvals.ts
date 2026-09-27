import { db, newId } from "./db";
import { nowIso, type ApprovalRequest, type RiskLevel } from "./db/schema";
import { logActivity, notify } from "./events/bus";
import { evaluateAction, type ActionKey, type PermissionSettings } from "./permissions";
import { agentLabel } from "./tasks/engine";

/* ==========================================================================
   NEXORA — Approval Center
   --------------------------------------------------------------------------
   RED and gated YELLOW actions are turned into durable approval requests
   with a full audit trail. Nothing irreversible happens without the owner.
   ========================================================================== */

export interface CreateApprovalInput {
  organizationId: string;
  action: ActionKey | string;
  title: string;
  reason?: string;
  requestingAgent: ApprovalRequest["requestingAgent"];
  entityType?: string;
  entityId?: string;
  riskLevel?: RiskLevel;
  payload?: Record<string, unknown>;
  expiresInHours?: number;
}

export async function createApproval(input: CreateApprovalInput): Promise<ApprovalRequest> {
  const decision = evaluateAction(
    input.action as ActionKey,
    {
      allowAutoOutreach: false,
      allowAutoReplies: false,
      allowAutoFollowUps: false,
      allowAutoMinorEdits: false,
      allowAutoPreviewUpdates: false,
    },
  );

  const request: ApprovalRequest = {
    id: newId("apr"),
    organizationId: input.organizationId,
    action: input.action,
    title: input.title,
    reason: input.reason ?? decision.reason,
    requestingAgent: input.requestingAgent,
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    riskLevel: input.riskLevel ?? decision.risk,
    permissionLevel: decision.level,
    status: "PENDING",
    payload: input.payload ?? {},
    diff: {},
    decisionNote: null,
    decidedBy: null,
    decidedAt: null,
    expiresAt: input.expiresInHours
      ? new Date(Date.now() + input.expiresInHours * 3600_000).toISOString()
      : null,
    createdAt: nowIso(),
  };
  await db.insert("approval_requests", request);

  await logActivity({
    organizationId: input.organizationId,
    agentKey: input.requestingAgent,
    actionType: "approval.requested",
    title: `Approval requested: ${input.title}`,
    detail: input.reason ?? decision.reason,
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    riskLevel: request.riskLevel,
    status: "PENDING",
  });
  await notify({
    organizationId: input.organizationId,
    type: "approval_required",
    title: `Approval required: ${input.title}`,
    body: `${agentLabel(input.requestingAgent)} · ${request.permissionLevel} · ${request.riskLevel} risk`,
    entityType: "approval",
    entityId: request.id,
    href: "/approvals",
    severity: request.riskLevel === "CRITICAL" ? "DANGER" : "WARNING",
  });
  return request;
}

export interface DecideInput {
  organizationId: string;
  approvalId: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
  decidedBy: string;
  modifiedPayload?: Record<string, unknown>;
}

/**
 * Resolve an approval request and run the associated side effect.
 * The execution map is the single place where "approve → do the thing"
 * lives, so every irreversible action is traceable to an approval.
 */
export async function resolveApproval(input: DecideInput): Promise<{
  approval: ApprovalRequest;
  executed: boolean;
  result?: unknown;
  error?: string;
}> {
  const approval = await db.byId("approval_requests", input.approvalId);
  if (!approval || approval.organizationId !== input.organizationId) throw new Error("FORBIDDEN");
  if (approval.status !== "PENDING") {
    throw new Error(`Approval is already ${approval.status.toLowerCase()}`);
  }

  const status = input.decision === "APPROVED" ? (input.modifiedPayload ? "MODIFIED" : "APPROVED") : "REJECTED";
  const updated = await db.update("approval_requests", input.approvalId, {
    status,
    decisionNote: input.note ?? null,
    decidedBy: input.decidedBy,
    decidedAt: nowIso(),
    payload: input.modifiedPayload ? { ...approval.payload, ...input.modifiedPayload } : approval.payload,
  });

  await logActivity({
    organizationId: input.organizationId,
    actorType: "USER",
    agentKey: approval.requestingAgent,
    actionType: "approval.resolved",
    title: `Approval ${input.decision === "APPROVED" ? "approved" : "rejected"}: ${approval.title}`,
    detail: input.note ?? "",
    entityType: "approval",
    entityId: approval.id,
    riskLevel: approval.riskLevel,
    status: input.decision === "APPROVED" ? "OK" : "WARN",
  });

  await db.insert("audit_logs", {
    id: newId("aud"),
    organizationId: input.organizationId,
    actorType: "USER",
    actorId: input.decidedBy,
    actorLabel: "Owner",
    action: `approval.${input.decision.toLowerCase()}`,
    entityType: "approval_requests",
    entityId: approval.id,
    before: { status: approval.status, payload: approval.payload },
    after: { status, payload: updated.payload, note: input.note ?? "" },
    ip: "",
    createdAt: nowIso(),
  });

  if (input.decision === "REJECTED") {
    await applyRejection(input.organizationId, approval);
    return { approval: updated, executed: false };
  }

  try {
    const result = await executeApproval(input.organizationId, updated);
    return { approval: updated, executed: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logActivity({
      organizationId: input.organizationId,
      agentKey: approval.requestingAgent,
      actionType: "approval.execution_failed",
      title: `Approved action failed to execute: ${approval.title}`,
      detail: message,
      entityType: "approval",
      entityId: approval.id,
      riskLevel: "HIGH",
      status: "ERROR",
    });
    return { approval: updated, executed: false, error: message };
  }
}

async function applyRejection(organizationId: string, approval: ApprovalRequest) {
  if (approval.action === "outreach_sending" && approval.entityType === "outreach_message") {
    await db.update("outreach_messages", approval.entityId, {
      status: "CANCELLED",
      error: "Rejected by owner",
      updatedAt: nowIso(),
    });
  }
  if (approval.action === "discount_beyond_limit" && approval.entityType === "proposal") {
    await db.update("proposals", approval.entityId, { status: "DRAFT", updatedAt: nowIso() });
  }
  void organizationId;
}

/** The approval → execution map. Every branch is explicit and auditable. */
async function executeApproval(organizationId: string, approval: ApprovalRequest): Promise<unknown> {
  const { outreachSend } = await import("./agents/sales");

  switch (approval.action) {
    case "outreach_sending": {
      if (approval.entityType === "outreach_message") {
        // The owner has just signed off on this exact action, so the sending
        // gate must not ask a second time.
        return outreachSend(organizationId, approval.entityId, { approved: true });
      }
      return { skipped: "no outreach message attached" };
    }
    case "discount_beyond_limit": {
      if (approval.entityType === "proposal") {
        const payload = approval.payload as { requested?: number };
        const proposal = await db.byId("proposals", approval.entityId);
        if (proposal && payload.requested) {
          const discount = Math.round((proposal.subtotal * payload.requested) / 100);
          await db.update("proposals", approval.entityId, {
            discount,
            total: proposal.subtotal - discount,
            status: "DRAFT",
            updatedAt: nowIso(),
          });
          return { discount, total: proposal.subtotal - discount };
        }
      }
      return { skipped: "no proposal attached" };
    }
    case "production_deployment": {
      const { deployerDeploy } = await import("./agents/build");
      return deployerDeploy(
        organizationId,
        (approval.payload.targetType as "DEMO" | "BUILD") ?? "BUILD",
        approval.entityId,
        "PRODUCTION",
      );
    }
    case "purchase":
    case "domain_transfer":
    case "refund":
    case "contract":
      return {
        skipped: true,
        note: "Recorded as approved. This action requires a manual step in the external provider — NEXORA does not perform it automatically.",
      };
    default:
      return { skipped: true, note: `No automated execution registered for action "${approval.action}".` };
  }
}

/* ------------------------------------------------------------ summaries --- */

export async function approvalSummary(organizationId: string) {
  const all = await db.find("approval_requests", { organizationId });
  return {
    pending: all.filter((a) => a.status === "PENDING"),
    approved: all.filter((a) => a.status === "APPROVED" || a.status === "MODIFIED"),
    rejected: all.filter((a) => a.status === "REJECTED"),
    history: all.filter((a) => a.status !== "PENDING"),
    critical: all.filter((a) => a.status === "PENDING" && (a.riskLevel === "CRITICAL" || a.riskLevel === "HIGH")),
  };
}

export function requiresApproval(action: ActionKey, settings: PermissionSettings, autonomyPaused: boolean) {
  return evaluateAction(action, settings, { autonomyPaused }).requiresApproval;
}
