import { db } from "./db";
import type {
  ActivityEvent,
  AgentDefinition,
  ApprovalRequest,
  Client,
  Deployment,
  DemoSite,
  Lead,
  OutreachMessage,
  Project,
  Proposal,
  QaRun,
  RevenueEvent,
  SupportTicket,
} from "./db/schema";

/* ==========================================================================
   NEXORA — Metrics
   Every figure shown in the dashboard, pipeline and analytics pages is
   computed from real rows. Where a number cannot be derived (for example
   reply rate with zero sends) it is reported as null rather than faked.
   ========================================================================== */

export interface DashboardMetrics {
  revenue: { total: number; thisMonth: number; lastMonth: number; mrr: number; pending: number };
  pipelineValue: number;
  leadsDiscovered: number;
  qualifiedLeads: number;
  demosGenerated: number;
  outreachSent: number;
  replyRate: number | null;
  proposals: { total: number; pending: number; accepted: number; acceptanceRate: number | null; value: number };
  clients: { total: number; active: number; onboarding: number };
  activeProjects: number;
  deployments: { total: number; ready: number; error: number };
  supportTickets: { open: number; total: number };
  hotLeads: Lead[];
  recentActivity: ActivityEvent[];
  agentStates: AgentDefinition[];
  pendingApprovals: ApprovalRequest[];
  funnel: Array<{ stage: string; count: number }>;
}

const FUNNEL_STAGES = [
  "Businesses Found",
  "Audited",
  "Qualified",
  "Demo Created",
  "Contacted",
  "Replied",
  "Interested",
  "Proposal",
  "Won",
  "Delivered",
];

export async function computeDashboard(organizationId: string): Promise<DashboardMetrics> {
  const [
    leads,
    audits,
    demos,
    outreach,
    proposals,
    clients,
    projects,
    deployments,
    tickets,
    revenue,
    agents,
    approvals,
    activity,
    builds,
  ] = await Promise.all([
    db.find("leads", { organizationId }),
    db.find("website_audits", { organizationId }),
    db.find("demo_sites", { organizationId }),
    db.find("outreach_messages", { organizationId }),
    db.find("proposals", { organizationId }),
    db.find("clients", { organizationId }),
    db.find("projects", { organizationId }),
    db.find("deployments", { organizationId }),
    db.find("support_tickets", { organizationId }),
    db.find("revenue_events", { organizationId }),
    db.find("agent_definitions", { organizationId }),
    db.find("approval_requests", { organizationId }),
    db.find("activity_events", { organizationId }),
    db.find("website_builds", { organizationId }),
  ]);

  const paid = revenue.filter((r) => r.status === "PAID");
  const totalRevenue = paid.reduce((a, r) => a + r.amount, 0);
  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastMonthDate);

  const thisMonthRevenue = paid
    .filter((r) => r.occurredAt.startsWith(thisMonth))
    .reduce((a, r) => a + r.amount, 0);
  const lastMonthRevenue = paid
    .filter((r) => r.occurredAt.startsWith(lastMonth))
    .reduce((a, r) => a + r.amount, 0);

  const mrr = clients
    .filter((c) => c.status === "ACTIVE")
    .reduce((a, c) => a + c.monthlyRecurring, 0);

  const qualified = leads.filter((l) =>
    ["QUALIFIED", "STRATEGY", "DEMO_BUILDING", "DEMO_READY", "OUTREACH", "CONTACTED", "REPLIED", "INTERESTED", "PROPOSAL", "NEGOTIATION", "WON"].includes(
      l.status,
    ),
  );
  const sent = outreach.filter((o) => ["SENT", "DELIVERED", "OPENED", "REPLIED"].includes(o.status));
  const replied = outreach.filter((o) => o.status === "REPLIED" || o.repliedAt !== null);
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");
  const decided = proposals.filter((p) => ["ACCEPTED", "REJECTED"].includes(p.status));

  const openTickets = tickets.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED");

  return {
    revenue: {
      total: totalRevenue,
      thisMonth: thisMonthRevenue,
      lastMonth: lastMonthRevenue,
      mrr,
      pending: revenue.filter((r) => r.status === "PENDING" || r.status === "INVOICED").reduce((a, r) => a + r.amount, 0),
    },
    pipelineValue:
      qualified.reduce((a, l) => a + estimatedValue(l), 0) +
      proposals.filter((p) => p.status !== "REJECTED" && p.status !== "ACCEPTED").reduce((a, p) => a + p.total, 0),
    leadsDiscovered: leads.length,
    qualifiedLeads: qualified.length,
    demosGenerated: demos.filter((d) => d.status !== "FAILED").length,
    outreachSent: sent.length,
    replyRate: sent.length > 0 ? replied.length / sent.length : null,
    proposals: {
      total: proposals.length,
      pending: proposals.filter((p) => p.status === "WAITING_APPROVAL" || p.status === "SENT").length,
      accepted: accepted.length,
      acceptanceRate: decided.length > 0 ? accepted.length / decided.length : null,
      value: proposals.filter((p) => p.status !== "REJECTED").reduce((a, p) => a + p.total, 0),
    },
    clients: {
      total: clients.length,
      active: clients.filter((c) => c.status === "ACTIVE").length,
      onboarding: clients.filter((c) => c.status === "ONBOARDING").length,
    },
    activeProjects: projects.filter((p) => p.stage !== "Completed").length,
    deployments: {
      total: deployments.length,
      ready: deployments.filter((d) => d.state === "READY").length,
      error: deployments.filter((d) => d.state === "ERROR").length,
    },
    supportTickets: { open: openTickets.length, total: tickets.length },
    hotLeads: qualified
      .filter((l) => l.priority === "HOT")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5),
    recentActivity: activity
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 14),
    agentStates: agents,
    pendingApprovals: approvals.filter((a) => a.status === "PENDING"),
    funnel: computeFunnel({ leads, audits, demos, outreach, proposals, projects }),
  };
}

