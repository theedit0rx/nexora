import { db } from "./db";

/* ==========================================================================
   NEXORA — Global Search
   Searches leads, clients, companies, projects, messages, proposals,
   deployments, tasks and agents from a single index.
   ========================================================================== */

export type SearchKind =
  | "lead"
  | "client"
  | "company"
  | "project"
  | "message"
  | "proposal"
  | "deployment"
  | "task"
  | "agent"
  | "website"
  | "ticket";

export interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  meta?: Record<string, string>;
}

const KIND_WEIGHT: Record<SearchKind, number> = {
  lead: 1.0,
  client: 0.95,
  company: 0.9,
  project: 0.9,
  proposal: 0.85,
  website: 0.8,
  message: 0.75,
  ticket: 0.7,
  deployment: 0.65,
  task: 0.6,
  agent: 0.55,
};

export async function globalSearch(organizationId: string, query: string, limit = 12): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];

  const [leads, businesses, clients, projects, messages, proposals, deployments, tasks, agents, demos, tickets] =
    await Promise.all([
      db.find("leads", { organizationId }),
      db.find("businesses", { organizationId }),
      db.find("clients", { organizationId }),
      db.find("projects", { organizationId }),
      db.find("messages", { organizationId }),
      db.find("proposals", { organizationId }),
      db.find("deployments", { organizationId }),
      db.find("agent_tasks", { organizationId }),
      db.find("agent_definitions", { organizationId }),
      db.find("demo_sites", { organizationId }),
      db.find("support_tickets", { organizationId }),
    ]);

  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const results: SearchResult[] = [];

  const push = (r: Omit<SearchResult, "score">) => {
    results.push({ ...r, score: relevance(r.title + " " + r.subtitle, q) * KIND_WEIGHT[r.kind] });
  };

  for (const lead of leads) {
    const biz = bizById.get(lead.businessId);
    if (!biz) continue;
    push({
      id: lead.id,
      kind: "lead",
      title: biz.name,
      subtitle: `${biz.category} · ${biz.city || "—"} · ${lead.priority ?? "Unscored"}${lead.score !== null ? ` ${lead.score}` : ""}`,
      href: `/leads/${lead.id}`,
      meta: { status: lead.status, stage: lead.pipelineStage },
    });
  }

  for (const biz of businesses) {
    push({
      id: biz.id,
      kind: "company",
      title: biz.name,
      subtitle: `${biz.category} · ${biz.city || "—"}${biz.website ? ` · ${biz.website}` : ""}`,
      href: `/leads?q=${encodeURIComponent(biz.name)}`,
      meta: { source: biz.discoverySource },
    });
  }

  for (const client of clients) {
    push({
      id: client.id,
      kind: "client",
      title: client.name,
      subtitle: `${client.status} · LTV ${client.lifetimeValue}`,
      href: `/clients/${client.id}`,
    });
  }

  for (const project of projects) {
    push({
      id: project.id,
      kind: "project",
      title: project.name,
      subtitle: `${project.stage} · ${project.progress}%`,
      href: `/projects/${project.id}`,
    });
  }

  for (const message of messages) {
    push({
      id: message.id,
      kind: "message",
      title: message.subject || message.body.slice(0, 60),
      subtitle: message.body.slice(0, 90),
      href: `/conversations`,
    });
  }

  for (const proposal of proposals) {
    const lead = proposal.leadId ? leadById.get(proposal.leadId) : null;
    const biz = lead ? bizById.get(lead.businessId) : null;
    push({
      id: proposal.id,
      kind: "proposal",
      title: `${proposal.number} — ${biz?.name ?? "Proposal"}`,
      subtitle: `${proposal.status} · ${proposal.total}`,
      href: `/proposals?id=${proposal.id}`,
    });
  }

  for (const deployment of deployments) {
    push({
      id: deployment.id,
      kind: "deployment",
      title: `${deployment.kind} deployment`,
      subtitle: `${deployment.state} · ${deployment.url || "no url"}`,
      href: `/websites`,
    });
  }

  for (const task of tasks) {
    push({
      id: task.id,
      kind: "task",
      title: `${task.agentKey} · ${task.type}`,
      subtitle: `${task.status}${task.error ? ` · ${task.error.slice(0, 60)}` : ""}`,
      href: `/agents/${task.agentKey}`,
    });
  }

  for (const agent of agents) {
    push({
      id: agent.id,
      kind: "agent",
      title: agent.name,
      subtitle: `${agent.state} · ${agent.purpose.slice(0, 70)}`,
      href: `/agents/${agent.key}`,
    });
  }

  for (const demo of demos) {
    push({
      id: demo.id,
      kind: "website",
      title: demo.businessName,
      subtitle: `${demo.templateFamily} · ${demo.status}`,
      href: `/websites?demo=${demo.id}`,
    });
  }

  for (const ticket of tickets) {
    push({
      id: ticket.id,
      kind: "ticket",
      title: ticket.subject,
      subtitle: `${ticket.category} · ${ticket.status}`,
      href: `/support?id=${ticket.id}`,
    });
  }

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function relevance(haystack: string, needle: string) {
  const h = haystack.toLowerCase();
  if (h.includes(needle)) {
    const idx = h.indexOf(needle);
    return idx === 0 ? 1 : 0.85;
  }
  // token overlap
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const matched = tokens.filter((t) => h.includes(t)).length;
  return matched / tokens.length * 0.6;
}
