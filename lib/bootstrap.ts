import { join } from "node:path";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, newId, slugify } from "./db";
import { nowIso, type Database, type Organization, type Settings, type User, type WebsiteAudit } from "./db/schema";
import { DEFAULT_PRICING_RULES, DEFAULT_SERVICES } from "./pricing/engine";
import { ensureAgentRegistry } from "./agents/registry";
import { DEMO_BUSINESSES, DEMO_ORG, DEMO_USER, type DemoBusiness } from "../data/demo-fixtures";
import { createLeadFromBusiness } from "./agents/discovery";
import { onboardingCompletion } from "./agents/sales";
import { composeSiteContent, defaultPagePlan, pickTheme, THEMES } from "./sites";
import { writeSite } from "./sites/generator";
import { runQa } from "./qa/engine";

/* ==========================================================================
   NEXORA — Bootstrap
   Creates the live organisation, default settings, service catalogue,
   pricing rules, integrations and the agent registry. Also owns the
   demo-mode dataset (kept fully separate and resettable).
   ========================================================================== */

export async function defaultSettings(organizationId: string): Promise<Settings> {
  const settings: Settings = {
    id: newId("set"),
    organizationId,
    automation: {
      leadDiscovery: false,
      automaticResearch: true,
      automaticAudit: true,
      automaticScoring: true,
      automaticDemoCreation: false,
      automaticQa: true,
      automaticPreviewDeployment: true,
      automaticOutreachDraft: true,
      automaticOutreachSending: false,
      automaticFollowUp: false,
      automaticReplySuggestions: true,
      automaticProposalDrafts: true,
      automaticMinorMaintenance: false,
    },
    permissions: {
      allowAutoOutreach: false,
      allowAutoReplies: false,
      allowAutoFollowUps: false,
      allowAutoMinorEdits: false,
      allowAutoPreviewUpdates: true,
    },
    outreach: {
      dailyLimit: 20,
      followUpDelayDays: 3,
      maxFollowUps: 2,
      defaultChannel: "EMAIL",
      requireApproval: true,
      signature: "Sajid Raza\nNEXORA",
    },
    leadSources: {
      googlePlaces: true,
      webSearch: false,
      csvImport: true,
      manual: true,
      defaultCities: ["Lucknow", "Kanpur", "Noida"],
      defaultCategories: ["Restaurant", "Coaching Institute", "Gym", "Dental Clinic", "Interior Designer"],
    },
    ai: {
      provider: "local",
      model: "local-deterministic",
      temperature: 0.4,
      maxTokens: 2048,
      fallbackToLocal: true,
    },
    company: {
      agencyName: "NEXORA",
      ownerName: "Sajid Raza",
      website: "",
      email: "",
      phone: "",
      address: "Lucknow, Uttar Pradesh, India",
      gstin: "",
    },
    autonomy: {
      paused: false,
      pausedAt: null,
      pauseOutreach: false,
      pauseDemos: false,
      pauseDeployments: false,
    },
    notifications: {
      hotLead: true,
      prospectReply: true,
      proposalRequested: true,
      approvalRequired: true,
      paymentEvent: true,
      buildCompleted: true,
      qaFailed: true,
      deploymentFailed: true,
      newClient: true,
      supportIssue: true,
    },
    updatedAt: nowIso(),
  };
  await db.insert("settings", settings);
  return settings;
}

