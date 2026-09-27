import { db } from "./db";
import { globalSearch } from "./search";

/* ==========================================================================
   NEXORA Copilot
   --------------------------------------------------------------------------
   An intent-routed command interface. Every answer is derived from real
   application data or from an action the user explicitly confirms — the
   copilot never claims an action happened when it did not.
   ========================================================================== */

export type CopilotActionKind =
  | "answer"
  | "navigate"
  | "confirm_action"
  | "search_results"
  | "empty";

export interface CopilotAction {
  kind: CopilotActionKind;
  label: string;
  href?: string;
  payload?: Record<string, unknown>;
}

export interface CopilotResponse {
  reply: string;
  actions: CopilotAction[];
  data?: Record<string, unknown>;
}

interface Intent {
  id: string;
  patterns: RegExp[];
  examples: string[];
  handler: (q: string, organizationId: string) => Promise<CopilotResponse>;
}

const HELP: CopilotResponse = {
  reply: [
    "I can work with your live NEXORA data. Try things like:",
    "",
    "• “Find restaurants with poor websites”",
    "• “Explain why this lead scored 87”",
    "• “Show leads waiting for outreach”",
    "• “Show pending approvals”",
    "• “Draft a proposal for this client”",
    "• “Why did this deployment fail?”",
    "• “Which industries have the highest conversion?”",
    "• “Pause outreach”",
    "• “How many clients do we have?”",
  ].join("\n"),
  actions: [{ kind: "navigate", label: "Open the pipeline", href: "/pipeline" }],
};

export async function runCopilot(query: string, organizationId: string): Promise<CopilotResponse> {
  const q = query.trim();
  if (!q) return { reply: "Ask me anything about your pipeline, leads, clients, projects or agents.", actions: [] };

  const intents = buildIntents();
  for (const intent of intents) {
    if (intent.patterns.some((p) => p.test(q))) {
      return intent.handler(q, organizationId);
    }
  }
  return fallback(q, organizationId);
}

