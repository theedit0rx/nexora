import { tenantById } from "../db/tenant";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db, newId, slugify } from "../db";
import { nowIso, type DemoSite, type Deployment, type QaRun, type WebsiteStrategy } from "../db/schema";
import { bus, logActivity, notify } from "../events/bus";
import { runTask, markAgentWorking, markAgentIdle } from "../tasks/engine";
import { isAgentAvailable } from "./registry";
import { getDeploymentProvider } from "../providers/messaging";
import { composeSiteContent, defaultPagePlan, pickTheme, THEMES } from "../sites";
import { generateSiteFiles, writeSite } from "../sites/generator";
import type { GeneratedFile } from "../sites/generator";
import { runQa } from "../qa/engine";

/* ==========================================================================
   NEXORA — Strategist / Builder / QA / Deployer agents
   ========================================================================== */

const TEMPLATE_FAMILIES = [
  { key: "restaurant", match: /restaurant|cafe|food|bakery|dining|bistro|kitchen/, serviceKey: "restaurant-website" },
  { key: "cafe", match: /cafe|coffee|bakery|dessert/, serviceKey: "restaurant-website" },
  { key: "school", match: /school/, serviceKey: "institute-website" },
  { key: "coaching-institute", match: /coaching|academy|tuition/, serviceKey: "institute-website" },
  { key: "training-institute", match: /training|institute|certification/, serviceKey: "institute-website" },
  { key: "doctor-clinic", match: /dental|clinic|doctor|hospital|medical|physio/, serviceKey: "business-website" },
  { key: "gym", match: /gym|fitness|crossfit|yoga/, serviceKey: "business-website" },
  { key: "salon", match: /salon|spa|beauty|parlour|makeup/, serviceKey: "business-website" },
  { key: "retail-store", match: /retail|store|shop|grocery|electronics/, serviceKey: "ecommerce" },
  { key: "fashion", match: /fashion|boutique|apparel|clothing/, serviceKey: "ecommerce" },
  { key: "construction", match: /construction|builder|contractor|civil/, serviceKey: "business-website" },
  { key: "real-estate", match: /real estate|property|realtor|broker/, serviceKey: "business-website" },
  { key: "interior", match: /interior|architect|decor/, serviceKey: "business-website" },
  { key: "travel", match: /travel|tour|tourist/, serviceKey: "business-website" },
  { key: "hotel", match: /hotel|resort|guest house|homestay|lodge/, serviceKey: "business-website" },
  { key: "professional-services", match: /consult|law|ca |account|finance|advisor/, serviceKey: "business-website" },
  { key: "agency", match: /agency|marketing|media|advertis/, serviceKey: "landing-page" },
  { key: "portfolio", match: /portfolio|photograph|artist|designer/, serviceKey: "landing-page" },
];

export function templateFamilyFor(category: string) {
  const c = category.toLowerCase();
  for (const f of TEMPLATE_FAMILIES) if (f.match.test(c)) return f;
  return { key: "local-business", match: /.*/, serviceKey: "business-website" };
}

export function allTemplateFamilies() {
  return [
    ...TEMPLATE_FAMILIES.map((f) => f.key),
    "local-business",
  ];
}

/* ------------------------------------------------------------ strategist -- */