const INTEGRATIONS = [
  {
    key: "supabase",
    name: "Supabase",
    category: "DATABASE" as const,
    detail: "PostgreSQL, Auth, Storage and Row Level Security.",
    docsUrl: "https://supabase.com/docs",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    optionalEnv: [],
    capabilities: ["database", "auth", "storage", "realtime"],
  },
  {
    key: "ai",
    name: "AI Provider",
    category: "AI" as const,
    detail: "OpenAI, Anthropic, Google, OpenRouter or AI Gateway. Falls back to the deterministic engine.",
    docsUrl: "https://sdk.vercel.ai/docs",
    requiredEnv: [],
    optionalEnv: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENROUTER_API_KEY", "AI_GATEWAY_API_KEY"],
    capabilities: ["structured generation", "research", "copy", "classification"],
  },
  {
    key: "google_places",
    name: "Google Places",
    category: "LEADS" as const,
    detail: "Business discovery by category and city.",
    docsUrl: "https://developers.google.com/maps/documentation/places/web-service/overview",
    requiredEnv: ["GOOGLE_PLACES_API_KEY"],
    optionalEnv: [],
    capabilities: ["business search", "place details", "ratings", "addresses"],
  },
  {
    key: "web_search",
    name: "Public Web Search",
    category: "LEADS" as const,
    detail: "Secondary discovery source so NEXORA never depends on one provider.",
    docsUrl: "https://serper.dev",
    requiredEnv: ["LEAD_SEARCH_API_KEY"],
    optionalEnv: [],
    capabilities: ["organic results", "local pack"],
  },
  {
    key: "email",
    name: "Email",
    category: "EMAIL" as const,
    detail: "Resend, Gmail API or SMTP fallback for outreach and reply handling.",
    docsUrl: "https://resend.com/docs",
    requiredEnv: [],
    optionalEnv: ["RESEND_API_KEY", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"],
    capabilities: ["send", "reply", "thread", "draft", "status", "suppression"],
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    category: "WHATSAPP" as const,
    detail: "Official Cloud API only. Until connected you can copy, mark as sent and log replies.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    requiredEnv: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    optionalEnv: [],
    capabilities: ["send", "templates", "status"],
  },
  {
    key: "github",
    name: "GitHub",
    category: "GIT" as const,
    detail: "Repository creation and pushing generated sites.",
    docsUrl: "https://docs.github.com/rest",
    requiredEnv: ["GITHUB_TOKEN"],
    optionalEnv: ["GITHUB_ORG"],
    capabilities: ["create repository", "push generated site", "branches", "commits"],
  },
  {
    key: "vercel",
    name: "Vercel",
    category: "DEPLOY" as const,
    detail: "Preview and production deployments. Local preview server is used when not connected.",
    docsUrl: "https://vercel.com/docs/rest-api",
    requiredEnv: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
    optionalEnv: ["VERCEL_TEAM_ID"],
    capabilities: ["preview deployment", "production deployment", "status", "error logs"],
  },
  {
    key: "payments",
    name: "Payments",
    category: "PAYMENTS" as const,
    detail: "Invoices, payment events and revenue tracking.",
    docsUrl: "https://stripe.com/docs/api",
    requiredEnv: [],
    optionalEnv: ["PAYMENT_PROVIDER_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    capabilities: ["invoices", "payment events", "webhooks"],
  },
  {
    key: "storage",
    name: "Site Storage",
    category: "STORAGE" as const,
    detail: "Where generated sites are stored for production delivery.",
    docsUrl: "",
    requiredEnv: [],
    optionalEnv: [],
    capabilities: ["generated site storage"],
  },
];

export async function ensureIntegrations(organizationId: string) {
  const existing = await db.find("integrations", { organizationId });
  const have = new Set(existing.map((i) => i.key));
  for (const def of INTEGRATIONS) {
    if (have.has(def.key)) continue;
    const connected = def.requiredEnv.length === 0 || def.requiredEnv.every((e) => Boolean(process.env[e]));
    await db.insert("integrations", {
      id: newId("int"),
      organizationId,
      key: def.key,
      name: def.name,
      category: def.category,
      status: connected ? "CONNECTED" : "NOT_CONNECTED",
      detail: def.detail,
      docsUrl: def.docsUrl,
      requiredEnv: def.requiredEnv,
      optionalEnv: def.optionalEnv,
      capabilities: def.capabilities,
      lastCheckedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
}

export async function ensureServicesAndPricing(organizationId: string) {
  if ((await db.count("services", { organizationId })) === 0) {
    await db.insertMany(
      "services",
      DEFAULT_SERVICES.map((s) => ({
        ...s,
        id: newId("svc"),
        organizationId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
    );
  }
  if ((await db.count("pricing_rules", { organizationId })) === 0) {
    await db.insertMany(
      "pricing_rules",
      DEFAULT_PRICING_RULES.map((r) => ({ ...r, id: newId("prc"), organizationId })),
    );
  }
}

/** Create (or fetch) the primary organisation. */
export async function ensureOrganization(): Promise<Organization> {
  const existing = await db.findOne("organizations", { slug: "nexora" });
  if (existing) return existing;
  const org: Organization = {
    id: newId("org"),
    name: "NEXORA",
    slug: "nexora",
    ownerName: "Sajid Raza",
    ownerEmail: "owner@nexora.app",
    logoUrl: null,
    brandColor: "#6366f1",
    accentColor: "#22d3ee",
    tagline: "Find. Build. Sell. Deliver. Automatically.",
    currency: "INR",
    timezone: "Asia/Kolkata",
    mode: db.demo() ? "DEMO" : "LIVE",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert("organizations", org);
  return org;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await promisify(scryptCallback)(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  if (!hash.startsWith("scrypt:")) return false;
  const [, saltHex, keyHex] = hash.split(":");
  if (!saltHex || !keyHex || !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(keyHex)) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = (await promisify(scryptCallback)(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return timingSafeEqual(expected, actual);
}

/** Full first-run bootstrap for the primary (live) organisation. */
export async function bootstrapPrimary(): Promise<Organization> {
  const org = await ensureOrganization();
  await ensureServicesAndPricing(org.id);
  await ensureIntegrations(org.id);
  await ensureAgentRegistry(org.id);
  const settings = await db.findOne("settings", { organizationId: org.id });
  if (!settings) await defaultSettings(org.id);
  return org;
}

/* ==========================================================================
   DEMO MODE
   ========================================================================== */

export async function ensureDemoOrganization(): Promise<Organization> {
  const existing = await db.findOne("organizations", { slug: DEMO_ORG.slug });
  if (existing) return existing;
  const org: Organization = {
    id: newId("org"),
    name: DEMO_ORG.name,
    slug: DEMO_ORG.slug,
    ownerName: DEMO_ORG.ownerName,
    ownerEmail: DEMO_ORG.ownerEmail,
    logoUrl: null,
    brandColor: "#6366f1",
    accentColor: "#22d3ee",
    tagline: "Find. Build. Sell. Deliver. Automatically.",
    currency: "INR",
    timezone: "Asia/Kolkata",
    mode: "DEMO",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert("organizations", org);
  await db.insert("users", {
    id: newId("usr"),
    organizationId: org.id,
    email: DEMO_USER.email,
    fullName: DEMO_USER.fullName,
    role: "OWNER",
    avatarUrl: null,
    passwordHash: await hashPassword(DEMO_USER.password),
    isDemo: true,
    lastLoginAt: null,
    createdAt: nowIso(),
  });
  await db.insert("organization_members", {
    id: newId("om"),
    organizationId: org.id,
    userId: (await db.findOne("users", { email: DEMO_USER.email }))!.id,
    role: "OWNER",
    createdAt: nowIso(),
  });
  await ensureServicesAndPricing(org.id);
  await ensureIntegrations(org.id);
  await ensureAgentRegistry(org.id);
  await defaultSettings(org.id);
  return org;
}

/** Populate the demo organisation with a complete, realistic dataset. */
export async function seedDemoData(organizationId: string, opts: { reset?: boolean } = {}) {
  if (opts.reset) {
    for (const b of DEMO_BUSINESSES) {
      const slug = `${slugify(b.name)}-${slugify(b.city)}`;
      const dir = join(process.env.NEXORA_SITE_ROOT ?? join(process.cwd(), "public", "generated"), slug);
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
    await clearOrganizationData(organizationId);
  }

  await ensureServicesAndPricing(organizationId);
  await ensureAgentRegistry(organizationId);

  const services = await db.find("services", { organizationId });
  const rules = await db.find("pricing_rules", { organizationId });

  const createdLeads: string[] = [];

  for (const [index, fixture] of DEMO_BUSINESSES.entries()) {
    const lead = await createLeadFromBusiness(organizationId, fixture);
    createdLeads.push(lead.id);

    // ---- research report ----
    const audit = buildSyntheticAudit(organizationId, lead.id, fixture);
    await db.insert("website_audits", audit);

    const score = computeSyntheticScore(organizationId, lead.id, fixture, audit);
    await db.insert("lead_scores", score);

    await db.insert("research_reports", {
      id: newId("res"),
      organizationId,
      leadId: lead.id,
      businessId: lead.businessId,
      summary: `${fixture.name} is a ${fixture.category.toLowerCase()} business in ${fixture.city}. ${
        fixture.siteProfile.hasWebsite
          ? fixture.siteProfile.reachable
            ? "Their website is reachable and was analysed."
            : "Their listed website could not be reached."
          : "No website was found on their public profile."
      } Core offerings: ${fixture.services.slice(0, 3).join(", ")}.`,
      services: fixture.services,
      targetCustomer: fixture.notes,
      onlinePresence: [
        fixture.siteProfile.hasWebsite ? `Website: ${fixture.website}` : "No website listed",
        `Google Business Profile with ${fixture.reviewCount} reviews`,
        Object.keys(fixture.socialLinks).length
          ? `Social: ${Object.keys(fixture.socialLinks).join(", ")}`
          : "No social profiles found",
      ],
      contactChannels: [fixture.phone ? "Phone" : null, fixture.email ? "Email" : null, "Google Business Profile"].filter(
        Boolean,
      ) as string[],
      socialActivity: Object.keys(fixture.socialLinks).length
        ? `Active on ${Object.keys(fixture.socialLinks).join(", ")}.`
        : "No public social activity found.",
      existingWebsite: fixture.website ?? "",
      businessMaturity: fixture.reviewCount > 200 ? "ESTABLISHED" : "GROWING",
      digitalOpportunities: audit.conversionOpportunities,
      differentiators: [`${fixture.reviewCount ?? 0} public reviews`, `Rated ${fixture.rating ?? 0}/5`],
      risks: fixture.email ? [] : ["No public email address — outreach must go via phone or profile"],
      confidence: fixture.siteProfile.reachable ? 0.8 : 0.5,
      provider: "local",
      model: "local-deterministic",
      createdAt: isoMinutesAgo(40 + index * 7),
    });

    // ---- strategy ----
    const theme = pickTheme(fixture.category, "light");
    const plan = defaultPagePlan(fixture.category);
    const strategy = {
      id: newId("str"),
      organizationId,
      leadId: lead.id,
      templateFamily: templateFamily(fixture.category),
      serviceKey: serviceKeyFor(fixture.category),
      pages: Object.keys(plan).map((p) => (p === "index" ? "Home" : p[0]!.toUpperCase() + p.slice(1))),
      sections: Object.entries(plan)
        .flatMap(([, components]) => components.filter((c) => c !== "navbar" && c !== "footer"))
        .slice(0, 8)
        .map((component, i) => ({
          id: newId("sec"),
          component,
          heading: fixture.services[i % fixture.services.length] ?? component,
          purpose: `Supports the ${fixture.category.toLowerCase()} conversion path`,
          content: {} as Record<string, unknown>,
        })),
      theme: {
        palette: theme.palette,
        primary: theme.primary,
        accent: theme.accent,
        neutral: theme.neutral,
        fontHeading: theme.fontHeading,
        fontBody: theme.fontBody,
        radius: theme.radius,
        mood: theme.mood,
      },
      copyDirection: `${theme.mood} tone. Lead with the outcome, then proof, then one clear action.`,
      conversionGoals: ["WhatsApp enquiry", "Phone call"],
      mustHaveFeatures: ["Mobile-first layout", "WhatsApp click-to-chat", "Enquiry form", "SEO metadata"],
      seoKeywords: [fixture.category.toLowerCase(), `${fixture.category.toLowerCase()} in ${fixture.city}`],
      rationale: `${fixture.name} is a ${fixture.category.toLowerCase()} business in ${fixture.city}. The ${templateFamily(
        fixture.category,
      )} template family fits because ${audit.conversionOpportunities.slice(0, 2).join(" and ").toLowerCase()}.`,
      provider: "local",
      createdAt: isoMinutesAgo(35 + index * 6),
    };
    await db.insert("strategies", strategy);

    // ---- demo site (generated for real, on disk) ----
    const demoSlug = `${slugify(fixture.name)}-${slugify(fixture.city)}`;
    let demo: { id: string; previewUrl: string; fileCount: number; totalBytes: number; pages: string[] } | null = null;
    if (fixture.demoStage !== "DISCOVERED" && fixture.demoStage !== "RESEARCHING" && fixture.demoStage !== "AUDITED") {
      const content = composeSiteContent({
        name: fixture.name,
        category: fixture.category,
        subcategory: fixture.subcategory,
        city: fixture.city,
        address: fixture.address ?? "",
        phone: fixture.phone,
        email: fixture.email,
        website: fixture.website,
        rating: fixture.rating,
        reviewCount: fixture.reviewCount,
        socialLinks: fixture.socialLinks,
        mapsUrl: fixture.mapsUrl,
        services: fixture.services,
      });
      const result = writeSite({
        slug: demoSlug,
        business: content,
        theme,
        pagePlan: plan,
        demo: true,
        outputRoot: process.env.NEXORA_SITE_ROOT ?? join(process.cwd(), "public", "generated"),
      });
      const qa = runQa({
        organizationId,
        targetType: "DEMO",
        targetId: "pending",
        label: fixture.name,
        files: result.files,
      });
      const demoSite = {
        id: newId("dem"),
        organizationId,
        leadId: lead.id,
        strategyId: strategy.id,
        slug: demoSlug,
        businessName: fixture.name,
        templateFamily: strategy.templateFamily,
        serviceKey: strategy.serviceKey,
        status: "DEPLOYED" as const,
        pages: result.pages,
        outputDir: result.outputDir,
        previewUrl: `/generated/${demoSlug}/index.html`,
        theme: { ...strategy.theme },
        fileCount: result.files.length,
        totalBytes: result.totalBytes,
        generatedBy: "builder",
        error: null,
        createdAt: isoMinutesAgo(30 + index * 5),
        updatedAt: isoMinutesAgo(28 + index * 5),
      };
      await db.insert("demo_sites", demoSite);
      demo = demoSite;

      await db.insert("qa_runs", { ...qa, id: newId("qa"), targetId: demoSite.id });
      await db.insert("deployments", {
        id: newId("dep"),
        organizationId,
        targetType: "DEMO",
        targetId: demoSite.id,
        projectId: null,
        kind: "PREVIEW",
        state: "READY",
        url: demoSite.previewUrl,
        provider: "local",
        providerRef: `local_${demoSlug}`,
        branch: "preview",
        commitSha: "",
        buildLog: "Deployed to the local preview server.",
        healthCheck: "HEALTHY",
        customDomain: null,
        createdAt: isoMinutesAgo(27 + index * 5),
        updatedAt: isoMinutesAgo(27 + index * 5),
      });
    }

    // ---- lead status ----
    await db.update("leads", lead.id, {
      status: stageStatus(fixture.demoStage),
      pipelineStage: PIPELINE_STAGE_LABELS[fixture.demoStage] ?? "Discovered",
      priority: score.priority,
      score: score.total,
      websiteStatus: audit.hasWebsite ? (audit.overallGrade === "A" || audit.overallGrade === "B" ? "MODERN" : "OUTDATED") : "NONE",
      tags: [fixture.category],
      lastContactedAt: ["OUTREACH", "REPLIED", "INTERESTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].includes(
        fixture.demoStage,
      )
        ? isoMinutesAgo(20 + index * 3)
        : null,
      updatedAt: isoMinutesAgo(25 + index * 5),
    });

    // ---- outreach + conversation ----
    const contacted = ["OUTREACH", "REPLIED", "INTERESTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].includes(
      fixture.demoStage,
    );
    if (contacted) {
      const message = {
        id: newId("out"),
        organizationId,
        leadId: lead.id,
        campaignId: null,
        channel: fixture.email ? ("EMAIL" as const) : ("MANUAL" as const),
        status: "SENT" as const,
        subject: `${fixture.name} — two things I noticed`,
        body: demoOutreachBody(fixture, demo?.previewUrl ?? null),
        personalization: [fixture.category, fixture.city, `${fixture.reviewCount ?? 0} reviews`],
        toAddress: fixture.email ?? fixture.phone ?? "",
        providerMessageId: null,
        threadId: null,
        riskLevel: "HIGH" as const,
        approvalRequired: true,
        approvedBy: null,
        sentAt: isoMinutesAgo(20 + index * 3),
        openedAt: isoMinutesAgo(19 + index * 3),
        repliedAt: fixture.inbound ? isoMinutesAgo(12 + index * 2) : null,
        error: null,
        createdBy: "outreach",
        createdAt: isoMinutesAgo(22 + index * 3),
        updatedAt: isoMinutesAgo(12 + index * 2),
      };
      await db.insert("outreach_messages", message);

      if (fixture.inbound) {
        const conversation = {
          id: newId("cnv"),
          organizationId,
          leadId: lead.id,
          clientId: null,
          subject: `Re: ${fixture.name} — website enquiry`,
          channel: fixture.email ? ("EMAIL" as const) : ("MANUAL" as const),
          state: "OPEN" as const,
          lastIntent: null,
          unreadCount: 1,
          assignedTo: null,
          createdAt: isoMinutesAgo(12 + index * 2),
          updatedAt: isoMinutesAgo(10 + index * 2),
        };
        await db.insert("conversations", conversation);
        await db.insert("messages", {
          id: newId("msg"),
          organizationId,
          conversationId: conversation.id,
          direction: "INBOUND",
          channel: conversation.channel,
          fromAddress: fixture.email ?? fixture.phone ?? "",
          toAddress: "owner@nexora.app",
          subject: conversation.subject,
          body: fixture.inbound,
          intent: null,
          intentConfidence: null,
          suggestedReply: null,
          isFromAgent: false,
          agentKey: null,
          readAt: null,
          createdAt: isoMinutesAgo(12 + index * 2),
        });
      }
    }

    // ---- proposal ----
    if (["PROPOSAL", "NEGOTIATION", "WON"].includes(fixture.demoStage)) {
      await createDemoProposal(organizationId, lead.id, fixture.name, services, rules, fixture.demoStage === "WON" ? "ACCEPTED" : "SENT", index);
    }

    // ---- client + project for WON ----
    if (fixture.demoStage === "WON") {
      await createDemoClient(organizationId, lead.id, fixture, index);
    }

    // ---- activity events ----
    await db.insertMany(
      "activity_events",
      buildDemoActivity(organizationId, lead.id, fixture, demo?.previewUrl ?? null, index),
    );
  }

  // ---- global demo artefacts ----
  await seedDemoSupportAndRevenue(organizationId, createdLeads);
  await seedDemoApprovals(organizationId);
  await seedDemoNotifications(organizationId);

  return { leads: createdLeads.length, businesses: DEMO_BUSINESSES.length };
}

function templateFamily(category: string) {
  const c = category.toLowerCase();
  if (/restaurant|cafe|food/.test(c)) return "restaurant";
  if (/coaching|academy|tuition/.test(c)) return "coaching-institute";
  if (/school/.test(c)) return "school";
  if (/gym|fitness/.test(c)) return "gym";
  if (/dental|clinic|doctor/.test(c)) return "doctor-clinic";
  if (/salon|spa|beauty/.test(c)) return "salon";
  if (/retail|store|shop/.test(c)) return "retail-store";
  if (/interior|architect/.test(c)) return "interior";
  if (/travel|tour/.test(c)) return "travel";
  return "local-business";
}

function serviceKeyFor(category: string) {
  const c = category.toLowerCase();
  if (/restaurant|cafe|food/.test(c)) return "restaurant-website";
  if (/coaching|school|academy|institute/.test(c)) return "institute-website";
  if (/retail|store|shop|boutique/.test(c)) return "ecommerce";
  return "business-website";
}

const PIPELINE_STAGE_LABELS: Record<string, "Discovered" | "Researching" | "Audited" | "Qualified" | "Demo Building" | "Demo Ready" | "Outreach" | "Replied" | "Interested" | "Proposal" | "Negotiation" | "Won" | "Lost"> = {
  DISCOVERED: "Discovered",
  RESEARCHING: "Researching",
  AUDITED: "Audited",
  QUALIFIED: "Qualified",
  STRATEGY: "Qualified",
  DEMO_READY: "Demo Ready",
  OUTREACH: "Outreach",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

function stageStatus(stage: string) {
  const map: Record<string, Parameters<typeof db.update<"leads">>[2]["status"]> = {
    DISCOVERED: "DISCOVERED",
    RESEARCHING: "RESEARCHING",
    AUDITED: "AUDITED",
    QUALIFIED: "QUALIFIED",
    STRATEGY: "STRATEGY",
    DEMO_READY: "DEMO_READY",
    OUTREACH: "OUTREACH",
    REPLIED: "REPLIED",
    INTERESTED: "INTERESTED",
    PROPOSAL: "PROPOSAL",
    NEGOTIATION: "NEGOTIATION",
    WON: "WON",
    LOST: "LOST",
  };
  return map[stage] ?? "DISCOVERED";
}

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function buildSyntheticAudit(
  organizationId: string,
  leadId: string,
  fixture: (typeof DEMO_BUSINESSES)[number],
): WebsiteAudit {
  const p = fixture.siteProfile;
  const findings: WebsiteAudit["findings"] = [];
  const add = (
    code: string,
    label: string,
    severity: WebsiteAudit["findings"][number]["severity"],
    detail: string,
    recommendation: string,
  ) =>
    findings.push({
      id: newId("fnd"),
      code,
      label,
      severity,
      detail,
      evidence: "demo fixture",
      recommendation,
    });

  if (!p.hasWebsite) {
    add(
      "no-website",
      "No website found",
      "CRITICAL",
      "No website was listed on the public business profile.",
      "Without a website the business is invisible to anyone searching for the service.",
    );
  } else {
    if (!p.reachable)
      add("unreachable", "Website unreachable", "CRITICAL", "The listed website could not be loaded.", "A website that does not load actively loses customers.");
    if (!p.https)
      add("https", "No HTTPS", "CRITICAL", "The site is not served over HTTPS.", "Move to HTTPS — browsers label the site 'Not Secure'.");
    if (!p.responsive)
      add("mobile", "Mobile responsiveness", "CRITICAL", "No responsive viewport declaration found.", "Most local traffic is mobile — the site must adapt to phone widths.");
    if (p.legacy)
      add("legacy", "Outdated markup", "HIGH", "The page relies on legacy layout techniques.", "Rebuild with modern semantic HTML and CSS.");
    if (!p.hasForm)
      add("forms", "No enquiry form", "HIGH", "There is no way to capture an enquiry from a visitor who will not call.", "Add a short enquiry form with name, phone and message.");
    if (!p.hasWhatsapp)
      add("whatsapp", "No WhatsApp integration", "MEDIUM", "The site does not offer WhatsApp contact.", "WhatsApp is the fastest way for local customers to reach you.");
    if (!p.hasBooking && /clinic|salon|gym|dental|restaurant|spa/i.test(fixture.category))
      add("booking", "No booking flow", "HIGH", "The business type normally takes appointments but the site has no booking path.", "Add a simple appointment request form.");
    if (!p.hasEcommerce && /retail|store|shop/i.test(fixture.category))
      add("ecommerce", "No online ordering", "MEDIUM", "A retail business with no way to order online.", "Even a WhatsApp ordering flow captures sales outside opening hours.");
    if (!p.hasMeta)
      add("metadata", "Incomplete metadata", "MEDIUM", "Title, description or social preview tags are incomplete.", "Complete metadata improves click-through from search.");
    if (!p.hasSocial)
      add("social", "No social links", "LOW", "The site does not link to any social profile.", "Link the profiles you already maintain.");
    if (p.seoScore < 60)
      add("seo", "SEO basics", "MEDIUM", `SEO score ${p.seoScore}/100.`, "These tags are what search engines read — cheap wins with real impact.");
    if (p.perfScore < 60)
      add("performance", "Performance concerns", "MEDIUM", `Estimated performance score ${p.perfScore}/100.`, "Reduce page weight and third-party scripts.");
    if (p.a11yScore < 60)
      add("a11y", "Accessibility basics", "MEDIUM", `Accessibility score ${p.a11yScore}/100.`, "Accessible sites convert better and reach more customers.");
  }

  const grade = !p.hasWebsite
    ? "F"
    : Math.round((p.seoScore + p.perfScore + p.a11yScore) / 3) >= 75
      ? "B"
      : Math.round((p.seoScore + p.perfScore + p.a11yScore) / 3) >= 55
        ? "C"
        : "D";

  return {
    id: newId("aud"),
    organizationId,
    leadId,
    url: fixture.website,
    auditedAt: isoMinutesAgo(30),
    hasWebsite: p.hasWebsite,
    reachable: p.reachable,
    https: p.https,
    statusCode: p.reachable ? 200 : null,
    loadTimeMs: p.reachable ? 900 + (100 - p.perfScore) * 30 : 0,
    mobileResponsive: p.responsive ? "YES" : "NO",
    navigationScore: p.hasNav ? 70 : 20,
    visualHierarchyScore: 55,
    designEra: !p.hasWebsite ? "NONE" : p.legacy ? "LEGACY" : p.responsive ? "CURRENT" : "DATED",
    brokenPages: p.reachable ? [] : [fixture.website ?? ""],
    hasContactCta: p.reachable,
    hasWhatsapp: p.hasWhatsapp,
    hasForms: p.hasForm,
    hasBooking: p.hasBooking,
    hasEcommerce: p.hasEcommerce,
    performanceScore: p.perfScore,
    seoScore: p.seoScore,
    accessibilityScore: p.a11yScore,
    hasMetadata: p.hasMeta,
    hasSocialLinks: p.hasSocial,
    trustElements: p.reachable ? ["physical address", "direct contact"] : [],
    conversionOpportunities: buildOpportunities(fixture),
    findings,
    overallGrade: grade,
    provider: "demo-fixture",
    createdAt: isoMinutesAgo(30),
  };
}

function buildOpportunities(fixture: (typeof DEMO_BUSINESSES)[number]) {
  const out: string[] = [];
  if (!fixture.siteProfile.hasWebsite) out.push("A website at all");
  if (!fixture.siteProfile.hasWhatsapp) out.push("WhatsApp click-to-chat");
  if (!fixture.siteProfile.hasForm) out.push("Enquiry form above the fold");
  if (!fixture.siteProfile.hasBooking) out.push("Online appointment request");
  if (!fixture.siteProfile.hasEcommerce) out.push("Online ordering / catalogue");
  if (fixture.siteProfile.perfScore < 70) out.push("Performance rebuild");
  if (fixture.siteProfile.seoScore < 60) out.push("SEO foundation");
  return out.slice(0, 5);
}

function computeSyntheticScore(
  organizationId: string,
  leadId: string,
  fixture: (typeof DEMO_BUSINESSES)[number],
  audit: WebsiteAudit,
) {
  const p = fixture.siteProfile;
  const websiteNeed = !p.hasWebsite ? 1 : !p.reachable ? 0.95 : 0.75;
  const currentSiteQuality = p.reachable ? (p.seoScore + p.perfScore + p.a11yScore) / 300 : 0;
  const businessActivity = Math.min(1, (fixture.reviewCount ?? 0) / 400);
  const contactability = (fixture.email ? 0.5 : 0) + (fixture.phone ? 0.3 : 0) + 0.2;
  const serviceFit = /restaurant|coaching|gym|dental|retail|interior|travel|salon/i.test(fixture.category) ? 0.9 : 0.6;
  const businessValue = Math.min(1, (fixture.reviewCount ?? 0) / 350) * 0.6 + ((fixture.rating ?? 0) >= 4 ? 0.4 : 0.2);
  const technicalOpportunity = Math.min(1, audit.conversionOpportunities.length / 5);
  const evidenceStrength = p.reachable ? 0.9 : 0.5;

  const factors = [
    { key: "website_need", label: "Genuine website need", weight: 0.3, value: websiteNeed, contribution: 0.3 * websiteNeed, note: "" },
    { key: "current_site_quality", label: "Quality of current site", weight: 0.18, value: currentSiteQuality, contribution: 0.18 * currentSiteQuality, note: `Audit grade ${audit.overallGrade}` },
    { key: "business_activity", label: "Business activity", weight: 0.14, value: businessActivity, contribution: 0.14 * businessActivity, note: `${fixture.reviewCount} reviews` },
    { key: "contactability", label: "Available public contact method", weight: 0.14, value: contactability, contribution: 0.14 * contactability, note: "" },
    { key: "service_fit", label: "Fit with available services", weight: 0.12, value: serviceFit, contribution: 0.12 * serviceFit, note: "" },
    { key: "business_value", label: "Likely value of a better site", weight: 0.07, value: businessValue, contribution: 0.07 * businessValue, note: "" },
    { key: "technical_opportunity", label: "Technical opportunity", weight: 0.03, value: technicalOpportunity, contribution: 0.03 * technicalOpportunity, note: "" },
    { key: "evidence_strength", label: "Strength of evidence", weight: 0.02, value: evidenceStrength, contribution: 0.02 * evidenceStrength, note: "" },
  ].map((f) => ({ ...f, contribution: Math.round(f.contribution * 1000) / 1000 }));

  const total = Math.round(factors.reduce((a, f) => a + f.contribution, 0) * 100);
  const priority = total >= 75 ? "HOT" : total >= 55 ? "WARM" : total >= 35 ? "COLD" : "REJECTED";

  return {
    id: newId("scr"),
    organizationId,
    leadId,
    total: Math.max(5, Math.min(98, total)),
    priority: priority as "HOT" | "WARM" | "COLD" | "REJECTED",
    factors,
    reasoning: `Priority ${priority}. Strongest signals: ${factors
      .slice()
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((f) => f.label)
      .join(", ")}.`,
    evidenceStrength,
    scoredBy: "scorer",
    createdAt: isoMinutesAgo(29),
  };
}

function demoOutreachBody(fixture: (typeof DEMO_BUSINESSES)[number], demoUrl: string | null) {
  return [
    "Hi there,",
    "",
    fixture.siteProfile.hasWebsite
      ? `I was looking at ${fixture.name} and noticed a couple of things on the current site — the main one being that it doesn't give a visitor an obvious next step.`
      : `I was looking at ${fixture.name} and couldn't find a website on your Google listing. With ${fixture.reviewCount} reviews you clearly have demand — it just has nowhere to land.`,
    "",
    demoUrl
      ? `I put together a quick concept so you can see what I mean rather than imagine it: ${demoUrl}`
      : `I'd be glad to sketch a quick concept so you can see what I mean rather than imagine it.`,
    "",
    "It's a concept, not a pitch. If it's useful I'll walk you through it. If not, no problem at all.",
    "",
    "Best,",
    "Sajid Raza",
    "NEXORA",
  ].join("\n");
}

async function createDemoProposal(
  organizationId: string,
  leadId: string,
  businessName: string,
  services: Awaited<ReturnType<typeof db.find<"services">>>,
  rules: Awaited<ReturnType<typeof db.find<"pricing_rules">>>,
  status: "SENT" | "ACCEPTED",
  index: number,
) {
  const strategy = (await db.find("strategies", { leadId })).at(-1) ?? null;
  const { computePrice } = await import("./pricing/engine");
  const quote = computePrice(
    { serviceKey: strategy?.serviceKey ?? "business-website", pages: 4, maintenanceMonths: 3 },
    services,
    rules,
  );
  const count = await db.count("proposals", { organizationId });
  const proposal = {
    id: newId("prp"),
    organizationId,
    leadId,
    clientId: null,
    number: `NX-2026-${String(count + 1).padStart(4, "0")}`,
    status,
    title: `${businessName} — ${services.find((s) => s.key === (strategy?.serviceKey ?? "business-website"))?.name ?? "Website"} project`,
    projectSummary: strategy?.rationale ?? `A new website for ${businessName}.`,
    problem: "The current site does not convert visitors into enquiries.",
    proposedSolution: strategy?.copyDirection ?? "A focused, conversion-led website.",
    pages: strategy?.pages ?? ["Home", "Services", "About", "Contact"],
    functionality: strategy?.mustHaveFeatures ?? [],
    deliverables: ["Responsive design", "Contact form", "WhatsApp integration", "SEO setup", "Deployment", "Handover docs"],
    milestones: [
      { id: newId("mil"), name: "Kick-off & content", description: "Requirements confirmed, assets received.", days: 2, amount: 3000, status: "DONE" as const },
      { id: newId("mil"), name: "Design", description: "Homepage and inner pages for approval.", days: 4, amount: 6000, status: "DONE" as const },
      { id: newId("mil"), name: "Build", description: "Full implementation.", days: 5, amount: 8000, status: "IN_PROGRESS" as const },
      { id: newId("mil"), name: "QA & launch", description: "Testing, deployment, handover.", days: 2, amount: 6000, status: "PENDING" as const },
    ],
    subtotal: quote.subtotal,
    discount: 0,
    total: quote.total,
    currency: "INR",
    validUntil: new Date(Date.now() + 21 * 864e5).toISOString(),
    revisionPolicy: "Two rounds of revisions are included per page.",
    maintenanceTerms: "Three months of maintenance included: content changes, backups, uptime monitoring, security updates.",
    hostingTerms: "Hosting is arranged and billed separately at cost. Domain registration remains in the client's name.",
    termsPlaceholder: "Payment: 50% on signature, 50% on delivery. [LEGAL REVIEW REQUIRED]",
    upgradeOptions: services.find((s) => s.key === (strategy?.serviceKey ?? "business-website"))?.upgrades ?? [],
    createdBy: "proposal",
    sentAt: isoMinutesAgo(18 + index),
    createdAt: isoMinutesAgo(20 + index),
    updatedAt: isoMinutesAgo(16 + index),
  };
  await db.insert("proposals", proposal);
  await db.insertMany(
    "proposal_items",
    quote.lines.map((l) => ({
      id: newId("pit"),
      proposalId: proposal.id,
      label: l.label,
      description: l.description,
      quantity: 1,
      unitPrice: l.amount,
      amount: l.amount,
      kind: l.kind,
    })),
  );
  if (status === "ACCEPTED") {
    await db.insert("revenue_events", {
      id: newId("rev"),
      organizationId,
      clientId: null,
      projectId: null,
      proposalId: proposal.id,
      kind: "PROJECT_FEE",
      amount: proposal.total,
      currency: "INR",
      status: "INVOICED",
      description: `Proposal ${proposal.number} accepted`,
      occurredAt: isoMinutesAgo(15 + index),
      createdAt: isoMinutesAgo(15 + index),
    });
  }
}

async function createDemoClient(
  organizationId: string,
  leadId: string,
  fixture: (typeof DEMO_BUSINESSES)[number],
  index: number,
) {
  const proposal = (await db.find("proposals", { leadId })).at(-1) ?? null;
  const strategy = (await db.find("strategies", { leadId })).at(-1) ?? null;
  const client = {
    id: newId("clt"),
    organizationId,
    leadId,
    businessId: (await db.byId("leads", leadId))!.businessId,
    name: fixture.name,
    slug: slugify(fixture.name),
    status: "ACTIVE" as const,
    lifetimeValue: proposal?.total ?? 45000,
    monthlyRecurring: 4999,
    contractValue: proposal?.total ?? 45000,
    onboardingProgress: 100,
    primaryEmail: fixture.email ?? "",
    primaryPhone: fixture.phone ?? "",
    createdAt: isoMinutesAgo(14 + index),
    updatedAt: isoMinutesAgo(14 + index),
  };
  await db.insert("clients", client);
  await db.update("proposals", proposal!.id, { clientId: client.id, status: "ACCEPTED" });

  await db.insert("client_contacts", {
    id: newId("cc"),
    clientId: client.id,
    name: "Owner",
    role: "Decision maker",
    email: fixture.email ?? "",
    phone: fixture.phone ?? "",
    isPrimary: true,
  });

  const onboardingData = {
    companyName: fixture.name,
    logoUrl: "",
    brandColors: [],
    businessDescription: `${fixture.name} is a ${fixture.category.toLowerCase()} business in ${fixture.city}.`,
    services: fixture.services,
    socialUrls: fixture.socialLinks,
    phone: fixture.phone ?? "",
    email: fixture.email ?? "",
    address: fixture.address ?? "",
    images: [],
    productInfo: "",
    preferredFeatures: ["WhatsApp ordering", "Gallery", "Reviews"],
    inspiration: [],
    domain: "",
    domainProvider: "",
    notes: "Onboarding completed via the demo seed.",
  };
  const { completion, missing } = onboardingCompletion(onboardingData as Record<string, unknown>);
  await db.insert("onboarding_submissions", {
    id: newId("onb"),
    organizationId,
    clientId: client.id,
    status: "COMPLETE",
    completion,
    data: onboardingData,
    missing,
    submittedAt: isoMinutesAgo(13 + index),
    createdAt: isoMinutesAgo(13 + index),
    updatedAt: isoMinutesAgo(13 + index),
  });

  const project = {
    id: newId("prj"),
    organizationId,
    clientId: client.id,
    proposalId: proposal?.id ?? null,
    strategyId: strategy?.id ?? null,
    name: `${fixture.name} website`,
    slug: `${slugify(fixture.name)}-site`,
    serviceKey: strategy?.serviceKey ?? "business-website",
    stage: "Deployment" as const,
    progress: 88,
    repositoryUrl: null,
    previewUrl: `/generated/${slugify(fixture.name)}-${slugify(fixture.city)}/index.html`,
    productionUrl: null,
    dueDate: new Date(Date.now() + 5 * 864e5).toISOString(),
    value: proposal?.total ?? 45000,
    repoProvider: "github",
    createdAt: isoMinutesAgo(12 + index),
    updatedAt: isoMinutesAgo(11 + index),
  };
  await db.insert("projects", project);
  await db.insertMany(
    "project_requirements",
    (strategy?.mustHaveFeatures ?? ["Responsive design", "Contact form"]).map((title) => ({
      id: newId("req"),
      projectId: project.id,
      title,
      detail: "Derived from the accepted strategy and proposal.",
      status: "DONE" as const,
      source: "STRATEGY" as const,
      createdAt: isoMinutesAgo(12 + index),
    })),
  );
  await db.insert("website_builds", {
    id: newId("bld"),
    organizationId,
    projectId: project.id,
    strategyId: strategy?.id ?? null,
    version: 1,
    status: "BUILT",
    outputDir: join(process.env.NEXORA_SITE_ROOT ?? join(process.cwd(), "public", "generated"), `${slugify(fixture.name)}-${slugify(fixture.city)}`),
    pages: strategy?.pages ?? ["Home", "Services", "About", "Contact"],
    componentsUsed: ["navbar", "hero", "services", "contact", "footer"],
    fileCount: 7,
    totalBytes: 42000,
    builtBy: "production_builder",
    error: null,
    createdAt: isoMinutesAgo(11 + index),
    updatedAt: isoMinutesAgo(11 + index),
  });
  await db.insert("deployments", {
    id: newId("dep"),
    organizationId,
    targetType: "BUILD",
    targetId: (await db.find("website_builds", { projectId: project.id }))[0]!.id,
    projectId: project.id,
    kind: "PREVIEW",
    state: "READY",
    url: project.previewUrl ?? "",
    provider: "local",
    providerRef: `local_${project.slug}`,
    branch: "preview",
    commitSha: "",
    buildLog: "Preview deployment ready.",
    healthCheck: "HEALTHY",
    customDomain: null,
    createdAt: isoMinutesAgo(10 + index),
    updatedAt: isoMinutesAgo(10 + index),
  });
  const revenueRows: Array<NonNullable<Database["revenue_events"][number]>> = [
    {
      id: newId("rev"),
      organizationId,
      clientId: client.id,
      projectId: project.id,
      proposalId: proposal?.id ?? null,
      kind: "PROJECT_FEE" as const,
      amount: (proposal?.total ?? 45000) * 0.5,
      currency: "INR",
      status: "PAID" as const,
      description: "Advance payment on signature",
      occurredAt: isoMinutesAgo(10 + index),
      createdAt: isoMinutesAgo(10 + index),
    },
    {
      id: newId("rev"),
      organizationId,
      clientId: client.id,
      projectId: project.id,
      proposalId: null,
      kind: "MAINTENANCE" as const,
      amount: 4999,
      currency: "INR",
      status: "INVOICED" as const,
      description: "Monthly maintenance",
      occurredAt: isoMinutesAgo(3 + index),
      createdAt: isoMinutesAgo(3 + index),
    },
  ];
  await db.insertMany("revenue_events", revenueRows);
}

function buildDemoActivity(
  organizationId: string,
  leadId: string,
  fixture: (typeof DEMO_BUSINESSES)[number],
  demoUrl: string | null,
  index: number,
) {
  type ActivityRow = NonNullable<Database["activity_events"][number]>;
  const events: ActivityRow[] = [];
  const push = (
    agentKey: ActivityRow["agentKey"],
    actionType: string,
    title: string,
    detail: string,
    minutesAgo: number,
    status: ActivityRow["status"] = "OK",
    riskLevel: ActivityRow["riskLevel"] = "LOW",
  ) =>
    events.push({
      id: newId("act"),
      organizationId,
      agentKey,
      actorType: "AGENT",
      actionType,
      title,
      detail,
      entityType: "lead",
      entityId: leadId,
      leadId,
      clientId: null,
      projectId: null,
      riskLevel,
      status,
      meta: {},
      createdAt: isoMinutesAgo(minutesAgo),
    });

  push("scout", "lead.discovered", `Scout discovered ${fixture.name}`, `${fixture.category} in ${fixture.city} via ${fixture.discoverySource}`, 45 + index);
  push("researcher", "lead.research.completed", `Researcher completed ${fixture.name} analysis`, `Services: ${fixture.services.slice(0, 3).join(", ")}`, 40 + index);
  if (fixture.siteProfile.hasWebsite) {
    push("auditor", "lead.audit.completed", `Auditor completed ${fixture.name} website analysis`, `Overall grade from public signals`, 38 + index);
  } else {
    push("auditor", "lead.audit.completed", `Auditor found no website for ${fixture.name}`, "No website listed on the public profile", 38 + index, "WARN");
  }
  push("scorer", "lead.scored", `Opportunity score computed for ${fixture.name}`, `Weighted factors stored for audit`, 36 + index);
  push("strategist", "strategy.generated", `Strategist proposed a ${templateFamily(fixture.category)} website`, `Theme and component plan selected`, 34 + index);
  if (demoUrl) {
    push("builder", "demo.completed", `Builder generated a demo for ${fixture.name}`, demoUrl, 32 + index);
    push("qa", "qa.passed", `QA PASS for ${fixture.name} demo`, "All critical checks passed", 31 + index);
    push("deployer", "deployment.completed", `Preview deployment completed for ${fixture.name}`, demoUrl, 30 + index);
    push("outreach", "outreach.prepared", `Outreach draft created for ${fixture.name}`, "Personalised from research and audit findings", 28 + index, "PENDING", "MEDIUM");
  }
  if (fixture.inbound) {
    push("sales", "message.received", `Prospect replied from ${fixture.name}`, fixture.inbound.slice(0, 120), 12 + index, "OK", "MEDIUM");
  }
  if (fixture.demoStage === "WON") {
    push("supervisor", "client.created", `${fixture.name} became a client`, "Proposal accepted, onboarding started", 14 + index, "OK", "HIGH");
    push("production_builder", "project.started", `Production build started for ${fixture.name}`, "Generated from the approved strategy and onboarding data", 12 + index);
  }
  return events;
}

async function seedDemoSupportAndRevenue(organizationId: string, leadIds: string[]) {
  const client = await db.findOne("clients", { organizationId });
  if (!client) return;
  await db.insert("support_tickets", {
    id: newId("tik"),
    organizationId,
    clientId: client.id,
    projectId: (await db.findOne("projects", { organizationId }))?.id ?? null,
    subject: "Homepage hero image looks stretched on mobile",
    category: "design request",
    status: "IN_PROGRESS",
    priority: "NORMAL",
    description: "On an iPhone the hero image is cropped oddly. Can we use a taller crop?",
    resolution: "",
    isUpsell: false,
    upsellOpportunityId: null,
    createdAt: isoMinutesAgo(400),
    updatedAt: isoMinutesAgo(120),
  });
  await db.insert("support_tickets", {
    id: newId("tik"),
    organizationId,
    clientId: client.id,
    projectId: null,
    subject: "Can you add a blog section we can post to?",
    category: "new feature",
    status: "TRIAGED",
    priority: "LOW",
    description: "We'd like to publish announcements ourselves.",
    resolution: "",
    isUpsell: true,
    upsellOpportunityId: null,
    createdAt: isoMinutesAgo(300),
    updatedAt: isoMinutesAgo(200),
  });
  await db.insert("upsell_opportunities", {
    id: newId("ups"),
    organizationId,
    clientId: client.id,
    ticketId: (await db.find("support_tickets", { organizationId }))[1]?.id ?? null,
    title: "Blog / news section with self-serve publishing",
    rationale: "Feature requests are billable scope — routed to the upsell pipeline.",
    serviceKey: "business-website",
    estimatedValue: 12000,
    status: "NEW",
    createdAt: isoMinutesAgo(200),
  });
  void leadIds;
}

async function seedDemoApprovals(organizationId: string) {
  const pending = await db.findOne("outreach_messages", { organizationId });
  if (pending) {
    await db.insert("approval_requests", {
      id: newId("apr"),
      organizationId,
      action: "outreach_sending",
      title: `Send outreach to the next queued lead`,
      reason:
        "Outreach is a YELLOW action. It runs automatically only when the owner enables automatic sending in Settings → Automation.",
      requestingAgent: "outreach",
      entityType: "outreach_message",
      entityId: pending.id,
      riskLevel: "HIGH",
      permissionLevel: "YELLOW",
      status: "PENDING",
      payload: { channel: pending.channel, subject: pending.subject },
      diff: {},
      decisionNote: null,
      decidedBy: null,
      decidedAt: null,
      expiresAt: null,
      createdAt: isoMinutesAgo(9),
    });
  }
  await db.insert("approval_requests", {
    id: newId("apr"),
    organizationId,
    action: "production_deployment",
    title: "Deploy the production build for the won client",
    reason:
      "Production deployments are gated. Approving queues the build for production deployment through the configured provider.",
    requestingAgent: "deployer",
    entityType: "build",
    entityId: "",
    riskLevel: "HIGH",
    permissionLevel: "RED",
    status: "PENDING",
    payload: {},
    diff: {},
    decisionNote: null,
    decidedBy: null,
    decidedAt: null,
    expiresAt: null,
    createdAt: isoMinutesAgo(6),
  });
  await db.insert("approval_requests", {
    id: newId("apr"),
    organizationId,
    action: "discount_beyond_limit",
    title: "Discount request of 25% on the coaching institute proposal",
    reason: "The requested discount exceeds the configured 15% ceiling.",
    requestingAgent: "proposal",
    entityType: "proposal",
    entityId: "",
    riskLevel: "HIGH",
    permissionLevel: "RED",
    status: "PENDING",
    payload: { requested: 25, limit: 15 },
    diff: {},
    decisionNote: null,
    decidedBy: null,
    decidedAt: null,
    expiresAt: null,
    createdAt: isoMinutesAgo(4),
  });
}

async function seedDemoNotifications(organizationId: string) {
  const specs: Array<NonNullable<Database["notifications"][number]>> = [
    {
      id: newId("ntf"),
      organizationId,
      type: "approval_required",
      title: "3 approvals are waiting for you",
      body: "Outreach, production deployment and a discount request.",
      entityType: "approval",
      entityId: "",
      href: "/approvals",
      severity: "WARNING",
      read: false,
      createdAt: isoMinutesAgo(4),
    },
    {
      id: newId("ntf"),
      organizationId,
      type: "prospect_reply",
      title: "Royal Spice Restaurant replied",
      body: "They asked about adding online ordering to the demo.",
      entityType: "conversation",
      entityId: "",
      href: "/conversations",
      severity: "SUCCESS",
      read: false,
      createdAt: isoMinutesAgo(11),
    },
    {
      id: newId("ntf"),
      organizationId,
      type: "build_completed",
      title: "Production build ready for review",
      body: "Oakline Interiors — 7 files, 4 pages.",
      entityType: "project",
      entityId: "",
      href: "/projects",
      severity: "SUCCESS",
      read: true,
      createdAt: isoMinutesAgo(120),
    },
  ];
  await db.insertMany("notifications", specs);
}

/** Remove every row belonging to an organisation (used by demo reset). */
export async function clearOrganizationData(organizationId: string) {
  const tables = [
    "notifications",
    "audit_logs",
    "integration_credentials_metadata",
    "activity_events",
    "approval_requests",
    "agent_logs",
    "agent_runs",
    "agent_tasks",
    "revenue_events",
    "upsell_opportunities",
    "support_tickets",
    "website_builds",
    "deployments",
    "qa_runs",
    "project_requirements",
    "projects",
    "onboarding_submissions",
    "client_contacts",
    "clients",
    "proposal_items",
    "proposals",
    "messages",
    "conversations",
    "outreach_messages",
    "campaigns",
    "demo_sites",
    "strategies",
    "opportunities",
    "lead_scores",
    "website_audits",
    "research_reports",
    "business_contacts",
    "leads",
    "businesses",
    "services",
    "pricing_rules",
  ] as const;
  for (const table of tables) {
    const rows = await db.find(table, { organizationId });
    for (const row of rows) await db.delete(table, row.id);
  }
}

export function generatedSiteRoot() {
  const root = process.env.NEXORA_SITE_ROOT ?? join(process.cwd(), "public", "generated");
  mkdirSync(root, { recursive: true });
  return root;
}

export { THEMES };
