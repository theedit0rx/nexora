import { fetchPublicPage } from "../security/public-web";
import { tenantById } from "../db/tenant";
import { db, newId } from "../db";
import { nowIso, type Lead, type ResearchReport, type WebsiteAudit } from "../db/schema";
import { bus, logActivity } from "../events/bus";
import { runTask, markAgentWorking, markAgentIdle } from "../tasks/engine";
import { isAgentAvailable } from "./registry";
import { categoryProfile } from "../sites/content";

/* ==========================================================================
   NEXORA — Researcher Agent
   Builds a structured Business Intelligence profile from public signals.
   ========================================================================== */

export async function researcherAnalyze(
  organizationId: string,
  leadId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "researcher"))) {
    return { ok: false as const, error: "Researcher agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "researcher", trigger },
    "research.business",
    async (task) => {
      const lead = await tenantById(organizationId, "leads", leadId);
      if (!lead) throw new Error(`Lead ${leadId} not found`);
      const business = await tenantById(organizationId, "businesses", lead.businessId);
      if (!business) throw new Error(`Business for lead ${leadId} not found`);

      await markAgentWorking(organizationId, "researcher", task.id, `Researching ${business.name}`);
      const profile = categoryProfile(business.category);

      // Fetch the site (if any) so online-presence claims are evidence-based.
      const site = await fetchSite(business.website);

      const services = inferServices(profile.services);
      const onlinePresence = buildOnlinePresence(
        {
          website: business.website,
          socialLinks: business.socialLinks,
          mapsUrl: business.mapsUrl,
          rating: business.rating,
          reviewCount: business.reviewCount ?? 0,
        },
        site,
      );
      const contactChannels = buildContactChannels(business);
      const opportunities = buildOpportunities({ category: business.category, website: business.website, socialLinks: business.socialLinks }, site);

      const report: ResearchReport = {
        id: newId("res"),
        organizationId,
        leadId,
        businessId: business.id,
        summary: `${business.name} is a ${business.category.toLowerCase()} business in ${
          business.city || "the local area"
        }. ${
          site.reachable
            ? "Their current website is reachable."
            : business.website
              ? "Their listed website could not be reached during research."
              : "No website was found on their public profile."
        } They list ${services.slice(0, 3).join(", ")} as core offerings.`,
        services,
        targetCustomer: profileTargetCustomer(business.category),
        onlinePresence,
        contactChannels,
        socialActivity:
          Object.keys(business.socialLinks).length > 0
            ? `Active on ${Object.keys(business.socialLinks).join(", ")}.`
            : "No public social profiles were found on the business listing.",
        existingWebsite: business.website ?? "",
        businessMaturity: inferMaturity(business.reviewCount ?? 0),
        digitalOpportunities: opportunities,
        differentiators: profile.usp.slice(0, 3),
        risks: buildRisks(business, site),
        confidence: site.reachable ? 0.75 : 0.55,
        provider: "local",
        model: "local-deterministic",
        createdAt: nowIso(),
      };

      await db.insert("research_reports", report);
      await db.update("leads", leadId, {
        status: "RESEARCHING",
        updatedAt: nowIso(),
      });

      await logActivity({
        organizationId,
        agentKey: "researcher",
        actionType: "lead.research.completed",
        title: `Researcher completed analysis of ${business.name}`,
        detail: report.summary,
        entityType: "lead",
        entityId: leadId,
        leadId,
        status: "OK",
      });
      await bus.emit("lead.research.completed", { organizationId, leadId, businessId: business.id });
      await markAgentIdle(organizationId, "researcher");

      return { reportId: report.id, summary: report.summary };
    },
    { entityType: "lead", entityId: leadId, input: { leadId } },
  );
}

/* ------------------------------------------------------------- auditor --- */

export interface FetchedSite {
  reachable: boolean;
  statusCode: number | null;
  https: boolean;
  html: string;
  loadTimeMs: number;
  finalUrl: string;
  error?: string;
}