export async function strategistPlan(
  organizationId: string,
  leadId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "strategist"))) {
    return { ok: false as const, error: "Strategist agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "strategist", trigger },
    "strategy.generate",
    async (task) => {
      const lead = await tenantById(organizationId, "leads", leadId);
      if (!lead) throw new Error(`Lead ${leadId} not found`);
      const business = await tenantById(organizationId, "businesses", lead.businessId);
      if (!business) throw new Error(`Business for lead ${leadId} not found`);
      const audit = (await db.find("website_audits", { leadId })).at(-1) ?? null;
      const report = (await db.find("research_reports", { leadId })).at(-1) ?? null;

      await markAgentWorking(organizationId, "strategist", task.id, `Planning site for ${business.name}`);

      const family = templateFamilyFor(business.category);
      const theme = pickTheme(business.category, "light");
      const plan = defaultPagePlan(business.category);
      const services = report?.services?.length ? report.services : [];
      const content = composeSiteContent({
        name: business.name,
        category: business.category,
        subcategory: business.subcategory,
        city: business.city,
        address: business.address,
        phone: business.phone,
        email: business.email,
        website: business.website,
        rating: business.rating,
        reviewCount: business.reviewCount ?? 0,
        socialLinks: business.socialLinks,
        mapsUrl: business.mapsUrl,
        services,
      });

      const sections = Object.entries(plan).flatMap(([page, components]) =>
        components
          .filter((c) => c !== "navbar" && c !== "footer")
          .map((component, i) => ({
            id: newId("sec"),
            component,
            heading: content.services[i] ?? component,
            purpose: sectionPurpose(component, business.category),
            content: {} as Record<string, unknown>,
          })),
      );

      const strategy: WebsiteStrategy = {
        id: newId("str"),
        organizationId,
        leadId,
        templateFamily: family.key,
        serviceKey: family.serviceKey,
        pages: Object.keys(plan).map((p) => (p === "index" ? "Home" : p.charAt(0).toUpperCase() + p.slice(1))),
        sections,
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
        copyDirection: `${theme.mood} tone; lead with the outcome for the customer, then proof, then a single clear action.`,
        conversionGoals: buildConversionGoals(business.category, audit),
        mustHaveFeatures: buildMustHaves(business.category, audit),
        seoKeywords: content.keywords.slice(0, 8),
        rationale: `${business.name} is a ${business.category.toLowerCase()} business${
          business.city ? ` in ${business.city}` : ""
        }. The ${family.key} template family fits because ${
          audit?.conversionOpportunities.length
            ? `the audit found: ${audit.conversionOpportunities.slice(0, 3).join(", ")}.`
            : "it matches the service mix the business advertises."
        } Theme "${theme.palette}" was selected for ${theme.mood}.`,
        provider: "local",
        createdAt: nowIso(),
      };

      await db.insert("strategies", strategy);
      await db.update("leads", leadId, { status: "STRATEGY", updatedAt: nowIso() });

      await logActivity({
        organizationId,
        agentKey: "strategist",
        actionType: "strategy.generated",
        title: `Strategist proposed a ${family.key} website for ${business.name}`,
        detail: strategy.rationale,
        entityType: "lead",
        entityId: leadId,
        leadId,
        status: "OK",
      });
      await bus.emit("strategy.generated", { organizationId, leadId, strategyId: strategy.id });
      await markAgentIdle(organizationId, "strategist");

      return { strategyId: strategy.id, templateFamily: family.key, pages: strategy.pages };
    },
    { entityType: "lead", entityId: leadId, input: { leadId } },
  );
}

function sectionPurpose(component: string, category: string) {
  const purposes: Record<string, string> = {
    hero: "State the outcome and the primary action in one screen",
    services: "Make the offering scannable",
    features: "Differentiate from competitors",
    stats: "Provide proof without fabricating numbers",
    testimonials: "Social proof",
    gallery: "Show the physical business or past work",
    pricing: "Make cost transparent",
    team: "Put faces behind the service",
    timeline: "Reduce uncertainty about process",
    faq: "Remove objections before the call",
    map: "Make the location obvious",
    contact: "Capture the enquiry",
    whatsappCta: "Meet customers on the channel they already use",
    booking: "Let customers self-serve appointments",
    products: "Present the catalogue",
    courses: "Present programmes and fees",
    menu: "Present the food menu",
    admissions: "Capture admission enquiries",
    reviews: "Aggregate public proof",
    portfolio: "Show selected work",
    cta: "Close with a single action",
  };
  return purposes[component] ?? `Support the ${category.toLowerCase()} conversion path`;
}

function buildConversionGoals(category: string, audit: { conversionOpportunities: string[] } | null) {
  const goals = ["WhatsApp enquiry", "Phone call"];
  const c = category.toLowerCase();
  if (/restaurant|cafe/.test(c)) goals.push("Table reservation", "Delivery order");
  if (/coaching|school|institute/.test(c)) goals.push("Admission enquiry", "Demo class booking");
  if (/clinic|dental|salon|spa|gym/.test(c)) goals.push("Appointment booking");
  if (/retail|store|shop/.test(c)) goals.push("Product enquiry");
  if (audit?.conversionOpportunities.length) goals.push(audit.conversionOpportunities[0]!);
  return Array.from(new Set(goals)).slice(0, 5);
}