function buildIntents(): Intent[] {
  return [
    {
      id: "help",
      patterns: [/^(help|what can you do|hi|hello|hey)\b/i],
      examples: ["help"],
      handler: async () => HELP,
    },
    {
      id: "find_weak_sites",
      patterns: [
        /(find|show|list).{0,40}(restaurant|cafe|gym|clinic|salon|retail|store|coaching|school|institute|dental|interior|travel|hotel)/i,
        /(poor|bad|weak|outdated|no).{0,20}(website|site)/i,
      ],
      examples: ["find restaurants with poor websites"],
      handler: async (q, orgId) => {
        const leads = await db.find("leads", { organizationId: orgId });
        const businesses = await db.find("businesses", { organizationId: orgId });
        const audits = await db.find("website_audits", { organizationId: orgId });
        const bizById = new Map(businesses.map((b) => [b.id, b]));
        const auditByLead = new Map(audits.map((a) => [a.leadId, a]));

        const category = extractCategory(q);
        const matches = leads
          .map((lead) => ({ lead, biz: bizById.get(lead.businessId), audit: auditByLead.get(lead.id) }))
          .filter((row) => row.biz)
          .filter((row) => !category || row.biz!.category.toLowerCase().includes(category))
          .filter((row) => {
            const audit = row.audit;
            if (!audit) return !row.biz!.website;
            return !audit.hasWebsite || !audit.reachable || audit.seoScore < 60 || audit.performanceScore < 60;
          })
          .sort((a, b) => (b.lead.score ?? 0) - (a.lead.score ?? 0))
          .slice(0, 8);

        if (matches.length === 0) {
          return {
            reply: category
              ? `I couldn't find any ${category} leads with a weak website in this workspace. Try running Scout discovery from the Leads page.`
              : "I couldn't find any leads with a weak website. Run Scout discovery to populate the pipeline.",
            actions: [
              { kind: "navigate", label: "Open leads", href: "/leads" },
              { kind: "navigate", label: "Open agents", href: "/agents" },
            ],
          };
        }

        const lines = matches.map(
          (m) =>
            `• ${m.biz!.name} — ${m.biz!.city || "—"} · ${
              !m.audit
                ? "no audit yet"
                : !m.audit.hasWebsite
                  ? "no website"
                  : !m.audit.reachable
                    ? "website unreachable"
                    : `SEO ${m.audit.seoScore}/100, perf ${m.audit.performanceScore}/100`
            } · score ${m.lead.score ?? "—"}`,
        );

        return {
          reply: `Found ${matches.length} matching lead${matches.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`,
          actions: matches.slice(0, 3).map((m) => ({
            kind: "navigate" as const,
            label: `Open ${m.biz!.name}`,
            href: `/leads/${m.lead.id}`,
          })),
          data: { count: matches.length },
        };
      },
    },
    {
      id: "explain_score",
      patterns: [/why.{0,20}(score|scored|87|priority|hot|warm)/i, /explain.{0,20}score/i],
      examples: ["explain why this lead scored 87"],
      handler: async (q, orgId) => {
        const target = await resolveLead(q, orgId);
        if (!target) {
          return {
            reply: "Tell me which lead — for example “explain the score for Royal Spice Restaurant”.",
            actions: [{ kind: "navigate", label: "Open leads", href: "/leads" }],
          };
        }
        const { lead, business } = target;
        const score = (await db.find("lead_scores", { leadId: lead.id })).at(-1) ?? null;
        const audit = (await db.find("website_audits", { leadId: lead.id })).at(-1) ?? null;
        if (!score) {
          return {
            reply: `${business.name} has not been scored yet. Run the scorer from the lead page.`,
            actions: [{ kind: "navigate", label: `Open ${business.name}`, href: `/leads/${lead.id}` }],
          };
        }
        const factors = score.factors
          .slice()
          .sort((a, b) => b.contribution - a.contribution)
          .map((f) => `• ${f.label}: weight ${Math.round(f.weight * 100)}% × signal ${(f.value * 100).toFixed(0)}% → ${(f.contribution * 100).toFixed(1)} pts${f.note ? ` (${f.note})` : ""}`)
          .join("\n");
        return {
          reply: `${business.name} scored ${score.total}/100 (${score.priority}).\n\n${score.reasoning}\n\n${factors}\n\n${
            audit ? `Website audit grade: ${audit.overallGrade}.` : "No website audit on file."
          }`,
          actions: [
            { kind: "navigate", label: `Open ${business.name}`, href: `/leads/${lead.id}` },
            { kind: "navigate", label: "Open analytics", href: "/analytics" },
          ],
        };
      },
    },
    {
      id: "waiting_outreach",
      patterns: [/waiting for outreach/i, /(need|ready).{0,20}outreach/i, /outreach (queue|drafts?|pending)/i],
      examples: ["show leads waiting for outreach"],
      handler: async (_q, orgId) => {
        const leads = await db.find("leads", { organizationId: orgId });
        const businesses = await db.find("businesses", { organizationId: orgId });
        const messages = await db.find("outreach_messages", { organizationId: orgId });
        const bizById = new Map(businesses.map((b) => [b.id, b]));
        const messagedLeads = new Set(messages.map((m) => m.leadId));

        const waiting = leads
          .filter((l) => !messagedLeads.has(l.id))
          .filter((l) => ["QUALIFIED", "STRATEGY", "DEMO_READY", "AUDITED"].includes(l.status))
          .filter((l) => !l.optOut && !l.suppressed)
          .slice(0, 10);

        if (waiting.length === 0) {
          return {
            reply: "No leads are currently waiting for outreach. Every qualified lead already has a message in flight.",
            actions: [{ kind: "navigate", label: "Open outreach leads", href: "/leads?status=OUTREACH" }],
          };
        }
        return {
          reply: `${waiting.length} lead${waiting.length === 1 ? " is" : "s are"} ready for outreach:\n\n${waiting
            .map((l) => `• ${bizById.get(l.businessId)?.name ?? l.id} — ${l.priority ?? "unscored"} ${l.score ?? ""}`)
            .join("\n")}`,
          actions: [
            { kind: "navigate", label: "Open leads", href: "/leads" },
            { kind: "navigate", label: "Open approvals", href: "/approvals" },
          ],
        };
      },
    },
    {
      id: "pending_approvals",
      patterns: [/pending approvals?/i, /approvals? (waiting|pending|needed)/i, /what needs (my )?approval/i],
      examples: ["show pending approvals"],
      handler: async (_q, orgId) => {
        const approvals = await db.find("approval_requests", { organizationId: orgId });
        const pending = approvals.filter((a) => a.status === "PENDING");
        if (pending.length === 0) {
          return {
            reply: "Nothing is waiting for approval. NEXORA is not blocked on you right now.",
            actions: [{ kind: "navigate", label: "Open approval center", href: "/approvals" }],
          };
        }
        return {
          reply: `${pending.length} action${pending.length === 1 ? "" : "s"} need your approval:\n\n${pending
            .slice(0, 8)
            .map(
              (a) =>
                `• [${a.permissionLevel}/${a.riskLevel}] ${a.title} — requested by ${a.requestingAgent}`,
            )
            .join("\n")}`,
          actions: [{ kind: "navigate", label: "Open approval center", href: "/approvals" }],
        };
      },
    },
    {
      id: "deployment_failed",
      patterns: [/deployment.{0,20}fail/i, /why.{0,20}deploy/i, /build (fail|error)/i],
      examples: ["why did this deployment fail"],
      handler: async (_q, orgId) => {
        const deployments = await db.find("deployments", { organizationId: orgId });
        const failed = deployments.filter((d) => d.state === "ERROR");
        const builds = await db.find("website_builds", { organizationId: orgId });
        const failedBuilds = builds.filter((b) => b.status === "FAILED" || b.status === "QA_FAILED");
        if (failed.length === 0 && failedBuilds.length === 0) {
          return {
            reply: "No failed deployments or builds in this workspace. Everything currently deployed is healthy.",
            actions: [{ kind: "navigate", label: "Open websites", href: "/websites" }],
          };
        }
        const lines = [
          ...failed.map((d) => `• Deployment ${d.kind} for ${d.targetId}: ${d.buildLog || "no log captured"}`),
          ...failedBuilds.map((b) => `• Build v${b.version} for project ${b.projectId}: ${b.error ?? "unknown error"}`),
        ];
        return {
          reply: `Here's what failed:\n\n${lines.slice(0, 6).join("\n")}\n\nOpen the project to retry the build.`,
          actions: [
            { kind: "navigate", label: "Open projects", href: "/projects" },
            { kind: "navigate", label: "Open websites", href: "/websites" },
          ],
        };
      },
    },
    {
      id: "industry_conversion",
      patterns: [/industr(y|ies).{0,30}(conversion|convert|best|perform)/i, /best.{0,20}industr/i],
      examples: ["which industries have the highest conversion"],
      handler: async (_q, orgId) => {
        const { computeAnalytics } = await import("./metrics");
        const analytics = await computeAnalytics(orgId);
        if (analytics.industries.length === 0) {
          return {
            reply: "There isn't enough data yet to compare industries. Run discovery and let the pipeline produce leads first.",
            actions: [{ kind: "navigate", label: "Open analytics", href: "/analytics" }],
          };
        }
        const rows = analytics.industries
          .slice()
          .sort((a, b) => b.won - a.won || b.leads - a.leads)
          .slice(0, 6)
          .map(
            (i) =>
              `• ${i.industry}: ${i.leads} leads, ${i.won} won${i.avgScore !== null ? `, avg score ${i.avgScore}` : ""}`,
          );
        return {
          reply: `Industry performance:\n\n${rows.join("\n")}`,
          actions: [{ kind: "navigate", label: "Open analytics", href: "/analytics" }],
        };
      },
    },
    {
      id: "pause_outreach",
      patterns: [/pause (all )?outreach/i, /stop (sending )?outreach/i],
      examples: ["pause outreach"],
      handler: async (_q, orgId) => ({
        reply:
          "Pausing outreach stops NEXORA from preparing or sending any new messages. Existing drafts are preserved. Confirm and I'll apply it.",
        actions: [
          {
            kind: "confirm_action",
            label: "Pause outreach",
            payload: { action: "pause_outreach", organizationId: orgId },
          },
          { kind: "navigate", label: "Open automation settings", href: "/settings?section=automation" },
        ],
      }),
    },
    {
      id: "pause_autonomy",
      patterns: [/pause autonomy/i, /kill switch/i, /stop all automation/i, /pause everything/i],
      examples: ["pause autonomy"],
      handler: async (_q, orgId) => ({
        reply:
          "The kill switch stops every new automated external action. Internal work and all data are preserved. Confirm to engage it.",
        actions: [
          {
            kind: "confirm_action",
            label: "Engage PAUSE AUTONOMY",
            payload: { action: "pause_autonomy", organizationId: orgId },
          },
        ],
      }),
    },
    {
      id: "build_demo",
      patterns: [/build (a )?demo/i, /generate (a )?demo/i, /make (a )?(website|site) for/i],
      examples: ["build a demo for this company"],
      handler: async (q, orgId) => {
        const target = await resolveLead(q, orgId);
        if (!target) {
          return {
            reply: "Which business should I build a demo for? Name it, for example “build a demo for UrbanFit Gym”.",
            actions: [{ kind: "navigate", label: "Open leads", href: "/leads" }],
          };
        }
        return {
          reply: `I can build a demo site for ${target.business.name}. This generates real files from the NEXORA component library — it is a GREEN action and needs no approval.`,
          actions: [
            {
              kind: "confirm_action",
              label: `Build demo for ${target.business.name}`,
              payload: { action: "build_demo", organizationId: orgId, leadId: target.lead.id },
            },
            { kind: "navigate", label: `Open ${target.business.name}`, href: `/leads/${target.lead.id}` },
          ],
        };
      },
    },
    {
      id: "draft_proposal",
      patterns: [/draft (a )?proposal/i, /create (a )?proposal/i, /proposal for/i],
      examples: ["draft proposal for this client"],
      handler: async (q, orgId) => {
        const target = await resolveLead(q, orgId);
        if (!target) {
          return {
            reply: "Which client or lead should the proposal be for? Name it and I'll draft it from the configured pricing rules.",
            actions: [{ kind: "navigate", label: "Open proposals", href: "/proposals" }],
          };
        }
        return {
          reply: `I'll draft a proposal for ${target.business.name} using your configured services and pricing rules — the numbers come from your settings, never invented.`,
          actions: [
            {
              kind: "confirm_action",
              label: `Draft proposal for ${target.business.name}`,
              payload: { action: "draft_proposal", organizationId: orgId, leadId: target.lead.id },
            },
            { kind: "navigate", label: "Open proposals", href: "/proposals" },
          ],
        };
      },
    },
    {
      id: "client_count",
      patterns: [/how many clients/i, /client count/i, /active clients/i, /revenue/i, /mrr/i],
      examples: ["how many clients do we have"],
      handler: async (_q, orgId) => {
        const { computeDashboard } = await import("./metrics");
        const m = await computeDashboard(orgId);
        return {
          reply: [
            `• Clients: ${m.clients.total} (${m.clients.active} active, ${m.clients.onboarding} onboarding)`,
            `• Revenue collected: ₹${m.revenue.total.toLocaleString("en-IN")}`,
            `• This month: ₹${m.revenue.thisMonth.toLocaleString("en-IN")}`,
            `• Monthly recurring: ₹${m.revenue.mrr.toLocaleString("en-IN")}`,
            `• Pipeline value: ₹${m.pipelineValue.toLocaleString("en-IN")}`,
          ].join("\n"),
          actions: [
            { kind: "navigate", label: "Open dashboard", href: "/dashboard" },
            { kind: "navigate", label: "Open analytics", href: "/analytics" },
          ],
        };
      },
    },
    {
      id: "run_research",
      patterns: [/run research/i, /research (this|the) (lead|business)/i, /analyse|analyze/i],
      examples: ["run research on this lead"],
      handler: async (q, orgId) => {
        const target = await resolveLead(q, orgId);
        if (!target) {
          return {
            reply: "Which lead should I research? Name the business and I'll run the Research agent.",
            actions: [{ kind: "navigate", label: "Open leads", href: "/leads" }],
          };
        }
        return {
          reply: `I'll run the Research agent on ${target.business.name}. This is a GREEN action — it reads public signals only.`,
          actions: [
            {
              kind: "confirm_action",
              label: `Run research on ${target.business.name}`,
              payload: { action: "run_research", organizationId: orgId, leadId: target.lead.id },
            },
          ],
        };
      },
    },
  ];
}

