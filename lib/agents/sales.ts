import { tenantById } from "../db/tenant";
import { join } from "node:path";
import { db, newId, slugify } from "../db";
import {
  nowIso,
  type MessageIntent,
  type OutreachMessage,
  type Proposal,
  type ProposalItem,
  type Settings,
} from "../db/schema";
import { bus, logActivity, notify } from "../events/bus";
import { runTask, markAgentWorking, markAgentIdle } from "../tasks/engine";
import { isAgentAvailable } from "./registry";
import { getEmailProvider, getWhatsAppProvider } from "../providers/messaging";
import { computePrice, DEFAULT_PRICING_RULES, DEFAULT_SERVICES } from "../pricing/engine";
import { composeSiteContent, defaultPagePlan, THEMES } from "../sites";
import { writeSite } from "../sites/generator";
import { evaluateAction, type PermissionSettings } from "../permissions";
import { ONBOARDING_FIELDS } from "../onboarding-fields";

/* ==========================================================================
   NEXORA — Outreach / Sales / Proposal / Onboarding / Production / Support
   ========================================================================== */

/* -------------------------------------------------------------- outreach -- */

export interface OutreachDraftInput {
  leadId: string;
  channel?: "EMAIL" | "WHATSAPP";
  tone?: "warm" | "direct" | "consultative";
}