function buildMustHaves(category: string, audit: { reachable: boolean; conversionOpportunities: string[] } | null) {
  const c = category.toLowerCase();
  const must: string[] = ["Mobile-first layout", "WhatsApp click-to-chat", "Enquiry form", "SEO metadata"];
  if (/restaurant|cafe/.test(c)) must.push("Digital menu", "Reservations", "Gallery");
  if (/coaching|school|institute/.test(c)) must.push("Course pages", "Admission form", "Faculty", "Results");
  if (/clinic|dental|salon|spa|gym/.test(c)) must.push("Appointment booking", "Trust signals");
  if (/retail|store|shop/.test(c)) must.push("Catalogue", "WhatsApp ordering");
  if (audit && !audit.reachable) must.push("Reliable hosting");
  return Array.from(new Set(must));
}

/* --------------------------------------------------------------- builder -- */

const SITE_ROOT = () => process.env.NEXORA_SITE_ROOT ?? join(process.cwd(), "public", "generated");

export async function builderBuildDemo(
  organizationId: string,
  leadId: string,
  opts: { strategyId?: string; retry?: boolean } = {},
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "builder"))) {
    return { ok: false as const, error: "Demo Builder agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "builder", trigger },
    "demo.build",
    async (task) => {
      const lead = await tenantById(organizationId, "leads", leadId);
      if (!lead) throw new Error(`Lead ${leadId} not found`);
      const business = await tenantById(organizationId, "businesses", lead.businessId);
      if (!business) throw new Error(`Business for lead ${leadId} not found`);

      const strategies = await db.find("strategies", { leadId });
      const strategy =
        (opts.strategyId ? strategies.find((s) => s.id === opts.strategyId) : null) ?? strategies.at(-1) ?? null;
      if (!strategy) throw new Error("No website strategy exists for this lead — run the Strategist first");

      await markAgentWorking(organizationId, "builder", task.id, `Generating demo for ${business.name}`);

      const themeKey = strategy.theme.palette;
      const theme = THEMES[themeKey] ?? pickTheme(business.category, "light");
      const plan = defaultPagePlan(business.category);
      const content = composeSiteContent({
        name: business.name,
        category: business.category,
        subcategory: business.subcategory,
        city: business.city,
        address: business.address,
        phone: business.phone,
        email: business.email,
        website: business.website,
        rating: business.rating,
        reviewCount: business.reviewCount ?? 0,
        socialLinks: business.socialLinks,
        mapsUrl: business.mapsUrl,
      });

      const slug = `${organizationId}-${leadId}-${slugify(business.name).slice(0, 35)}`;
      const result = writeSite({
        slug,
        business: content,
        theme,
        pagePlan: plan,
        demo: true,
        outputRoot: SITE_ROOT(),
      });

      const existing = await db.findOne("demo_sites", { organizationId, slug });
      const demoSite: DemoSite = {
        id: existing?.id ?? newId("dem"),
        organizationId,
        leadId,
        strategyId: strategy.id,
        slug,
        businessName: business.name,
        templateFamily: strategy.templateFamily,
        serviceKey: strategy.serviceKey,
        status: "GENERATED",
        pages: result.pages,
        outputDir: result.outputDir,
        previewUrl: `/generated/${slug}/index.html`,
        theme: { ...strategy.theme },
        fileCount: result.files.length,
        totalBytes: result.totalBytes,
        generatedBy: "builder",
        error: null,
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      if (existing) await db.update("demo_sites", existing.id, demoSite);
      else await db.insert("demo_sites", demoSite);

      await db.update("leads", leadId, { status: "DEMO_READY", pipelineStage: "Demo Ready", updatedAt: nowIso() });

      await logActivity({
        organizationId,
        agentKey: "builder",
        actionType: "demo.completed",
        title: `Builder generated a ${strategy.templateFamily} demo for ${business.name}`,
        detail: `${result.files.length} files, ${result.pages.length} pages, ${(result.totalBytes / 1024).toFixed(1)} KB`,
        entityType: "lead",
        entityId: leadId,
        leadId,
        status: "OK",
        meta: { slug, pages: result.pages },
      });
      await bus.emit("demo.completed", { organizationId, leadId, demoId: demoSite.id, slug });
      await markAgentIdle(organizationId, "builder");

      return {
        demoId: demoSite.id,
        slug,
        pages: result.pages,
        files: result.files.length,
        bytes: result.totalBytes,
      };
    },
    { entityType: "lead", entityId: leadId, input: { leadId, strategyId: opts.strategyId }, priority: "HIGH" },
  );
}

/* ------------------------------------------------------------------- qa --- */

export async function qaRun(
  organizationId: string,
  targetType: "DEMO" | "BUILD",
  targetId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "qa"))) {
    return { ok: false as const, error: "QA agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "qa", trigger },
    "qa.inspect",
    async (task) => {
      let files: GeneratedFile[] = [];
      let label = targetId;
      let entityLeadId: string | undefined;

      if (targetType === "DEMO") {
        const demo = await tenantById(organizationId, "demo_sites", targetId);
        if (!demo) throw new Error(`Demo site ${targetId} not found`);
        label = demo.businessName;
        entityLeadId = demo.leadId;
        files = readDirFiles(demo.outputDir);
      } else {
        const build = await tenantById(organizationId, "website_builds", targetId);
        if (!build) throw new Error(`Build ${targetId} not found`);
        label = build.id;
        files = readDirFiles(build.outputDir);
      }

      await markAgentWorking(organizationId, "qa", task.id, `Inspecting ${label}`);
      const run = runQa({ organizationId, targetType, targetId, label, files });
      await db.insert("qa_runs", run);

      if (run.verdict === "FAIL") {
        if (targetType === "DEMO") await db.update("demo_sites", targetId, { status: "QA_FAILED", error: run.issues[0] ?? "QA failed" });
        else await db.update("website_builds", targetId, { status: "QA_FAILED", error: run.issues[0] ?? "QA failed" });
        await logActivity({
          organizationId,
          agentKey: "qa",
          actionType: "qa.failed",
          title: `QA detected ${run.failedCount} blocking issue(s) on ${label}`,
          detail: run.issues.slice(0, 3).join(" | "),
          entityType: targetType === "DEMO" ? "demo" : "build",
          entityId: targetId,
          leadId: entityLeadId ?? null,
          riskLevel: "MEDIUM",
          status: "ERROR",
        });
        await notify({
          organizationId,
          type: "qa_failed",
          title: `QA failed for ${label}`,
          body: run.issues.slice(0, 2).join(" | "),
          entityType: targetType === "DEMO" ? "demo" : "build",
          entityId: targetId,
          severity: "WARNING",
        });
        await bus.emit("qa.failed", { organizationId, targetType, targetId, issues: run.issues });
      } else {
        await logActivity({
          organizationId,
          agentKey: "qa",
          actionType: run.verdict === "PASS" ? "qa.passed" : "qa.passed_with_warnings",
          title: `QA ${run.verdict === "PASS" ? "PASS" : "PASS with warnings"} for ${label} (${run.score}/100)`,
          detail: `${run.passedCount} checks passed, ${run.warningCount} warnings`,
          entityType: targetType === "DEMO" ? "demo" : "build",
          entityId: targetId,
          leadId: entityLeadId ?? null,
          status: run.verdict === "PASS" ? "OK" : "WARN",
        });
        await bus.emit("qa.passed", { organizationId, targetType, targetId, score: run.score, verdict: run.verdict });
      }

      await markAgentIdle(organizationId, "qa");
      return {
        qaRunId: run.id,
        verdict: run.verdict,
        score: run.score,
        failed: run.failedCount,
        warnings: run.warningCount,
        issues: run.issues,
      };
    },
    { entityType: targetType === "DEMO" ? "demo" : "build", entityId: targetId, input: { targetType, targetId } },
  );
}