export async function fetchSite(url: string | null | undefined, timeoutMs = 8000): Promise<FetchedSite> {
  const empty: FetchedSite = {
    reachable: false,
    statusCode: null,
    https: false,
    html: "",
    loadTimeMs: 0,
    finalUrl: "",
  };
  if (!url) return empty;
  const target = url.startsWith("http") ? url : `https://${url}`;
  const started = Date.now();
  try {
    const res = await fetchPublicPage(target, { timeoutMs });
    const html = res.html;
    return {
      reachable: res.ok,
      statusCode: res.status,
      https: res.url.startsWith("https://"),
      html: html.slice(0, 400_000),
      loadTimeMs: Date.now() - started,
      finalUrl: res.url,
    };
  } catch (err) {
    return {
      ...empty,
      loadTimeMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function auditorAudit(
  organizationId: string,
  leadId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "auditor"))) {
    return { ok: false as const, error: "Auditor agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "auditor", trigger },
    "audit.website",
    async (task) => {
      const lead = await tenantById(organizationId, "leads", leadId);
      if (!lead) throw new Error(`Lead ${leadId} not found`);
      const business = await tenantById(organizationId, "businesses", lead.businessId);
      if (!business) throw new Error(`Business for lead ${leadId} not found`);

      await markAgentWorking(organizationId, "auditor", task.id, `Auditing ${business.website ?? "no website"}`);
      const site = await fetchSite(business.website);

      const audit = await analyzeWebsite(
        { organizationId, leadId, name: business.name, website: business.website, category: business.category },
        site,
      );
      void business;

      await db.insert("website_audits", audit);
      await db.update("leads", leadId, {
        status: "AUDITED",
        websiteStatus: audit.hasWebsite ? (audit.overallGrade === "A" || audit.overallGrade === "B" ? "MODERN" : audit.designEra === "LEGACY" || audit.designEra === "DATED" ? "OUTDATED" : "AVERAGE") : "NONE",
        updatedAt: nowIso(),
      });

      await logActivity({
        organizationId,
        agentKey: "auditor",
        actionType: "lead.audit.completed",
        title: `Auditor completed ${business.name} website analysis`,
        detail: audit.hasWebsite
          ? `${audit.findings.length} findings, overall grade ${audit.overallGrade}`
          : "No website found on the public listing",
        entityType: "lead",
        entityId: leadId,
        leadId,
        status: audit.findings.some((f) => f.severity === "CRITICAL") ? "WARN" : "OK",
      });
      await bus.emit("lead.audit.completed", { organizationId, leadId, auditId: audit.id });
      await markAgentIdle(organizationId, "auditor");

      return { auditId: audit.id, grade: audit.overallGrade, findings: audit.findings.length };
    },
    { entityType: "lead", entityId: leadId, input: { leadId } },
  );
}

async function analyzeWebsite(
  ctx: { organizationId: string; leadId: string; name: string; website: string | null; category: string },
  site: FetchedSite,
): Promise<WebsiteAudit> {
  const findings: WebsiteAudit["findings"] = [];
  const add = (
    code: string,
    label: string,
    severity: WebsiteAudit["findings"][number]["severity"],
    detail: string,
    evidence: string,
    recommendation: string,
  ) => findings.push({ id: newId("fnd"), code, label, severity, detail, evidence, recommendation });

  const { organizationId, leadId } = ctx;
  const business = ctx;
  const hasWebsite = Boolean(business.website);
  const html = site.html;
  const lower = html.toLowerCase();

  // HTTPS
  const https = site.finalUrl.startsWith("https://") || (!site.reachable && Boolean(business.website?.startsWith("https://")));
  if (hasWebsite && !https) {
    add(
      "https",
      "No HTTPS",
      "CRITICAL",
      "The site is not served over HTTPS.",
      site.finalUrl || business.website || "",
      "Move to HTTPS — browsers label the site 'Not Secure' and it hurts search ranking.",
    );
  }

  // Viewport / responsiveness
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasMediaQueries = /@media[^{]*\(max-width/.test(html);
  const mobileResponsive: WebsiteAudit["mobileResponsive"] = !site.reachable
    ? "UNKNOWN"
    : hasViewport && hasMediaQueries
      ? "YES"
      : hasViewport
        ? "PARTIAL"
        : "NO";
  if (hasWebsite && site.reachable && mobileResponsive !== "YES") {
    add(
      "mobile",
      "Mobile responsiveness",
      "CRITICAL",
      `No responsive viewport declaration${hasViewport ? " but media queries are missing" : ""}.`,
      "meta viewport / @media rules",
      "Most local traffic is mobile — the site must adapt to phone widths.",
    );
  }

  // Navigation
  const navLinks = (html.match(/<nav\b/gi) ?? []).length;
  const anchorCount = (html.match(/<a\b/gi) ?? []).length;
  const navigationScore = !site.reachable ? 0 : Math.min(100, 30 + navLinks * 25 + Math.min(40, anchorCount * 2));
  if (site.reachable && navLinks === 0) {
    add(
      "nav",
      "No navigation element",
      "HIGH",
      "The page has no <nav> landmark, so visitors cannot move between sections.",
      "0 <nav> elements",
      "Add a clear, persistent navigation bar with the pages that matter.",
    );
  }

  // Visual hierarchy
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const headingCount = (html.match(/<h[1-6]\b/gi) ?? []).length;
  const visualHierarchyScore = !site.reachable ? 0 : Math.min(100, (h1Count === 1 ? 45 : 15) + Math.min(55, headingCount * 6));
  if (site.reachable && h1Count !== 1) {
    add(
      "hierarchy",
      "Heading hierarchy",
      "MEDIUM",
      `Found ${h1Count} <h1> element(s) and ${headingCount} headings total.`,
      `${h1Count} × <h1>, ${headingCount} headings`,
      "Use exactly one H1 that states the offer, then H2/H3 for structure.",
    );
  }

  // Outdated design signals
  const legacyMarkers = [
    /table[^>]+(?:width|cellpadding)/i,
    /<font\b/i,
    /bgcolor=/i,
    /<center>/i,
    /marquee/i,
    /document\.write/i,
    /jquery-?1\./i,
    /bootstrap[^"']*3\./i,
  ];
  const legacyHits = legacyMarkers.filter((re) => re.test(html)).map((re) => re.source);
  const tableLayout = /<table\b/i.test(html) && !/<table[^>]*role=["']table["']/i.test(html);
  const designEra: WebsiteAudit["designEra"] = !site.reachable
    ? "UNKNOWN"
    : legacyHits.length > 0 || tableLayout
      ? "LEGACY"
      : hasMediaQueries && /css variables|:root\s*{/.test(lower)
        ? "MODERN"
        : hasMediaQueries
          ? "CURRENT"
          : "DATED";
  if (site.reachable && designEra === "LEGACY") {
    add(
      "legacy",
      "Outdated markup",
      "HIGH",
      `The page relies on legacy layout techniques (${legacyHits.slice(0, 3).join(", ")}).`,
      legacyHits.slice(0, 3).join(", ") || "table-based layout",
      "Rebuild with modern semantic HTML and CSS — legacy markup breaks on phones and is hard to maintain.",
    );
  }

  // Broken pages
  const brokenPages: string[] = [];
  if (site.reachable) {
    const hrefs = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi))
      .map((m) => m[1]!)
      .filter((h) => h && !h.startsWith("#") && !h.startsWith("mailto:") && !h.startsWith("tel:") && !/^https?:/i.test(h));
    const seen = new Set<string>();
    for (const href of hrefs.slice(0, 12)) {
      if (seen.has(href)) continue;
      seen.add(href);
      try {
        const abs = new URL(href, site.finalUrl);
        if (abs.origin !== new URL(site.finalUrl).origin) continue;
        const res = await fetchPublicPage(abs.toString(), { method: "HEAD", timeoutMs: 5000 });
        if (res.status >= 400) brokenPages.push(`${href} (${res.status})`);
      } catch {
        /* network-restricted environments: do not claim a page is broken */
      }
    }
  }
  if (brokenPages.length > 0) {
    add(
      "broken-pages",
      "Broken internal pages",
      "HIGH",
      `${brokenPages.length} internal link(s) return an error.`,
      brokenPages.join(", "),
      "Fix or remove dead links — they waste the traffic you already have.",
    );
  }

  // Conversion elements
  const hasContactCta = /contact|enquir|enquir|call now|book|get in touch/i.test(lower) && anchorCount > 2;
  const hasWhatsapp = /wa\.me|whatsapp|api\.whatsapp/i.test(lower);
  const hasForms = /<form\b/i.test(html);
  const hasBooking = /book(ing)?|appointment|reservation|slot/i.test(lower);
  const hasEcommerce = /cart|checkout|add to (cart|bag)|shop now|buy now|woocommerce|shopify/i.test(lower);

  if (site.reachable && !hasContactCta) {
    add(
      "cta",
      "No clear contact call-to-action",
      "CRITICAL",
      "Visitors are not told what to do next.",
      "no contact/enquiry CTA detected",
      "Put a single, obvious action above the fold — call, WhatsApp or enquiry form.",
    );
  }
  if (site.reachable && !hasWhatsapp) {
    add(
      "whatsapp",
      "No WhatsApp integration",
      "MEDIUM",
      "The site does not offer WhatsApp contact.",
      "no wa.me link found",
      "WhatsApp is the fastest way for local customers to reach you — add a floating button.",
    );
  }
  if (site.reachable && !hasForms) {
    add(
      "forms",
      "No enquiry form",
      "HIGH",
      "There is no way to capture an enquiry from a visitor who will not call.",
      "no <form> element",
      "Add a short enquiry form with name, phone and message.",
    );
  }
  if (site.reachable && !hasBooking && /clinic|salon|gym|restaurant|doctor|spa|dental|studio/i.test(business.category)) {
    add(
      "booking",
      "No booking flow",
      "HIGH",
      "The business type normally takes appointments but the site has no booking path.",
      "no booking/appointment flow",
      "Add a simple appointment request form with date and time slots.",
    );
  }
  if (site.reachable && !hasEcommerce && /retail|store|shop|boutique|fashion|grocery/i.test(business.category)) {
    add(
      "ecommerce",
      "No online ordering",
      "MEDIUM",
      "A retail business with no way to order online.",
      "no cart/checkout detected",
      "Even a WhatsApp ordering flow captures sales outside opening hours.",
    );
  }

  // Performance heuristics
  const htmlBytes = Buffer.byteLength(html, "utf-8");
  const inlineScripts = (html.match(/<script\b(?![^>]*\ssrc=)/gi) ?? []).length;
  const inlineStyles = (html.match(/style=["']/gi) ?? []).length;
  const externalScripts = (html.match(/<script\b[^>]*\ssrc=["']https?:/gi) ?? []).length;
  let performanceScore = 100;
  if (htmlBytes > 400_000) performanceScore -= 30;
  if (htmlBytes > 1_000_000) performanceScore -= 25;
  performanceScore -= Math.min(25, inlineScripts * 5);
  performanceScore -= Math.min(20, inlineStyles * 2);
  performanceScore -= Math.min(20, externalScripts * 6);
  if (site.loadTimeMs > 3000) performanceScore -= 15;
  performanceScore = Math.max(5, performanceScore);
  if (performanceScore < 55) {
    add(
      "performance",
      "Performance concerns",
      "MEDIUM",
      `Estimated performance score ${performanceScore}/100 (${(htmlBytes / 1024).toFixed(0)} KB HTML, ${inlineScripts} inline scripts, ${externalScripts} external scripts, ${site.loadTimeMs}ms response).`,
      `html ${htmlBytes}B, scripts ${inlineScripts + externalScripts}`,
      "Reduce page weight and third-party scripts — slow sites lose mobile visitors before they read anything.",
    );
  }

  // SEO basics
  const hasTitle = /<title>[^<]{5,}<\/title>/i.test(html);
  const hasMetaDesc = /<meta[^>]+name=["']description["']/i.test(html);
  const hasH1 = h1Count === 1;
  const hasCanonical = /rel=["']canonical["']/i.test(html);
  const hasOg = /property=["']og:title["']/i.test(html);
  const seoScore = !site.reachable
    ? 0
    : (hasTitle ? 25 : 0) + (hasMetaDesc ? 25 : 0) + (hasH1 ? 20 : 0) + (hasCanonical ? 15 : 0) + (hasOg ? 15 : 0);
  const missingSeo = [!hasTitle && "title", !hasMetaDesc && "meta description", !hasH1 && "single H1", !hasCanonical && "canonical URL", !hasOg && "Open Graph tags"].filter(Boolean) as string[];
  if (site.reachable && missingSeo.length > 0) {
    add(
      "seo",
      "SEO basics",
      "MEDIUM",
      `Missing: ${missingSeo.join(", ")}.`,
      `SEO score ${seoScore}/100`,
      "These tags are what search engines and link previews read — cheap wins with real impact.",
    );
  }

  // Accessibility basics
  const imgs = (html.match(/<img\b/gi) ?? []).length;
  const alts = (html.match(/<img\b[^>]*\balt=/gi) ?? []).length;
  const inputs = (html.match(/<(?:input|select|textarea)\b/gi) ?? []).length;
  const labels = (html.match(/<label\b[^>]*\bfor=/gi) ?? []).length;
  const hasLang = /<html[^>]+lang=/i.test(html);
  let a11y = 0;
  if (site.reachable) {
    a11y = (imgs === 0 || alts >= imgs ? 30 : 10) + (inputs === 0 || labels >= inputs ? 30 : 10) + (hasLang ? 20 : 0) + (navLinks > 0 ? 20 : 0);
  }
  if (site.reachable && (alts < imgs || (inputs > 0 && labels < inputs) || !hasLang)) {
    add(
      "a11y",
      "Accessibility basics",
      "MEDIUM",
      `${alts}/${imgs} images have alt text, ${labels}/${inputs} form fields are labelled, lang attribute ${hasLang ? "present" : "missing"}.`,
      `a11y score ${a11y}/100`,
      "Accessible sites convert better and reach more customers, including screen-reader users.",
    );
  }

  // Metadata
  const hasMetadata = hasTitle && hasMetaDesc && hasOg;
  if (site.reachable && !hasMetadata) {
    add(
      "metadata",
      "Incomplete metadata",
      "MEDIUM",
      "Title, description or social preview tags are incomplete.",
      `title ${hasTitle}, description ${hasMetaDesc}, og ${hasOg}`,
      "Complete metadata improves click-through from search and shared links.",
    );
  }

  // Social links
  const socialCount = (html.match(/(facebook|instagram|linkedin|youtube|twitter|x)\.com/gi) ?? []).length;
  const hasSocialLinks = socialCount > 0;
  if (site.reachable && !hasSocialLinks) {
    add(
      "social",
      "No social links",
      "LOW",
      "The site does not link to any social profile.",
      "0 social links found",
      "Link the profiles you already maintain — it builds trust and keeps visitors in your ecosystem.",
    );
  }

  // Trust elements
  const trustElements: string[] = [];
  if (site.reachable) {
    if (/testimonial|review|what our|client say/i.test(lower)) trustElements.push("testimonials");
    if (/certif|accredit|licen|iso|award/i.test(lower)) trustElements.push("certifications");
    if (/address|location|visit us|<address/i.test(lower)) trustElements.push("physical address");
    if (/tel:|mailto:|call us/i.test(lower)) trustElements.push("direct contact");
    if (/guarantee|warranty|refund/i.test(lower)) trustElements.push("guarantee");
    if (/privacy policy|terms/i.test(lower)) trustElements.push("policy pages");
  }
  if (site.reachable && trustElements.length < 3) {
    add(
      "trust",
      "Weak trust signals",
      "MEDIUM",
      `Only ${trustElements.length} trust element(s) found: ${trustElements.join(", ") || "none"}.`,
      trustElements.join(", ") || "none",
      "Reviews, credentials and clear contact details are what turn a visitor into a caller.",
    );
  }

  // Conversion opportunities
  const conversionOpportunities: string[] = [];
  if (site.reachable) {
    if (!hasWhatsapp) conversionOpportunities.push("WhatsApp click-to-chat");
    if (!hasForms) conversionOpportunities.push("Enquiry form above the fold");
    if (!hasBooking) conversionOpportunities.push("Online appointment request");
    if (!hasEcommerce) conversionOpportunities.push("Online ordering / catalogue");
    if (performanceScore < 70) conversionOpportunities.push("Performance rebuild");
    if (seoScore < 60) conversionOpportunities.push("SEO foundation");
    if (trustElements.length < 3) conversionOpportunities.push("Trust and proof section");
  } else {
    conversionOpportunities.push("A website at all", "Google Business Profile integration", "WhatsApp enquiry capture");
  }

  const overallGrade = !site.reachable
    ? "F"
    : scoreToGrade(
        Math.round(
          (navigationScore + visualHierarchyScore + performanceScore + seoScore + a11y) / 5,
        ),
      );

  if (!site.reachable && hasWebsite) {
    add(
      "unreachable",
      "Website unreachable",
      "CRITICAL",
      site.error
        ? `The listed website could not be loaded (${site.error}).`
        : `The listed website returned HTTP ${site.statusCode ?? "error"}.`,
      business.website ?? "",
      "A website that does not load is worse than no website — it actively loses customers.",
    );
  }
  if (!hasWebsite) {
    add(
      "no-website",
      "No website found",
      "CRITICAL",
      "No website was listed on the public business profile.",
      "no website on listing",
      "Without a website the business is invisible to anyone searching for the service.",
    );
  }

  return {
    id: newId("aud"),
    organizationId,
    leadId,
    url: business.website,
    auditedAt: nowIso(),
    hasWebsite,
    reachable: site.reachable,
    https,
    statusCode: site.statusCode,
    loadTimeMs: site.loadTimeMs,
    mobileResponsive,
    navigationScore,
    visualHierarchyScore,
    designEra,
    brokenPages,
    hasContactCta,
    hasWhatsapp,
    hasForms,
    hasBooking,
    hasEcommerce,
    performanceScore,
    seoScore,
    accessibilityScore: a11y,
    hasMetadata,
    hasSocialLinks,
    trustElements,
    conversionOpportunities,
    findings,
    overallGrade,
    provider: "local",
    createdAt: nowIso(),
  };
}

function scoreToGrade(score: number) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

/* --------------------------------------------------------------- scorer --- */

const WEIGHTS = {
  websiteNeed: 0.3,
  currentSiteQuality: 0.18,
  businessActivity: 0.14,
  contactability: 0.14,
  serviceFit: 0.12,
  businessValue: 0.07,
  technicalOpportunity: 0.03,
  evidenceStrength: 0.02,
};

export async function scorerScore(
  organizationId: string,
  leadId: string,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "scorer"))) {
    return { ok: false as const, error: "Scorer agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "scorer", trigger },
    "score.opportunity",
    async (task) => {
      const lead = await tenantById(organizationId, "leads", leadId);
      if (!lead) throw new Error(`Lead ${leadId} not found`);
      const business = await tenantById(organizationId, "businesses", lead.businessId);
      if (!business) throw new Error(`Business for lead ${leadId} not found`);
      const audit = (await db.find("website_audits", { leadId })).at(-1) ?? null;

      await markAgentWorking(organizationId, "scorer", task.id, `Scoring ${business.name}`);

      const factors = computeFactors({ ...business, reviewCount: business.reviewCount ?? 0 }, audit, lead);
      const total = Math.round(
        factors.reduce((acc, f) => acc + f.weight * f.value, 0) * 100,
      );
      const priority: "HOT" | "WARM" | "COLD" | "REJECTED" =
        total >= 75 ? "HOT" : total >= 55 ? "WARM" : total >= 35 ? "COLD" : "REJECTED";

      const score = {
        id: newId("scr"),
        organizationId,
        leadId,
        total: Math.max(0, Math.min(100, total)),
        priority,
        factors,
        reasoning: buildReasoning(factors, priority),
        evidenceStrength: audit?.reachable ? 0.85 : 0.5,
        scoredBy: "scorer",
        createdAt: nowIso(),
      };
      await db.insert("lead_scores", score);

      const newStatus: Lead["status"] = priority === "REJECTED" ? "REJECTED" : "QUALIFIED";
      const newStage = priority === "REJECTED" ? "Lost" : "Qualified";
      await db.update("leads", leadId, {
        status: newStatus,
        pipelineStage: newStage,
        priority,
        score: score.total,
        updatedAt: nowIso(),
      });

      await logActivity({
        organizationId,
        agentKey: "scorer",
        actionType: "lead.scored",
        title: `Opportunity score for ${business.name}: ${score.total} (${priority})`,
        detail: score.reasoning,
        entityType: "lead",
        entityId: leadId,
        leadId,
        riskLevel: "LOW",
        status: priority === "HOT" ? "OK" : "OK",
        meta: { score: score.total, priority },
      });

      if (priority === "HOT") {
        const { notify } = await import("../events/bus");
        await notify({
          organizationId,
          type: "hot_lead",
          title: `Hot lead: ${business.name} scored ${score.total}`,
          body: score.reasoning,
          entityType: "lead",
          entityId: leadId,
          href: `/leads/${leadId}`,
          severity: "SUCCESS",
        });
      }

      await bus.emit(priority === "REJECTED" ? "lead.rejected" : "lead.qualified", {
        organizationId,
        leadId,
        score: score.total,
        priority,
      });
      await markAgentIdle(organizationId, "scorer");

      return { scoreId: score.id, total: score.total, priority };
    },
    { entityType: "lead", entityId: leadId, input: { leadId } },
  );
}

interface Factor {
  key: string;
  label: string;
  weight: number;
  value: number;
  contribution: number;
  note: string;
}

function computeFactors(
  business: {
    name: string;
    website: string | null;
    category: string;
    city: string;
    rating: number | null;
    reviewCount: number;
    phone: string | null;
    email: string | null;
    mapsUrl: string | null;
    socialLinks: Record<string, string>;
  },
  audit: WebsiteAudit | null,
  lead: Lead,
): Factor[] {
  const mk = (key: string, label: string, weight: number, value: number, note: string): Factor => ({
    key,
    label,
    weight,
    value: Math.max(0, Math.min(1, value)),
    contribution: Math.round(weight * Math.max(0, Math.min(1, value)) * 1000) / 1000,
    note,
  });

  const websiteNeed = !business.website
    ? 1
    : audit && !audit.reachable
      ? 0.95
      : audit
        ? clamp01(1 - audit.seoScore / 130) * 0.6 + clamp01(1 - audit.performanceScore / 130) * 0.4
        : 0.5;

  const currentSiteQuality = audit?.reachable
    ? clamp01((audit.seoScore + audit.performanceScore + audit.accessibilityScore + audit.navigationScore) / 400)
    : 0;

  const businessActivity = clamp01(
    ((business.rating ?? 3) / 5) * 0.5 + clamp01((business.reviewCount ?? 0) / 200) * 0.5,
  );

  const contactability = clamp01(
    (business.email ? 0.5 : 0) + (business.phone ? 0.3 : 0) + (business.mapsUrl ? 0.1 : 0) + (Object.keys(business.socialLinks).length ? 0.1 : 0),
  );

  const serviceFit = /restaurant|coaching|institute|school|clinic|dental|gym|salon|retail|store|boutique|interior|travel|agency|hotel/i.test(
    business.category,
  )
    ? 0.9
    : 0.6;

  const businessValue = clamp01((business.reviewCount ?? 0) / 300) * 0.6 + (business.rating && business.rating >= 4 ? 0.4 : 0.2);

  const technicalOpportunity = audit
    ? clamp01(
        (audit.conversionOpportunities.length / 6) * 0.6 + (audit.findings.filter((f) => f.severity === "HIGH" || f.severity === "CRITICAL").length / 6) * 0.4,
      )
    : 0.4;

  const evidenceStrength = audit?.reachable ? 0.9 : audit?.hasWebsite ? 0.5 : 0.7;

  return [
    mk("website_need", "Genuine website need", WEIGHTS.websiteNeed, websiteNeed,
      !business.website
        ? "No website on the public listing."
        : audit && !audit.reachable
          ? "Listed website is unreachable."
          : "Current site has measurable gaps."),
    mk("current_site_quality", "Quality of current site", WEIGHTS.currentSiteQuality, currentSiteQuality,
      audit?.reachable ? `Audit grade ${audit.overallGrade}.` : "No reachable site to assess."),
    mk("business_activity", "Business activity", WEIGHTS.businessActivity, businessActivity,
      `${business.reviewCount ?? 0} public reviews, rating ${business.rating ?? "n/a"}.`),
    mk("contactability", "Available public contact method", WEIGHTS.contactability, contactability,
      [business.email && "email", business.phone && "phone", business.mapsUrl && "maps profile"]
        .filter(Boolean)
        .join(", ") || "no public contact found"),
    mk("service_fit", "Fit with available services", WEIGHTS.serviceFit, serviceFit,
      `${business.category} maps to a NEXORA template family.`),
    mk("business_value", "Likely value of a better site", WEIGHTS.businessValue, businessValue,
      "Derived from public review volume and rating."),
    mk("technical_opportunity", "Technical opportunity", WEIGHTS.technicalOpportunity, technicalOpportunity,
      `${audit?.conversionOpportunities.length ?? 0} conversion opportunities identified.`),
    mk("evidence_strength", "Strength of evidence", WEIGHTS.evidenceStrength, evidenceStrength,
      audit?.reachable ? "Site was fetched and analysed directly." : "Assessment based on listing data only."),
  ];
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function buildReasoning(factors: Factor[], priority: string) {
  const top = [...factors].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  const bottom = [...factors].sort((a, b) => a.contribution - b.contribution).slice(0, 2);
  return `Priority ${priority}. Strongest signals: ${top
    .map((f) => `${f.label} (${Math.round(f.contribution * 100)}%)`)
    .join(", ")}. Weakest: ${bottom.map((f) => f.label).join(", ")}.`;
}

/* ------------------------------------------------------------- helpers ---- */

function inferServices(defaults: string[]): string[] {
  return defaults.slice(0, 6);
}

function profileTargetCustomer(category: string) {
  const c = category.toLowerCase();
  if (/restaurant|cafe|food/.test(c)) return "Local families, couples and office groups looking for a reliable place to eat or order from.";
  if (/coaching|academy|school|institute/.test(c)) return "Students preparing for competitive exams and their parents.";
  if (/gym|fitness/.test(c)) return "Working professionals and students who want structured training near home.";
  if (/dental|clinic|doctor|medical/.test(c)) return "Local patients needing routine and urgent care with transparent pricing.";
  if (/salon|spa|beauty/.test(c)) return "Customers booking regular grooming and event styling.";
  if (/retail|store|shop|boutique/.test(c)) return "Walk-in customers and local buyers who order on WhatsApp.";
  if (/interior|architect|construction/.test(c)) return "Homeowners and businesses planning a fit-out or renovation.";
  if (/travel|tour|hotel/.test(c)) return "Individuals, families and groups planning trips with a fixed budget.";
  return "Local customers searching for the service in the area.";
}

function buildOnlinePresence(
  business: { website: string | null; socialLinks: Record<string, string>; mapsUrl: string | null; rating: number | null; reviewCount: number },
  site: FetchedSite,
): string[] {
  const out: string[] = [];
  if (business.website) out.push(site.reachable ? `Website reachable (${site.finalUrl})` : `Website listed but unreachable (${business.website})`);
  else out.push("No website listed on the public profile");
  if (business.mapsUrl) out.push("Google Business Profile present");
  const socials = Object.keys(business.socialLinks);
  out.push(socials.length > 0 ? `Social profiles: ${socials.join(", ")}` : "No social profiles found");
  if (business.rating) out.push(`Public rating ${business.rating} from ${business.reviewCount ?? 0} reviews`);
  return out;
}

function buildContactChannels(business: { phone: string | null; email: string | null; website: string | null; mapsUrl: string | null }) {
  const out: string[] = [];
  if (business.phone) out.push("Phone");
  if (business.email) out.push("Email");
  if (business.website) out.push("Website contact form");
  if (business.mapsUrl) out.push("Google Business Profile");
  if (out.length === 0) out.push("None publicly listed");
  return out;
}

function buildOpportunities(
  business: { category: string; website: string | null; socialLinks: Record<string, string> },
  site: FetchedSite,
): string[] {
  const out: string[] = [];
  const c = business.category.toLowerCase();
  if (!business.website) out.push("Build a first website that captures search demand");
  if (!site.reachable && business.website) out.push("Repair or replace an unreachable website");
  if (/restaurant|cafe|food/.test(c)) out.push("Digital menu + WhatsApp ordering + reservations");
  if (/coaching|academy|school|institute/.test(c)) out.push("Admissions enquiry funnel + course pages + results proof");
  if (/clinic|dental|doctor|salon|spa|gym/.test(c)) out.push("Online appointment booking + WhatsApp reminders");
  if (/retail|store|shop|boutique/.test(c)) out.push("Catalogue with WhatsApp ordering");
  if (/interior|architect|construction/.test(c)) out.push("Project gallery + quote request flow");
  if (/travel|tour|hotel/.test(c)) out.push("Package catalogue + enquiry and itinerary request");
  if (Object.keys(business.socialLinks).length === 0) out.push("Establish and link social presence");
  out.push("Local SEO foundation so the business appears in map results");
  return out.slice(0, 6);
}

function inferMaturity(reviews: number) {
  if (reviews > 250) return "MATURE" as const;
  if (reviews > 80) return "ESTABLISHED" as const;
  if (reviews > 15) return "GROWING" as const;
  return "NEW" as const;
}

function buildRisks(
  business: { website: string | null; email: string | null; phone: string | null },
  site: FetchedSite,
): string[] {
  const out: string[] = [];
  if (!business.email) out.push("No public email address — outreach may need to go through phone or a form");
  if (!business.phone) out.push("No public phone number found");
  if (business.website && !site.reachable) out.push("Website unreachable — the owner may already be mid-migration");
  if (out.length === 0) out.push("No material outreach risks identified from public data");
  return out;
}