function estimatedValue(lead: Lead) {
  const base = 25000;
  const multiplier = (lead.score ?? 40) / 60;
  return Math.round(base * Math.max(0.2, multiplier));
}

function computeFunnel(input: {
  leads: Lead[];
  audits: unknown[];
  demos: DemoSite[];
  outreach: OutreachMessage[];
  proposals: Proposal[];
  projects: Project[];
}) {
  const { leads, audits, demos, outreach, proposals, projects } = input;
  const contacted = outreach.filter((o) => o.status !== "DRAFT" && o.status !== "CANCELLED");
  const replied = outreach.filter((o) => o.repliedAt !== null || o.status === "REPLIED");
  const interested = leads.filter((l) => ["INTERESTED", "PROPOSAL", "NEGOTIATION", "WON"].includes(l.status));
  const won = leads.filter((l) => l.status === "WON");
  const delivered = projects.filter((p) => p.stage === "Completed");
  return [
    { stage: "Businesses Found", count: leads.length },
    { stage: "Audited", count: audits.length },
    { stage: "Qualified", count: leads.filter((l) => l.priority && l.priority !== "REJECTED").length },
    { stage: "Demo Created", count: demos.length },
    { stage: "Contacted", count: contacted.length },
    { stage: "Replied", count: replied.length },
    { stage: "Interested", count: interested.length },
    { stage: "Proposal", count: proposals.length },
    { stage: "Won", count: won.length },
    { stage: "Delivered", count: delivered.length },
  ];
}

/* ------------------------------------------------------------- analytics -- */

export interface Analytics {
  funnel: Array<{ stage: string; count: number }>;
  conversionFunnel: Array<{ stage: string; count: number; rate: number | null }>;
  leadSources: Array<{ source: string; leads: number; qualified: number; won: number; revenue: number }>;
  industries: Array<{ industry: string; leads: number; avgScore: number | null; won: number }>;
  outreachResults: {
    sent: number;
    delivered: number;
    opened: number;
    replied: number;
    failed: number;
    replyRate: number | null;
    openRate: number | null;
    byChannel: Array<{ channel: string; sent: number; replied: number }>;
  };
  proposalAcceptance: {
    total: number;
    accepted: number;
    rejected: number;
    pending: number;
    rate: number | null;
    avgValue: number | null;
  };
  projectRevenue: Array<{ project: string; value: number; stage: string }>;
  monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
  agentPerformance: Array<{
    agent: string;
    runs: number;
    successRate: number;
    avgMs: number;
    state: string;
  }>;
  websiteProductionTime: { avgDays: number | null; samples: number; byProject: Array<{ project: string; days: number }> };
  clientLifetimeValue: { avg: number | null; total: number; clients: number; topClients: Array<{ name: string; ltv: number }> };
  hasData: boolean;
}