/* -------------------------------------------------------------- deployer -- */

export async function deployerDeploy(
  organizationId: string,
  targetType: "DEMO" | "BUILD",
  targetId: string,
  kind: "PREVIEW" | "PRODUCTION" = "PREVIEW",
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "deployer"))) {
    return { ok: false as const, error: "Deployer agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "deployer", trigger },
    `deploy.${kind.toLowerCase()}`,
    async (task) => {
      let outputDir = "";
      let name = targetId;
      let projectId: string | null = null;

      if (targetType === "DEMO") {
        const demo = await tenantById(organizationId, "demo_sites", targetId);
        if (!demo) throw new Error(`Demo site ${targetId} not found`);
        outputDir = demo.outputDir;
        name = demo.slug;
      } else {
        const build = await tenantById(organizationId, "website_builds", targetId);
        if (!build) throw new Error(`Build ${targetId} not found`);
        outputDir = build.outputDir;
        name = build.id;
        projectId = build.projectId;
      }

      await markAgentWorking(organizationId, "deployer", task.id, `Deploying ${name}`);
      const provider = getDeploymentProvider(kind);
      const files = readDirFiles(outputDir);
      const res = await provider.deploy({ name, kind, files });

      const deployment: Deployment = {
        id: newId("dep"),
        organizationId,
        targetType,
        targetId,
        projectId,
        kind,
        state: !res.ok ? "ERROR" : res.state === "READY" ? "READY" : res.state === "BUILDING" ? "BUILDING" : "QUEUED",
        url: res.url ?? "",
        provider: provider.key,
        providerRef: res.ref ?? "",
        branch: kind === "PRODUCTION" ? "main" : "preview",
        commitSha: "",
        buildLog: res.error ?? (res.ok ? `Deployed via ${provider.label}` : ""),
        healthCheck: res.ok ? "UNKNOWN" : "DOWN",
        customDomain: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await db.insert("deployments", deployment);

      if (targetType === "DEMO") {
        await db.update("demo_sites", targetId, { status: res.ok && res.state === "READY" ? "DEPLOYED" : res.ok ? "GENERATED" : "FAILED" });
      }
      if (projectId && res.ok && res.state === "READY") {
        await db.update("projects", projectId, {
          ...(kind === "PRODUCTION" ? { productionUrl: deployment.url } : { previewUrl: deployment.url }),
          updatedAt: nowIso(),
        });
      }

      await logActivity({
        organizationId,
        agentKey: "deployer",
        actionType: res.ok ? (res.state === "READY" ? "deployment.completed" : "deployment.queued") : "deployment.failed",
        title: res.ok
          ? `${kind === "PRODUCTION" ? "Production" : "Preview"} deployment ${res.state === "READY" ? "completed" : "queued"} for ${name}`
          : `Deployment failed for ${name}`,
        detail: res.error ?? deployment.url,
        entityType: "deployment",
        entityId: deployment.id,
        projectId,
        status: res.ok ? "OK" : "ERROR",
        riskLevel: kind === "PRODUCTION" ? "HIGH" : "LOW",
      });
      if (!res.ok) {
        await notify({
          organizationId,
          type: "deployment_failed",
          title: `Deployment failed for ${name}`,
          body: res.error ?? "",
          entityType: "deployment",
          entityId: deployment.id,
          severity: "DANGER",
        });
        await bus.emit("deployment.failed", { organizationId, targetType, targetId, error: res.error });
      } else if (res.state === "READY") {
        await bus.emit("deployment.completed", { organizationId, targetType, targetId, url: deployment.url });
      }
      await markAgentIdle(organizationId, "deployer");

      return { deploymentId: deployment.id, url: deployment.url, provider: provider.key, state: deployment.state };
    },
    {
      entityType: targetType === "DEMO" ? "demo" : "build",
      entityId: targetId,
      input: { targetType, targetId, kind },
      riskLevel: kind === "PRODUCTION" ? "HIGH" : "LOW",
    },
  );
}

/* --------------------------------------------------------------- helpers -- */

export function readDirFiles(dir: string): GeneratedFile[] {
  if (!dir || !existsSync(dir)) return [];
  const out: GeneratedFile[] = [];
  const walk = (current: string, prefix: string) => {
    let entries;
    try {
      entries = require("node:fs").readdirSync(current, { withFileTypes: true }) as Array<{
        name: string;
        isDirectory(): boolean;
      }>;
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else {
        try {
          out.push({ path: `${prefix}${entry.name}`, content: readFileSync(full, "utf-8") });
        } catch {
          /* binary assets are skipped for QA purposes */
        }
      }
    }
  };
  walk(dir, "");
  return out;
}

export function ensureSiteRoot() {
  const root = SITE_ROOT();
  mkdirSync(root, { recursive: true });
  return root;
}

export { generateSiteFiles };
