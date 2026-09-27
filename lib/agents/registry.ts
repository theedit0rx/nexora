import { db, newId } from "../db";
import type { AgentDefinition, AgentKey, PermissionLevel } from "../db/schema";
import { nowIso } from "../db/schema";

/* ==========================================================================
   NEXORA — Agent Registry
   The 15 specialised agents. Each has a purpose, a permission level, a
   model binding and a tool list. The Supervisor reads this registry.
   ========================================================================== */

interface AgentSeed {
  key: AgentKey;
  name: string;
  purpose: string;
  description: string;
  icon: string;
  permissionLevel: PermissionLevel;
  tools: string[];
}

export const AGENT_SEEDS: AgentSeed[] = [
  {
    key: "supervisor",
    name: "Supervisor",
    purpose:
      "The brain of NEXORA. Inspects workflow state, delegates work to the right agent, validates outputs, enforces permission rules, retries failures and stops unsafe actions.",
    description:
      "Owns the pipeline. Reads events, decides the next agent, creates approval requests and maintains the audit trail.",
    icon: "brain",
    permissionLevel: "RED",
    tools: ["workflow.state", "agent.dispatch", "approval.create", "task.retry", "audit.write"],
  },
  {
    key: "scout",
    name: "Scout",
    purpose:
      "Finds potential businesses from Google Places, public web search, CSV imports and manual entry, then dedupes them into leads.",
    description:
      "Discovery is multi-source by design so NEXORA never depends on a single provider.",
    icon: "radar",
    permissionLevel: "GREEN",
    tools: ["google_places.search", "web_search.search", "csv.import", "lead.dedupe", "lead.create"],
  },
  {
    key: "researcher",
    name: "Researcher",
    purpose:
      "Builds a structured Business Intelligence profile for each lead: what they do, who they serve, how they appear online and where the digital gaps are.",
    description: "Only records what is observable from public signals — never invents facts.",
    icon: "search",
    permissionLevel: "GREEN",
    tools: ["website.fetch", "social.read", "business.profile", "report.create"],
  },
  {
    key: "auditor",
    name: "Website Auditor",
    purpose:
      "Audits a lead's public website across mobile, navigation, hierarchy, broken pages, CTAs, WhatsApp, forms, booking, ecommerce, performance, SEO, accessibility, HTTPS, metadata and trust elements.",
    description: "Produces specific, evidence-backed findings. Never fabricates problems.",
    icon: "stethoscope",
    permissionLevel: "GREEN",
    tools: ["website.fetch", "html.parse", "link.check", "lighthouse.heuristics", "audit.create"],
  },
  {
    key: "scorer",
    name: "Opportunity Scorer",
    purpose:
      "Scores each lead 0–100 from weighted factors and stores every factor, not just the final number, so the reasoning is auditable.",
    description: "Produces HOT / WARM / COLD / REJECTED priorities.",
    icon: "gauge",
    permissionLevel: "GREEN",
    tools: ["score.compute", "priority.assign", "opportunity.create"],
  },
  {
    key: "strategist",
    name: "Strategist",
    purpose:
      "Decides what website would actually make sense for the business — page structure, components, theme, conversion goals and SEO direction.",
    description: "Selects from the NEXORA component library instead of inventing a bespoke layout.",
    icon: "compass",
    permissionLevel: "GREEN",
    tools: ["template.select", "component.plan", "theme.pick", "strategy.create"],
  },
  {
    key: "builder",
    name: "Demo Builder",
    purpose:
      "Generates a customised mini-site from the approved strategy using the reusable NEXORA component library.",
    description: "Business-specific copy, responsive layout, premium UI, SEO metadata and a theme.",
    icon: "hammer",
    permissionLevel: "GREEN",
    tools: ["site.generate", "content.compose", "asset.placeholder", "file.write"],
  },
  {
    key: "qa",
    name: "QA Engineer",
    purpose:
      "Automatically inspects generated sites for build success, broken routes, broken links, form errors, mobile/tablet/desktop layout, overflow, accessibility, metadata and performance concerns.",
    description: "Returns PASS, PASS_WITH_WARNINGS or FAIL with exact problems for the Builder.",
    icon: "shield-check",
    permissionLevel: "GREEN",
    tools: ["qa.run", "html.validate", "link.check", "a11y.check", "repair.request"],
  },
  {
    key: "deployer",
    name: "Deployer",
    purpose:
      "Handles preview and production deployments, deployment history, health checks, project URLs and custom domain status.",
    description: "Domain purchases, billing and destructive deployment changes require owner approval.",
    icon: "rocket",
    permissionLevel: "YELLOW",
    tools: ["deploy.preview", "deploy.production", "deploy.status", "deploy.rollback", "domain.status"],
  },
  {
    key: "outreach",
    name: "Outreach",
    purpose:
      "Generates personalised outreach grounded in the actual research, and manages drafts, approvals, rate limits, duplicates, opt-outs and suppression.",
    description: "Never sends bulk unsolicited batches. Sending defaults to approval-required.",
    icon: "send",
    permissionLevel: "YELLOW",
    tools: [
      "outreach.draft",
      "outreach.send",
      "whatsapp.prepare",
      "suppression.check",
      "rate.limit",
      "contact.history",
    ],
  },
  {
    key: "sales",
    name: "Sales",
    purpose:
      "Classifies incoming prospect messages (interested, question, price query, not interested, follow-up, needs human, spam) and drafts replies.",
    description: "Complex negotiation is escalated to the owner rather than answered automatically.",
    icon: "handshake",
    permissionLevel: "YELLOW",
    tools: ["message.classify", "reply.draft", "intent.log", "escalate.owner"],
  },
  {
    key: "proposal",
    name: "Proposal",
    purpose:
      "Generates professional proposals from the accepted strategy and the configured pricing rules — never invented numbers.",
    description: "Produces scope, deliverables, milestones, price, revision policy, maintenance and terms placeholders.",
    icon: "file-text",
    permissionLevel: "YELLOW",
    tools: ["proposal.draft", "pricing.compute", "proposal.send", "proposal.expire"],
  },
  {
    key: "onboarding",
    name: "Onboarding",
    purpose:
      "Collects the assets and information needed to build the production site and tracks completion percentage.",
    description: "Company details, logo, brand colours, services, images, features, inspiration and domain.",
    icon: "clipboard-list",
    permissionLevel: "YELLOW",
    tools: ["onboarding.request", "onboarding.collect", "completion.compute"],
  },
  {
    key: "production_builder",
    name: "Production Builder",
    purpose:
      "Generates the production website from the approved strategy, accepted proposal, onboarding data and approved demo.",
    description: "Produces a maintainable multi-file project — not one giant generated file.",
    icon: "building",
    permissionLevel: "YELLOW",
    tools: ["project.scaffold", "site.generate", "repo.map", "build.record"],
  },
  {
    key: "support",
    name: "Support",
    purpose:
      "Triages client issues into categories, resolves routine maintenance and routes large requests into upsell opportunities.",
    description: "Minor approved maintenance can be automated; feature requests become revenue.",
    icon: "life-buoy",
    permissionLevel: "YELLOW",
    tools: ["ticket.triage", "ticket.resolve", "upsell.detect", "maintenance.apply"],
  },
];