export async function outreachDraft(
  organizationId: string,
  input: OutreachDraftInput,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "outreach"))) {
    return { ok: false as const, error: "Outreach agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "outreach", trigger },
    "outreach.draft",
    async (task) => {
      const lead = await tenantById(organizationId, "leads", input.leadId);
      if (!lead) throw new Error(`Lead ${input.leadId} not found`);
      if (lead.optOut || lead.suppressed) throw new Error("This lead is on the suppression list — outreach is blocked.");

      const business = await tenantById(organizationId, "businesses", lead.businessId);
      if (!business) throw new Error(`Business for lead ${input.leadId} not found`);
      const audit = (await db.find("website_audits", { leadId: lead.id })).at(-1) ?? null;
      const report = (await db.find("research_reports", { leadId: lead.id })).at(-1) ?? null;
      const score = (await db.find("lead_scores", { leadId: lead.id })).at(-1) ?? null;
      const demo = (await db.find("demo_sites", { leadId: lead.id })).at(-1) ?? null;

      await markAgentWorking(organizationId, "outreach", task.id, `Drafting message for ${business.name}`);

      // Duplicate prevention: do not draft twice for the same lead+channel in flight.
      const prior = await db.find("outreach_messages", { leadId: lead.id });
      const inFlight = prior.find(
        (m) => m.channel === (input.channel ?? "EMAIL") && ["DRAFT", "WAITING_APPROVAL", "QUEUED"].includes(m.status),
      );
      if (inFlight) {
        await markAgentIdle(organizationId, "outreach");
        return {
          messageId: inFlight.id,
          status: inFlight.status,
          duplicate: true,
          subject: inFlight.subject,
          body: inFlight.body,
        };
      }

      const { subject, body, personalization } = composeOutreach({
        businessName: business.name,
        category: business.category,
        city: business.city,
        contactName: business.raw?.contactName as string | undefined,
        audit,
        report,
        score,
        demoUrl: demo ? `/generated/${demo.slug}/index.html` : null,
        channel: input.channel ?? "EMAIL",
        tone: input.tone ?? "warm",
      });

      const settings = await getSettings(organizationId);
      const message: OutreachMessage = {
        id: newId("out"),
        organizationId,
        leadId: lead.id,
        campaignId: null,
        channel: input.channel ?? "EMAIL",
        status: settings.outreach.requireApproval ? "WAITING_APPROVAL" : "APPROVED",
        subject,
        body,
        personalization,
        toAddress:
          input.channel === "WHATSAPP" ? (business.phone ?? "") : (business.email ?? ""),
        providerMessageId: null,
        threadId: null,
        riskLevel: "HIGH",
        approvalRequired: settings.outreach.requireApproval,
        approvedBy: null,
        sentAt: null,
        openedAt: null,
        repliedAt: null,
        error: null,
        createdBy: "outreach",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await db.insert("outreach_messages", message);

      await db.update("leads", lead.id, { status: "OUTREACH", pipelineStage: "Outreach", updatedAt: nowIso() });

      if (message.status === "WAITING_APPROVAL") {
        const { createApproval } = await import("../approvals");
        await createApproval({
          organizationId,
          action: "outreach_sending",
          title: `Send outreach to ${business.name}`,
          reason: "Outreach is a YELLOW action — it runs automatically only when the owner enables automatic sending.",
          requestingAgent: "outreach",
          entityType: "outreach_message",
          entityId: message.id,
          payload: { channel: message.channel, subject, to: message.toAddress },
        });
      }

      await logActivity({
        organizationId,
        agentKey: "outreach",
        actionType: "outreach.prepared",
        title: `Outreach draft created for ${business.name}`,
        detail: `Personalised with: ${personalization.slice(0, 3).join(", ")}`,
        entityType: "lead",
        entityId: lead.id,
        leadId: lead.id,
        status: "PENDING",
        riskLevel: "MEDIUM",
      });
      await bus.emit("outreach.prepared", { organizationId, leadId: lead.id, messageId: message.id });
      await markAgentIdle(organizationId, "outreach");

      return { messageId: message.id, status: message.status, subject, body, personalization };
    },
    { entityType: "lead", entityId: input.leadId, input: { leadId: input.leadId }, riskLevel: "HIGH" },
  );
}

function composeOutreach(args: {
  businessName: string;
  category: string;
  city: string;
  contactName?: string;
  audit: { reachable: boolean; hasWebsite: boolean; findings: Array<{ label: string; detail: string; severity: string }>; overallGrade: string; conversionOpportunities: string[] } | null;
  report: { services: string[]; digitalOpportunities: string[] } | null;
  score: { total: number; priority: string } | null;
  demoUrl: string | null;
  channel: "EMAIL" | "WHATSAPP";
  tone: "warm" | "direct" | "consultative";
}) {
  const greeting = args.contactName ? `Hi ${args.contactName}` : "Hi there";
  const specifics: string[] = [];

  if (args.audit && !args.audit.hasWebsite) {
    specifics.push("I couldn't find a website on your Google listing");
  } else if (args.audit && !args.audit.reachable) {
    specifics.push("your website wasn't loading when I checked");
  } else if (args.audit) {
    const top = args.audit.findings.find(
      (f) => (f.severity === "CRITICAL" || f.severity === "HIGH") && f.detail,
    );
    if (top) specifics.push(top.label.toLowerCase());
  }
  if (args.report?.services.length) specifics.push(`your ${args.report.services.slice(0, 2).join(" and ")} services`);
  if (args.city) specifics.push(`customers searching in ${args.city}`);

  const personalization = specifics.filter(Boolean);
  const problemLine =
    personalization.length > 0
      ? `I noticed ${personalization.slice(0, 2).join(", and ")}.`
      : `I came across ${args.businessName} while researching ${args.category.toLowerCase()} businesses in ${args.city || "the area"}.`;

  const demoLine = args.demoUrl
    ? `I put together a quick concept so you can see what I mean rather than imagine it: ${args.demoUrl}`
    : `I'd be glad to sketch a quick concept for you.`;

  const whatsappBody = [
    `${greeting} — this is ${"Sajid"} from NEXORA.`,
    ``,
    problemLine,
    ``,
    demoLine,
    ``,
    `No obligation at all — if it's useful, I'll walk you through it. If not, no problem.`,
    ``,
    `Thanks,`,
    `Sajid`,
  ].join("\n");

  const emailBody = [
    `${greeting},`,
    ``,
    problemLine,
    ``,
    args.audit?.conversionOpportunities.length
      ? `Two things stood out: ${args.audit.conversionOpportunities.slice(0, 2).join(" and ").toLowerCase()}. For a ${args.category.toLowerCase()} business those are usually the difference between a visitor and a customer.`
      : `For a ${args.category.toLowerCase()} business in ${args.city || "the area"}, the website is usually where most enquiries are won or lost.`,
    ``,
    demoLine,
    ``,
    `It's a concept, not a pitch — I built it so you can judge the idea in about a minute.`,
    ``,
    `Would a short call this week be useful?`,
    ``,
    `Best,`,
    `Sajid Raza`,
    `NEXORA — Find. Build. Sell. Deliver.`,
  ].join("\n");

  const subject = args.audit && !args.audit.hasWebsite
    ? `A website concept for ${args.businessName}`
    : `${args.businessName} — two things I noticed on your site`;

  return {
    subject: args.channel === "WHATSAPP" ? "" : subject,
    body: args.channel === "WHATSAPP" ? whatsappBody : emailBody,
    personalization,
  };
}

/** Send an approved outreach message. Honours rate limits and suppression. */
export async function outreachSend(
  organizationId: string,
  messageId: string,
  opts: { approved?: boolean } = {},
) {
  const message = await tenantById(organizationId, "outreach_messages", messageId);
  if (!message) throw new Error(`Outreach message ${messageId} not found`);
  const lead = await tenantById(organizationId, "leads", message.leadId);
  if (!lead) throw new Error("Lead not found");
  if (lead.optOut || lead.suppressed) throw new Error("Lead is suppressed — send blocked.");

  const settings = await getSettings(organizationId);
  if (settings.autonomy.paused) throw new Error("Autonomy is paused — resume before sending.");

  const today = new Date().toISOString().slice(0, 10);
  const sentToday = (await db.find("outreach_messages", { organizationId })).filter(
    (m) => m.sentAt?.startsWith(today) && m.status !== "CANCELLED",
  ).length;
  if (sentToday >= settings.outreach.dailyLimit) {
    throw new Error(
      `Daily outreach limit reached (${settings.outreach.dailyLimit}). Raise the limit in Settings → Outreach.`,
    );
  }

  const decision = evaluateAction("outreach_sending", settings.permissions, {
    autonomyPaused: settings.autonomy.paused,
  });
  if (decision.requiresApproval && !opts.approved) {
    // Either this exact message carries an approval, or the owner signed off on
    // the linked approval request. Anything else stays queued.
    const linked = (await db.find("approval_requests", { organizationId })).find(
      (a) =>
        a.action === "outreach_sending" &&
        a.entityType === "outreach_message" &&
        a.entityId === messageId,
    );
    const signedOff =
      message.status === "APPROVED" ||
      message.approvedBy !== null ||
      (linked !== undefined && (linked.status === "APPROVED" || linked.status === "MODIFIED"));
    if (!signedOff) {
      throw new Error("Outreach requires owner approval before sending.");
    }
  }

  let result;
  if (message.channel === "WHATSAPP") {
    const provider = getWhatsAppProvider();
    result = await provider.send({ to: message.toAddress, body: message.body });
  } else {
    const provider = getEmailProvider();
    result = await provider.send({
      to: message.toAddress,
      subject: message.subject,
      text: message.body,
      html: `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(message.body)}</div>`,
    });
  }

  if (!result.ok) {
    await db.update("outreach_messages", messageId, { status: "FAILED", error: result.error ?? "send failed", updatedAt: nowIso() });
    await logActivity({
      organizationId,
      agentKey: "outreach",
      actionType: "outreach.failed",
      title: `Outreach to ${lead.businessId} failed to send`,
      detail: result.error ?? "",
      entityType: "lead",
      entityId: lead.id,
      leadId: lead.id,
      status: "ERROR",
      riskLevel: "MEDIUM",
    });
    return { ok: false as const, error: result.error };
  }

  await db.update("outreach_messages", messageId, {
    status: "SENT",
    sentAt: nowIso(),
    providerMessageId: result.providerMessageId ?? null,
    error: null,
    updatedAt: nowIso(),
  });
  await db.update("leads", lead.id, { status: "CONTACTED", pipelineStage: "Outreach", lastContactedAt: nowIso(), updatedAt: nowIso() });

  await logActivity({
    organizationId,
    agentKey: "outreach",
    actionType: "outreach.sent",
    title: result.simulated ? "Outreach recorded (simulated — no provider connected)" : "Outreach sent to lead",
    detail: `${message.channel} → ${message.toAddress || "no address on file"}`,
    entityType: "lead",
    entityId: lead.id,
    leadId: lead.id,
    status: "OK",
    riskLevel: "HIGH",
  });
  await bus.emit("outreach.sent", { organizationId, leadId: lead.id, messageId });
  return {
    ok: true as const,
    providerMessageId: result.providerMessageId,
    provider: result.provider,
    simulated: result.simulated === true,
  };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ----------------------------------------------------------------- sales -- */

export function classifyMessage(body: string): { intent: MessageIntent; confidence: number } {
  const t = body.toLowerCase();
  const rules: Array<[MessageIntent, RegExp, number]> = [
    ["NOT_INTERESTED", /\b(not interested|no thanks|no thank you|don'?t contact|remove me|unsubscribe|stop)\b/, 0.9],
    ["PRICE_QUERY", /\b(price|pricing|cost|how much|quote|budget|charges|fees|kitna)\b/, 0.85],
    ["INTERESTED", /\b(interested|yes|sounds good|let'?s do it|i want|we need|send (me )?(the )?(details|proposal)|looking for)\b/, 0.85],
    ["FOLLOW_UP", /\b(follow(ing)? up|checking in|any update|circling back|later|next month|call me)\b/, 0.7],
    ["QUESTION", /\?\s*$|\b(how|what|when|where|why|can you|do you|is it)\b/, 0.6],
    ["NEEDS_HUMAN", /\b(speak to (a )?(human|person|manager)|call me now|urgent|asap|complaint|angry)\b/, 0.75],
    ["SPAM", /\b(viagra|casino|crypto|lottery|seo services|backlinks|click here|free money)\b/, 0.8],
  ];
  for (const [intent, re, confidence] of rules) if (re.test(t)) return { intent, confidence };
  return { intent: "UNKNOWN", confidence: 0.3 };
}

export async function salesHandleInbound(
  organizationId: string,
  conversationId: string,
  messageId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "sales"))) {
    return { ok: false as const, error: "Sales agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "sales", trigger },
    "sales.classify",
    async (task) => {
      const message = await tenantById(organizationId, "messages", messageId);
      if (!message) throw new Error(`Message ${messageId} not found`);
      const conversation = await tenantById(organizationId, "conversations", conversationId);
      if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

      await markAgentWorking(organizationId, "sales", task.id, "Classifying inbound message");
      const { intent, confidence } = classifyMessage(message.body);

      const updated = await db.update("messages", messageId, {
        intent,
        intentConfidence: confidence,
        suggestedReply: draftReply(message.body, intent),
      });
      await db.update("conversations", conversationId, {
        lastIntent: intent,
        state:
          intent === "NOT_INTERESTED"
            ? "CLOSED"
            : intent === "NEEDS_HUMAN"
              ? "WAITING_ON_OWNER"
              : intent === "INTERESTED"
                ? "OPEN"
                : "WAITING_ON_PROSPECT",
        updatedAt: nowIso(),
      });

      const lead = conversation.leadId ? await tenantById(organizationId, "leads", conversation.leadId) : null;
      if (lead) {
        const statusByIntent: Record<string, "REPLIED" | "INTERESTED" | "LOST"> = {
          INTERESTED: "INTERESTED",
          NOT_INTERESTED: "LOST",
          PRICE_QUERY: "REPLIED",
          QUESTION: "REPLIED",
          FOLLOW_UP: "REPLIED",
        };
        const next = statusByIntent[intent];
        if (next) {
          await db.update("leads", lead.id, {
            status: next,
            pipelineStage: intent === "INTERESTED" ? "Interested" : intent === "NOT_INTERESTED" ? "Lost" : "Replied",
            lostReason: intent === "NOT_INTERESTED" ? "Prospect declined" : lead.lostReason,
            updatedAt: nowIso(),
          });
        }
      }

      await logActivity({
        organizationId,
        agentKey: "sales",
        actionType: intent === "INTERESTED" ? "lead.interested" : "message.received",
        title: `Sales classified an inbound message as ${intent}`,
        detail: `Confidence ${(confidence * 100).toFixed(0)}%`,
        entityType: "conversation",
        entityId: conversationId,
        leadId: lead?.id ?? null,
        status: intent === "NEEDS_HUMAN" ? "WARN" : "OK",
        riskLevel: intent === "NEEDS_HUMAN" ? "MEDIUM" : "LOW",
      });

      if (intent === "INTERESTED") {
        await notify({
          organizationId,
          type: "prospect_reply",
          title: "A prospect replied and is interested",
          body: updated.body.slice(0, 160),
          entityType: "conversation",
          entityId: conversationId,
          href: `/conversations?id=${conversationId}`,
          severity: "SUCCESS",
        });
      }

      // Only a genuinely interested reply escalates. Re-emitting
      // `message.received` for every other intent would loop the Supervisor
      // straight back into this handler.
      if (intent === "INTERESTED") {
        await bus.emit("lead.interested", { organizationId, conversationId, messageId, intent });
      }
      await markAgentIdle(organizationId, "sales");

      return { intent, confidence, suggestedReply: updated.suggestedReply };
    },
    { entityType: "conversation", entityId: conversationId, input: { conversationId, messageId } },
  );
}

function draftReply(body: string, intent: MessageIntent): string {
  const t = body.toLowerCase();
  switch (intent) {
    case "PRICE_QUERY":
      return "Happy to share numbers. Projects usually start at a base price that depends on the number of pages and any extra functionality like booking, ecommerce or a CMS. Tell me roughly what you have in mind and I'll send a proper written proposal with a fixed price and timeline — no obligation.";
    case "INTERESTED":
      return "Great — I'll put together a short proposal covering scope, timeline and price so you have everything in one place. Would it help if I also walked you through the concept on a quick call?";
    case "QUESTION":
      return "Good question. Short answer: yes. If you tell me a little more about what you're trying to achieve, I'll give you a specific answer rather than a general one.";
    case "FOLLOW_UP":
      return "Thanks for checking in. Nothing has changed on my side — the concept is still ready whenever you'd like to look at it. Happy to answer anything specific before you decide.";
    case "NOT_INTERESTED":
      return "Understood, thanks for letting me know. I'll close this off on my side and won't follow up again. If you ever want a second opinion on your website, the offer stands.";
    case "NEEDS_HUMAN":
      return "Absolutely — let me get the right person involved. I'll have Sajid contact you directly, and I've flagged this as needing a human response so nothing gets lost.";
    case "SPAM":
      return "";
    default:
      return "Thanks for your message. Could you tell me a little more about what you're looking for? That way I can give you something useful rather than generic.";
  }
}

/* -------------------------------------------------------------- proposal -- */

export async function proposalGenerate(
  organizationId: string,
  leadId: string,
  opts: { discountPercent?: number; rush?: boolean; maintenanceMonths?: number } = {},
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "proposal"))) {
    return { ok: false as const, error: "Proposal agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "proposal", trigger },
    "proposal.generate",
    async (task) => {
      const lead = await tenantById(organizationId, "leads", leadId);
      if (!lead) throw new Error(`Lead ${leadId} not found`);
      const business = await tenantById(organizationId, "businesses", lead.businessId);
      if (!business) throw new Error(`Business for lead ${leadId} not found`);
      const strategy = (await db.find("strategies", { leadId })).at(-1) ?? null;
      const audit = (await db.find("website_audits", { leadId })).at(-1) ?? null;
      const report = (await db.find("research_reports", { leadId })).at(-1) ?? null;

      await markAgentWorking(organizationId, "proposal", task.id, `Generating proposal for ${business.name}`);

      let services = await db.find("services", { organizationId });
      if (services.length === 0) services = DEFAULT_SERVICES.map((s) => ({ ...s, id: newId("svc"), organizationId, createdAt: nowIso(), updatedAt: nowIso() }));
      let rules = await db.find("pricing_rules", { organizationId });
      if (rules.length === 0) rules = DEFAULT_PRICING_RULES.map((r) => ({ ...r, id: newId("prc"), organizationId }));

      const serviceKey = strategy?.serviceKey ?? "business-website";
      const pages = strategy?.pages.length ?? 4;
      const quote = computePrice(
        {
          serviceKey,
          pages,
          ecommerce: serviceKey === "ecommerce",
          cms: strategy?.mustHaveFeatures.some((f) => /cms|editable/i.test(f)),
          booking: strategy?.mustHaveFeatures.some((f) => /book|appointment|reservation/i.test(f)),
          advancedAnimation: strategy?.mustHaveFeatures.some((f) => /animation/i.test(f)),
          rush: opts.rush,
          maintenanceMonths: opts.maintenanceMonths ?? 3,
          discountPercent: opts.discountPercent,
        },
        services,
        rules,
      );

      const count = await db.count("proposals", { organizationId });
      const proposal: Proposal = {
        id: newId("prp"),
        organizationId,
        leadId,
        clientId: null,
        number: `NX-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        status: quote.discountApprovalRequired ? "WAITING_APPROVAL" : "DRAFT",
        title: `${business.name} — ${services.find((s) => s.key === serviceKey)?.name ?? "Website"} project`,
        projectSummary: strategy?.rationale ?? `A new website for ${business.name}.`,
        problem: audit?.findings.length
          ? `The audit found ${audit.findings.length} issue(s), including ${audit.findings
              .slice(0, 3)
              .map((f) => f.label.toLowerCase())
              .join(", ")}.`
          : `${business.name} currently has no website that converts visitors into enquiries.`,
        proposedSolution: strategy
          ? `A ${strategy.templateFamily} website with ${strategy.pages.join(", ")} pages, built on the NEXORA component system. ${strategy.copyDirection}`
          : "A focused, conversion-led website.",
        pages: strategy?.pages ?? ["Home", "Services", "About", "Contact"],
        functionality: strategy?.mustHaveFeatures ?? [],
        deliverables: buildDeliverables(strategy?.mustHaveFeatures ?? []),
        milestones: buildMilestones(quote.estimatedDeliveryDays, quote.total),
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        currency: quote.currency,
        validUntil: new Date(Date.now() + 21 * 864e5).toISOString(),
        revisionPolicy: "Two rounds of revisions are included per page. Further rounds are quoted separately.",
        maintenanceTerms: `${opts.maintenanceMonths ?? 3} months of maintenance is included, covering content changes, backups, uptime monitoring and security updates.`,
        hostingTerms: "Hosting is arranged and billed separately at cost. Domain registration remains in the client's name.",
        termsPlaceholder:
          "Payment terms: 50% on signature, 50% on delivery. Full terms and conditions to be attached before signature. [LEGAL REVIEW REQUIRED]",
        upgradeOptions: services.find((s) => s.key === serviceKey)?.upgrades ?? [],
        createdBy: "proposal",
        sentAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await db.insert("proposals", proposal);

      const items: ProposalItem[] = quote.lines.map((l) => ({
        id: newId("pit"),
        proposalId: proposal.id,
        label: l.label,
        description: l.description,
        quantity: 1,
        unitPrice: l.amount,
        amount: l.amount,
        kind: l.kind,
      }));
      await db.insertMany("proposal_items", items);

      if (quote.discountApprovalRequired) {
        const { createApproval } = await import("../approvals");
        await createApproval({
          organizationId,
          action: "discount_beyond_limit",
          title: `Discount of ${opts.discountPercent}% exceeds the ${quote.maxDiscountPercent}% limit`,
          reason: `The requested discount is beyond the configured ceiling for ${business.name}.`,
          requestingAgent: "proposal",
          entityType: "proposal",
          entityId: proposal.id,
          payload: { requested: opts.discountPercent, limit: quote.maxDiscountPercent, total: quote.total },
        });
      }

      await db.update("leads", leadId, { status: "PROPOSAL", pipelineStage: "Proposal", updatedAt: nowIso() });

      await logActivity({
        organizationId,
        agentKey: "proposal",
        actionType: "proposal.generated",
        title: `Proposal ${proposal.number} generated for ${business.name}`,
        detail: `${quote.lines.length} line items, total ${quote.total} ${quote.currency}`,
        entityType: "proposal",
        entityId: proposal.id,
        leadId,
        status: quote.discountApprovalRequired ? "PENDING" : "OK",
        riskLevel: quote.discountApprovalRequired ? "HIGH" : "MEDIUM",
      });
      await bus.emit("proposal.generated", { organizationId, leadId, proposalId: proposal.id });
      await markAgentIdle(organizationId, "proposal");

      return {
        proposalId: proposal.id,
        number: proposal.number,
        total: quote.total,
        currency: quote.currency,
        discountApprovalRequired: quote.discountApprovalRequired,
      };
    },
    { entityType: "lead", entityId: leadId, input: { leadId, ...opts }, riskLevel: "HIGH" },
  );
}

function buildDeliverables(features: string[]) {
  const base = [
    "Responsive website design",
    "Mobile-first implementation",
    "Contact form with email delivery",
    "WhatsApp click-to-chat",
    "On-page SEO setup",
    "Google Search Console + Analytics setup",
    "Deployment to production hosting",
    "Handover documentation",
  ];
  return Array.from(new Set([...base, ...features.map((f) => `${f} implementation`)])).slice(0, 12);
}

function buildMilestones(days: number, total: number) {
  const stages: Array<[string, string, number]> = [
    ["Kick-off & content collection", "Requirements confirmed and assets received.", 0.1],
    ["Design", "Homepage and inner page design for approval.", 0.3],
    ["Build", "Full implementation across all pages.", 0.65],
    ["QA", "Cross-device testing, links, forms, performance and metadata.", 0.85],
    ["Launch", "Production deployment and handover.", 1],
  ];
  return stages.map(([name, description, at], i) => ({
    id: newId("mil"),
    name,
    description,
    days: Math.max(1, Math.round(days * at)),
    amount: Math.round((total * (i === stages.length - 1 ? 0.5 : 0.125)) / 100) * 100,
    status: "PENDING" as const,
  }));
}

/* ------------------------------------------------------------ onboarding -- */



export function onboardingCompletion(data: Record<string, unknown>): { completion: number; missing: string[] } {
  let completion = 0;
  const missing: string[] = [];
  for (const field of ONBOARDING_FIELDS) {
    const value = data[field.key];
    const filled =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0)
        ? false
        : true;
    if (filled) completion += field.weight;
    else missing.push(field.label);
  }
  return { completion: Math.min(100, completion), missing };
}

export { ONBOARDING_FIELDS, ONBOARDING_FIELD_LIST } from "../onboarding-fields";

/* --------------------------------------------------- production builder -- */

export async function productionBuild(
  organizationId: string,
  projectId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "production_builder"))) {
    return { ok: false as const, error: "Production Builder agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "production_builder", trigger },
    "production.build",
    async (task) => {
      const project = await tenantById(organizationId, "projects", projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);
      const client = await tenantById(organizationId, "clients", project.clientId);
      if (!client) throw new Error(`Client for project ${projectId} not found`);
      const business = client.businessId ? await tenantById(organizationId, "businesses", client.businessId) : null;
      const strategy = project.strategyId ? await tenantById(organizationId, "strategies", project.strategyId) : null;
      const onboarding = (await db.find("onboarding_submissions", { clientId: client.id })).at(-1) ?? null;

      await markAgentWorking(organizationId, "production_builder", task.id, `Building ${project.name}`);

      const themeKey = strategy?.theme.palette ?? "indigo";
      const theme = THEMES[themeKey] ?? THEMES.indigo!;
      const plan = defaultPagePlan(business?.category ?? project.serviceKey);
      const content = composeSiteContent({
        name: onboarding?.data.companyName || client.name,
        category: business?.category ?? project.serviceKey,
        subcategory: business?.subcategory ?? "",
        city: business?.city ?? "",
        address: onboarding?.data.address || business?.address || "",
        phone: onboarding?.data.phone || business?.phone || client.primaryPhone,
        email: onboarding?.data.email || business?.email || client.primaryEmail,
        website: business?.website ?? null,
        rating: business?.rating ?? null,
        reviewCount: business?.reviewCount ?? 0,
        socialLinks: { ...(business?.socialLinks ?? {}), ...(onboarding?.data.socialUrls ?? {}) },
        mapsUrl: business?.mapsUrl ?? null,
        services: onboarding?.data.services?.length ? onboarding.data.services : strategy?.sections.map((s) => s.heading) ?? [],
      });

      const slug = `${organizationId}-${projectId}-${newId("artifact")}`;
      const result = writeSite({
        slug,
        business: content,
        theme,
        pagePlan: plan,
        demo: false,
        outputRoot: process.env.NEXORA_SITE_ROOT ?? join(process.cwd(), "public", "generated"),
      });

      const version = (await db.count("website_builds", { projectId })) + 1;
      const build = {
        id: newId("bld"),
        organizationId,
        projectId,
        strategyId: strategy?.id ?? null,
        version,
        status: "BUILT" as const,
        outputDir: result.outputDir,
        pages: result.pages,
        componentsUsed: result.componentsUsed,
        fileCount: result.files.length,
        totalBytes: result.totalBytes,
        builtBy: "production_builder",
        error: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await db.insert("website_builds", build);
      await db.update("projects", projectId, {
        stage: "QA",
        progress: 60,
        previewUrl: `/generated/${slug}/index.html`,
        updatedAt: nowIso(),
      });

      await logActivity({
        organizationId,
        agentKey: "production_builder",
        actionType: "project.started",
        title: `Production Builder generated ${project.name} v${version}`,
        detail: `${result.files.length} files, ${result.pages.length} pages, ${result.componentsUsed.length} components`,
        entityType: "project",
        entityId: projectId,
        projectId,
        status: "OK",
      });
      await bus.emit("project.started", { organizationId, projectId, buildId: build.id });
      await markAgentIdle(organizationId, "production_builder");

      return { buildId: build.id, version, pages: result.pages, files: result.files.length };
    },
    { entityType: "project", entityId: projectId, input: { projectId }, priority: "HIGH" },
  );
}

/* --------------------------------------------------------------- support -- */

const TICKET_PATTERNS: Array<[RegExp, "bug" | "image change" | "broken link" | "content change" | "design request" | "new feature" | "billing question" | "domain issue" | "hosting issue" | "unknown"]> = [
  [/broken|404|not working|error|down/i, "bug"],
  [/image|photo|picture|logo/i, "image change"],
  [/link|url|redirect/i, "broken link"],
  [/text|content|wording|copy|change the/i, "content change"],
  [/design|colour|color|layout|font|spacing/i, "design request"],
  [/new feature|add a|can you also|build/i, "new feature"],
  [/invoice|billing|payment|charge|refund/i, "billing question"],
  [/domain|dns|nameserver|ssl/i, "domain issue"],
  [/hosting|server|slow|uptime|down/i, "hosting issue"],
];

export function categorizeTicket(text: string) {
  for (const [re, category] of TICKET_PATTERNS) if (re.test(text)) return category;
  return "unknown" as const;
}

export type TicketCategoryResult = ReturnType<typeof categorizeTicket>;

export async function supportTriage(
  organizationId: string,
  ticketId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "support"))) {
    return { ok: false as const, error: "Support agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "support", trigger },
    "support.triage",
    async (task) => {
      const ticket = await tenantById(organizationId, "support_tickets", ticketId);
      if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
      await markAgentWorking(organizationId, "support", task.id, `Triaging: ${ticket.subject}`);

      const category = categorizeTicket(`${ticket.subject} ${ticket.description}`);
      const isFeature = category === "new feature";
      const updated = await db.update("support_tickets", ticketId, {
        category,
        status: "TRIAGED",
        isUpsell: isFeature,
        updatedAt: nowIso(),
      });

      if (isFeature) {
        const upsell = {
          id: newId("ups"),
          organizationId,
          clientId: ticket.clientId ?? "",
          ticketId,
          title: `Feature request from ${ticket.subject}`,
          rationale: `${category} requests are billable scope — NEXORA routes them to the upsell pipeline rather than absorbing them.`,
          serviceKey: "automation-setup",
          estimatedValue: 25000,
          status: "NEW" as const,
          createdAt: nowIso(),
        };
        if (upsell.clientId) {
          await db.insert("upsell_opportunities", upsell);
          await db.update("support_tickets", ticketId, { upsellOpportunityId: upsell.id });
        }
        await logActivity({
          organizationId,
          agentKey: "support",
          actionType: "upsell.detected",
          title: `Support routed a feature request into the upsell pipeline`,
          detail: ticket.subject,
          entityType: "ticket",
          entityId: ticketId,
          clientId: ticket.clientId,
          status: "OK",
        });
        await bus.emit("upsell.detected", { organizationId, ticketId });
      }

      await logActivity({
        organizationId,
        agentKey: "support",
        actionType: "support.created",
        title: `Support triaged a ${category} ticket`,
        detail: ticket.subject,
        entityType: "ticket",
        entityId: ticketId,
        clientId: ticket.clientId,
        status: "OK",
      });
      await markAgentIdle(organizationId, "support");
      return { ticketId, category, isUpsell: isFeature, status: updated.status };
    },
    { entityType: "ticket", entityId: ticketId, input: { ticketId } },
  );
}

/* --------------------------------------------------------------- helpers -- */

export async function getSettings(organizationId: string): Promise<Settings> {
  let settings = await db.findOne("settings", { organizationId });
  if (!settings) {
    const { defaultSettings } = await import("../bootstrap");
    settings = await defaultSettings(organizationId);
  }
  return settings;
}

export type { PermissionSettings };
export { slugify };
