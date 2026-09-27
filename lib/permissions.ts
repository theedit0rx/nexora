import type { AgentKey, PermissionLevel, RiskLevel } from "./db/schema";

/* ==========================================================================
   NEXORA — Permission Engine
   --------------------------------------------------------------------------
   GREEN  → automatic, no approval
   YELLOW → automatic only when the owner explicitly enables the setting
   RED    → always requires owner approval, never automatic
   ========================================================================== */

export type ActionKey =
  | "research"
  | "website_analysis"
  | "lead_scoring"
  | "generate_code"
  | "generate_demo"
  | "generate_draft"
  | "qa"
  | "screenshots"
  | "preview_deployment"
  | "internal_analytics"
  | "outreach_sending"
  | "routine_lead_replies"
  | "follow_ups"
  | "minor_website_edits"
  | "preview_deployment_updates"
  | "unusual_pricing"
  | "discount_beyond_limit"
  | "refund"
  | "contract"
  | "payment_change"
  | "production_destructive"
  | "delete_client_project"
  | "domain_transfer"
  | "purchase"
  | "account_permission_change"
  | "expose_secret"
  | "destructive_database"
  | "client_onboarding"
  | "production_build"
  | "production_deployment"
  | "send_proposal"
  | "upsell_presentation"
  | "support_auto_resolve"
  | "pause_agent"
  | "retry_task";

export const ACTION_MATRIX: Record<ActionKey, { level: PermissionLevel; risk: RiskLevel }> = {
  // ---- GREEN ----
  research: { level: "GREEN", risk: "LOW" },
  website_analysis: { level: "GREEN", risk: "LOW" },
  lead_scoring: { level: "GREEN", risk: "LOW" },
  generate_code: { level: "GREEN", risk: "LOW" },
  generate_demo: { level: "GREEN", risk: "LOW" },
  generate_draft: { level: "GREEN", risk: "LOW" },
  qa: { level: "GREEN", risk: "LOW" },
  screenshots: { level: "GREEN", risk: "LOW" },
  preview_deployment: { level: "GREEN", risk: "LOW" },
  internal_analytics: { level: "GREEN", risk: "LOW" },
  pause_agent: { level: "GREEN", risk: "LOW" },
  retry_task: { level: "GREEN", risk: "LOW" },

  // ---- YELLOW (auto only if owner enables) ----
  outreach_sending: { level: "YELLOW", risk: "HIGH" },
  routine_lead_replies: { level: "YELLOW", risk: "MEDIUM" },
  follow_ups: { level: "YELLOW", risk: "MEDIUM" },
  minor_website_edits: { level: "YELLOW", risk: "MEDIUM" },
  preview_deployment_updates: { level: "YELLOW", risk: "MEDIUM" },
  client_onboarding: { level: "YELLOW", risk: "LOW" },
  send_proposal: { level: "YELLOW", risk: "MEDIUM" },
  upsell_presentation: { level: "YELLOW", risk: "MEDIUM" },
  support_auto_resolve: { level: "YELLOW", risk: "MEDIUM" },
  production_build: { level: "YELLOW", risk: "MEDIUM" },
  production_deployment: { level: "YELLOW", risk: "HIGH" },

  // ---- RED (always approval) ----
  unusual_pricing: { level: "RED", risk: "HIGH" },
  discount_beyond_limit: { level: "RED", risk: "HIGH" },
  refund: { level: "RED", risk: "CRITICAL" },
  contract: { level: "RED", risk: "CRITICAL" },
  payment_change: { level: "RED", risk: "CRITICAL" },
  production_destructive: { level: "RED", risk: "CRITICAL" },
  delete_client_project: { level: "RED", risk: "CRITICAL" },
  domain_transfer: { level: "RED", risk: "CRITICAL" },
  purchase: { level: "RED", risk: "CRITICAL" },
  account_permission_change: { level: "RED", risk: "CRITICAL" },
  expose_secret: { level: "RED", risk: "CRITICAL" },
  destructive_database: { level: "RED", risk: "CRITICAL" },
};