function extractCategory(q: string): string | null {
  const categories = [
    "restaurant",
    "cafe",
    "gym",
    "clinic",
    "dental",
    "salon",
    "spa",
    "retail",
    "store",
    "shop",
    "coaching",
    "school",
    "institute",
    "interior",
    "travel",
    "hotel",
    "boutique",
    "bakery",
  ];
  const lower = q.toLowerCase();
  return categories.find((c) => lower.includes(c)) ?? null;
}

async function resolveLead(query: string, organizationId: string) {
  const leads = await db.find("leads", { organizationId });
  const businesses = await db.find("businesses", { organizationId });
  const bizById = new Map(businesses.map((b) => [b.id, b]));

  // 1. Explicit business name in the query
  const lower = query.toLowerCase();
  for (const lead of leads) {
    const biz = bizById.get(lead.businessId);
    if (!biz) continue;
    const tokens = biz.name.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    if (tokens.some((t) => lower.includes(t))) return { lead, business: biz };
  }

  // 2. "this" — the most recently updated lead
  if (/\bthis\b/i.test(query)) {
    const sorted = leads.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const lead = sorted[0];
    if (lead) {
      const biz = bizById.get(lead.businessId);
      if (biz) return { lead, business: biz };
    }
  }

  // 3. Fuzzy search
  const results = await globalSearch(organizationId, query, 5);
  const leadResult = results.find((r) => r.kind === "lead");
  if (leadResult) {
    const lead = leads.find((l) => l.id === leadResult.id);
    const biz = lead ? bizById.get(lead.businessId) : null;
    if (lead && biz) return { lead, business: biz };
  }
  return null;
}

async function fallback(query: string, organizationId: string): Promise<CopilotResponse> {
  const results = await globalSearch(organizationId, query, 6);
  if (results.length === 0) {
    return {
      reply: `I couldn't find anything matching “${query}” in this workspace. I can search leads, clients, projects, proposals, messages, deployments, tasks and agents.`,
      actions: [{ kind: "navigate", label: "Open dashboard", href: "/dashboard" }],
    };
  }
  return {
    reply: `Here's what I found for “${query}”:\n\n${results
      .map((r) => `• [${r.kind}] ${r.title} — ${r.subtitle}`)
      .join("\n")}`,
    actions: results.slice(0, 3).map((r) => ({
      kind: "navigate" as const,
      label: `Open ${r.title}`,
      href: r.href,
    })),
    data: { results: results.length },
  };
}