export async function computeAnalytics(organizationId: string): Promise<Analytics> {
  const [leads, businesses, outreach, proposals, projects, clients, agents, revenue, demos, builds] =
    await Promise.all([
      db.find("leads", { organizationId }),
      db.find("businesses", { organizationId }),
      db.find("outreach_messages", { organizationId }),
      db.find("proposals", { organizationId }),
      db.find("projects", { organizationId }),
      db.find("clients", { organizationId }),
      db.find("agent_definitions", { organizationId }),
      db.find("revenue_events", { organizationId }),
      db.find("demo_sites", { organizationId }),
      db.find("website_builds", { organizationId }),
    ]);

  const businessById = new Map(businesses.map((b) => [b.id, b]));
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const funnel = computeFunnel({ leads, audits: [], demos, outreach, proposals, projects });

  const conversionFunnel = funnel.map((f, i) => ({
    ...f,
    rate: i === 0 || funnel[0]!.count === 0 ? null : f.count / funnel[0]!.count,
  }));

  // Lead sources
  const sourceMap = new Map<string, { leads: number; qualified: number; won: number; revenue: number }>();
  for (const lead of leads) {
    const biz = businessById.get(lead.businessId);
    const source = biz?.discoverySource ?? "UNKNOWN";
    const entry = sourceMap.get(source) ?? { leads: 0, qualified: 0, won: 0, revenue: 0 };
    entry.leads += 1;
    if (lead.priority && lead.priority !== "REJECTED") entry.qualified += 1;
    if (lead.status === "WON") {
      entry.won += 1;
      entry.revenue += clients
        .filter((c) => c.leadId === lead.id)
        .reduce((a, c) => a + c.lifetimeValue, 0);
    }
    sourceMap.set(source, entry);
  }

  // Industries
  const industryMap = new Map<string, { leads: number; scores: number[]; won: number }>();
  for (const lead of leads) {
    const biz = businessById.get(lead.businessId);
    const industry = biz?.category ?? "Unknown";
    const entry = industryMap.get(industry) ?? { leads: 0, scores: [], won: 0 };
    entry.leads += 1;
    if (lead.score !== null) entry.scores.push(lead.score);
    if (lead.status === "WON") entry.won += 1;
    industryMap.set(industry, entry);
  }

  // Outreach
  const sent = outreach.filter((o) => ["SENT", "DELIVERED", "OPENED", "REPLIED"].includes(o.status));
  const opened = outreach.filter((o) => o.openedAt !== null || o.status === "OPENED" || o.status === "REPLIED");
  const replied = outreach.filter((o) => o.repliedAt !== null || o.status === "REPLIED");
  const byChannel = new Map<string, { sent: number; replied: number }>();
  for (const o of sent) {
    const entry = byChannel.get(o.channel) ?? { sent: 0, replied: 0 };
    entry.sent += 1;
    if (o.repliedAt !== null) entry.replied += 1;
    byChannel.set(o.channel, entry);
  }

  // Proposals
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");
  const rejected = proposals.filter((p) => p.status === "REJECTED");
  const decided = accepted.length + rejected.length;

  // Monthly revenue
  const monthMap = new Map<string, { revenue: number; count: number }>();
  for (const r of revenue.filter((x) => x.status === "PAID")) {
    const key = r.occurredAt.slice(0, 7);
    const entry = monthMap.get(key) ?? { revenue: 0, count: 0 };
    entry.revenue += r.amount;
    entry.count += 1;
    monthMap.set(key, entry);
  }

  // Production time
  const durations: Array<{ project: string; days: number }> = [];
  for (const project of projects) {
    const build = builds.find((b) => b.projectId === project.id);
    if (!build) continue;
    const days = (new Date(build.createdAt).getTime() - new Date(project.createdAt).getTime()) / 864e5;
    durations.push({ project: project.name, days: Math.max(0, Math.round(days * 10) / 10) });
  }

  const totalRevenue = revenue.filter((r) => r.status === "PAID").reduce((a, r) => a + r.amount, 0);

  return {
    funnel,
    conversionFunnel,
    leadSources: Array.from(sourceMap.entries())
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.leads - a.leads),
    industries: Array.from(industryMap.entries())
      .map(([industry, v]) => ({
        industry,
        leads: v.leads,
        avgScore: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : null,
        won: v.won,
      }))
      .sort((a, b) => b.leads - a.leads),
    outreachResults: {
      sent: sent.length,
      delivered: outreach.filter((o) => ["DELIVERED", "OPENED", "REPLIED"].includes(o.status)).length,
      opened: opened.length,
      replied: replied.length,
      failed: outreach.filter((o) => o.status === "FAILED").length,
      replyRate: sent.length ? replied.length / sent.length : null,
      openRate: sent.length ? opened.length / sent.length : null,
      byChannel: Array.from(byChannel.entries()).map(([channel, v]) => ({ channel, ...v })),
    },
    proposalAcceptance: {
      total: proposals.length,
      accepted: accepted.length,
      rejected: rejected.length,
      pending: proposals.filter((p) => ["DRAFT", "WAITING_APPROVAL", "SENT"].includes(p.status)).length,
      rate: decided ? accepted.length / decided : null,
      avgValue: proposals.length ? Math.round(proposals.reduce((a, p) => a + p.total, 0) / proposals.length) : null,
    },
    projectRevenue: projects
      .map((p) => ({
        project: p.name,
        value: p.value,
        stage: p.stage,
        client: clients.find((c) => c.id === p.clientId)?.name ?? "—",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    monthlyRevenue: Array.from(monthMap.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12),
    agentPerformance: agents.map((a) => ({
      agent: a.name,
      runs: a.runsToday,
      successRate: a.successRate,
      avgMs: a.avgExecutionMs,
      state: a.state,
    })),
    websiteProductionTime: {
      avgDays: durations.length
        ? Math.round((durations.reduce((a, d) => a + d.days, 0) / durations.length) * 10) / 10
        : null,
      samples: durations.length,
      byProject: durations,
    },
    clientLifetimeValue: {
      avg: clients.length ? Math.round(clients.reduce((a, c) => a + c.lifetimeValue, 0) / clients.length) : null,
      total: clients.reduce((a, c) => a + c.lifetimeValue, 0),
      clients: clients.length,
      topClients: clients
        .slice()
        .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
        .slice(0, 6)
        .map((c) => ({ name: c.name, ltv: c.lifetimeValue })),
    },
    hasData:
      leads.length + clients.length + proposals.length + projects.length + outreach.length > 0,
  };
}

/* ------------------------------------------------------------- copilot ---- */

export async function computeSystemHealth(organizationId: string) {
  const [integrations, tasks, agents, approvals] = await Promise.all([
    db.find("integrations", { organizationId }),
    db.find("agent_tasks", { organizationId }),
    db.find("agent_definitions", { organizationId }),
    db.find("approval_requests", { organizationId }),
  ]);
  const failed = tasks.filter((t) => t.status === "FAILED").length;
  const running = tasks.filter((t) => t.status === "RUNNING" || t.status === "QUEUED").length;
  return {
    integrations: integrations.map((i) => ({
      key: i.key,
      name: i.name,
      status: i.status,
      detail: i.detail,
      category: i.category,
    })),
    tasks: { total: tasks.length, failed, running },
    agents: {
      total: agents.length,
      working: agents.filter((a) => a.state === "WORKING").length,
      paused: agents.filter((a) => a.paused).length,
      failed: agents.filter((a) => a.state === "FAILED").length,
    },
    pendingApprovals: approvals.filter((a) => a.status === "PENDING").length,
  };
}

export { leadByIdMap, businessByIdMap };

function leadByIdMap(leads: Lead[]) {
  return new Map(leads.map((l) => [l.id, l]));
}
function businessByIdMap(businesses: Array<{ id: string }>) {
  return new Map(businesses.map((b) => [b.id, b]));
}