export async function ensureAgentRegistry(organizationId: string): Promise<void> {
  const existing = await db.find("agent_definitions", { organizationId });
  const have = new Set(existing.map((a) => a.key));
  for (const seed of AGENT_SEEDS) {
    if (have.has(seed.key)) continue;
    const def: AgentDefinition = {
      id: newId("agt"),
      organizationId,
      key: seed.key,
      name: seed.name,
      purpose: seed.purpose,
      description: seed.description,
      icon: seed.icon,
      state: "IDLE",
      permissionLevel: seed.permissionLevel,
      model: "local-deterministic",
      provider: "local",
      tools: seed.tools,
      config: {},
      runsToday: 0,
      successRate: 1,
      avgExecutionMs: 0,
      lastRunAt: null,
      currentTaskId: null,
      currentTaskLabel: null,
      consecutiveFailures: 0,
      paused: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.insert("agent_definitions", def);
  }
}

export async function getAgent(organizationId: string, key: AgentKey) {
  return db.findOne("agent_definitions", { organizationId, key });
}

export async function listAgents(organizationId: string) {
  const agents = await db.find("agent_definitions", { organizationId });
  const order = AGENT_SEEDS.map((s) => s.key);
  return agents.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export async function setAgentPaused(
  organizationId: string,
  key: AgentKey,
  paused: boolean,
): Promise<AgentDefinition | null> {
  const agent = await getAgent(organizationId, key);
  if (!agent) return null;
  return db.update("agent_definitions", agent.id, {
    paused,
    state: paused ? "PAUSED" : "IDLE",
    currentTaskId: paused ? null : agent.currentTaskId,
    currentTaskLabel: paused ? null : agent.currentTaskLabel,
    updatedAt: nowIso(),
  });
}

/** True when the agent is available to accept work. */
export async function isAgentAvailable(organizationId: string, key: AgentKey): Promise<boolean> {
  const agent = await getAgent(organizationId, key);
  return Boolean(agent && !agent.paused);
}