export interface PermissionSettings {
  allowAutoOutreach: boolean;
  allowAutoReplies: boolean;
  allowAutoFollowUps: boolean;
  allowAutoMinorEdits: boolean;
  allowAutoPreviewUpdates: boolean;
}

export interface Decision {
  allowed: boolean;
  requiresApproval: boolean;
  level: PermissionLevel;
  risk: RiskLevel;
  reason: string;
}

const YELLOW_SWITCH: Partial<Record<ActionKey, keyof PermissionSettings>> = {
  outreach_sending: "allowAutoOutreach",
  routine_lead_replies: "allowAutoReplies",
  follow_ups: "allowAutoFollowUps",
  minor_website_edits: "allowAutoMinorEdits",
  preview_deployment_updates: "allowAutoPreviewUpdates",
  production_deployment: "allowAutoPreviewUpdates",
};

/**
 * Decide whether an action may run automatically, must be queued for owner
 * approval, or is blocked outright by the autonomy kill-switch.
 */
export function evaluateAction(
  action: ActionKey,
  settings: PermissionSettings,
  opts: { autonomyPaused?: boolean } = {},
): Decision {
  const entry = ACTION_MATRIX[action];
  const level = entry?.level ?? "YELLOW";
  const risk = entry?.risk ?? "MEDIUM";

  if (level === "GREEN") {
    return {
      allowed: !opts.autonomyPaused,
      requiresApproval: false,
      level,
      risk,
      reason: "Green action — safe to run automatically.",
    };
  }

  if (level === "YELLOW") {
    const switchKey = YELLOW_SWITCH[action];
    const enabled = switchKey ? settings[switchKey] : false;
    if (enabled && !opts.autonomyPaused) {
      return {
        allowed: true,
        requiresApproval: false,
        level,
        risk,
        reason: `Yellow action — owner has explicitly enabled ${switchKey}.`,
      };
    }
    return {
      allowed: false,
      requiresApproval: true,
      level,
      risk,
      reason: enabled
        ? "Yellow action — autonomy is paused, so this requires approval."
        : `Yellow action — requires owner approval until ${switchKey ?? "the matching setting"} is enabled.`,
    };
  }

  return {
    allowed: false,
    requiresApproval: true,
    level: "RED",
    risk,
    reason: "Red action — always requires explicit owner approval.",
  };
}

/** Human-readable description of the permission tiers. */
export const PERMISSION_DOCS: Array<{
  level: PermissionLevel;
  title: string;
  summary: string;
  items: string[];
}> = [
  {
    level: "GREEN",
    title: "Autonomous",
    summary: "Runs automatically with no approval step. Read-only or reversible.",
    items: [
      "research",
      "public website analysis",
      "lead scoring",
      "generating code",
      "generating demos",
      "generating drafts",
      "QA",
      "screenshots",
      "preview deployments",
      "internal analytics",
    ],
  },
  {
    level: "YELLOW",
    title: "Conditionally autonomous",
    summary:
      "Runs automatically only when the owner turns the matching switch on. Otherwise an approval request is created.",
    items: [
      "outreach sending",
      "routine lead replies",
      "follow-ups",
      "minor website edits",
      "preview deployment updates",
    ],
  },
  {
    level: "RED",
    title: "Owner approval always",
    summary:
      "Never runs automatically. Financial, destructive, contractual or irreversible actions always wait for the owner.",
    items: [
      "final unusual pricing changes",
      "discounts beyond configured limits",
      "refunds",
      "contracts",
      "payment changes",
      "production destructive operations",
      "deleting client projects",
      "domain transfers",
      "purchases",
      "account permission changes",
      "exposing secrets",
      "destructive database operations",
    ],
  },
];

/** Agents that are allowed to request RED actions (all of them, but audited). */
export const AGENTS_REQUIRING_APPROVAL: AgentKey[] = [
  "supervisor",
  "outreach",
  "sales",
  "proposal",
  "deployer",
  "production_builder",
  "support",
];
