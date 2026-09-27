import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderComponent } from "./components";
import { buildScript, buildStylesheet } from "./styles";
import { googleFontsLink } from "./themes";
import type { SiteTheme } from "./types";
import type { ComponentContext, GenerationResult, SiteBusiness } from "./types";
import type { GeneratedFile } from "./types";

export type { GeneratedFile };

/* ==========================================================================
   NEXORA — Site Generator
   --------------------------------------------------------------------------
   Assembles a complete, deployable static website from the reusable
   component library + the business content model + the selected theme.
   Output is plain HTML/CSS/JS — no runtime dependencies, no build step,
   deployable to Vercel, Netlify, GitHub Pages or any static host.
   ========================================================================== */

export interface GenerateSiteInput {
  slug: string;
  business: SiteBusiness;
  theme: SiteTheme;
  /** Component list per page, in render order. */
  pagePlan: Record<string, string[]>;
  demo: boolean;
  outputRoot: string;
  baseUrl?: string;
}

const PAGE_TITLES: Record<string, (b: SiteBusiness) => string> = {
  index: (b) => `${b.name} — ${b.tagline}`,
  services: (b) => `Services — ${b.name}`,
  about: (b) => `About — ${b.name}`,
  contact: (b) => `Contact — ${b.name}`,
};

const PAGE_DESCRIPTIONS: Record<string, (b: SiteBusiness) => string> = {
  index: (b) => `${b.about}`,
  services: (b) => `Services offered by ${b.name} in ${b.city}: ${b.services.slice(0, 5).join(", ")}.`,
  about: (b) => `Learn more about ${b.name}, a ${b.category.toLowerCase()} business in ${b.city}.`,
  contact: (b) => `Contact ${b.name} in ${b.city} — phone, WhatsApp, email, address and enquiry form.`,
};

const PAGE_H1: Record<string, (b: SiteBusiness) => string> = {
  index: (b) => b.name,
  services: (b) => `Services from ${b.name}`,
  about: (b) => `About ${b.name}`,
  contact: (b) => `Contact ${b.name}`,
};

/** Heading for the page, used as the single `<h1>` for the document. */
function pageH1(pageKey: string, business: SiteBusiness): string {
  return (PAGE_H1[pageKey] ?? PAGE_H1.index!)(business);
}

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function head(ctx: ComponentContext, pageKey: string, baseUrl: string): string {
  const b = ctx.business;
  const title = (PAGE_TITLES[pageKey] ?? PAGE_TITLES.index!)(b);
  const description = (PAGE_DESCRIPTIONS[pageKey] ?? PAGE_DESCRIPTIONS.index!)(b);
  const canonical = baseUrl ? `${baseUrl.replace(/\/$/, "")}/${pageKey === "index" ? "" : pageKey + ".html"}` : "";
  const favicon = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${ctx.theme.primary}"/><text x="32" y="42" font-family="sans-serif" font-size="32" font-weight="700" fill="white" text-anchor="middle">${esc(
      b.name.slice(0, 1).toUpperCase(),
    )}</text></svg>`,
  )}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": localBusinessType(b.category),
    name: b.name,
    description: b.about,
    address: b.address
      ? { "@type": "PostalAddress", streetAddress: b.address, addressLocality: b.city, addressCountry: "IN" }
      : { "@type": "PostalAddress", addressLocality: b.city, addressCountry: "IN" },
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(b.email ? { email: b.email } : {}),
    ...(b.rating && b.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: b.rating,
            reviewCount: b.reviewCount,
          },
        }
      : {}),
    openingHours: b.hours.map((h) => h.split(":")[0]?.trim()).filter(Boolean),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description.slice(0, 300))}" />
<meta name="keywords" content="${esc(b.keywords.join(", "))}" />
<meta name="theme-color" content="${ctx.theme.primary}" />
${canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : '<meta name="robots" content="noindex,nofollow" />'}
<link rel="icon" href="${favicon}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description.slice(0, 300))}" />
<meta property="og:site_name" content="${esc(b.name)}" />
${canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${googleFontsLink(ctx.theme) ? `<link rel="stylesheet" href="${googleFontsLink(ctx.theme)}" />` : ""}
<link rel="stylesheet" href="styles.css" />
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>`;
}

function localBusinessType(category: string): string {
  const c = category.toLowerCase();
  if (/restaurant|cafe|food|bakery|dining/.test(c)) return "Restaurant";
  if (/dental|clinic|doctor|medical/.test(c)) return "Dentist";
  if (/gym|fitness/.test(c)) return "ExerciseGym";
  if (/salon|spa|beauty/.test(c)) return "BeautySalon";
  if (/hotel|resort/.test(c)) return "Hotel";
  if (/school|coaching|academy|institute/.test(c)) return "EducationalOrganization";
  if (/retail|store|shop/.test(c)) return "Store";
  return "LocalBusiness";
}

export function generateSiteFiles(input: GenerateSiteInput): GenerationResult {
  if (input.baseUrl && !/^https?:\/\//.test(input.baseUrl)) throw new Error("Site base URL must be absolute");
  const ctx: ComponentContext = {
    business: input.business,
    theme: input.theme,
    page: "index",
    demo: input.demo,
  };

  const files: GeneratedFile[] = [];
  const componentsUsed = new Set<string>();
  const pages: string[] = [];

  files.push({ path: "styles.css", content: buildStylesheet(ctx) });
  files.push({ path: "app.js", content: buildScript() });

  for (const [pageKey, componentList] of Object.entries(input.pagePlan)) {
    const pageCtx: ComponentContext = { ...ctx, page: pageKey };
    const body = componentList
      .map((key) => {
        componentsUsed.add(key);
        return renderComponent(key, pageCtx);
      })
      .join("\n");
    // The hero component owns index.html's <h1>; every other page gets an
    // explicit page heading so exactly one <h1> exists per document.
    const heading =
      pageKey === "index"
        ? ""
        : `<h1 class="nx-h1 nx-page-title">${esc(pageH1(pageKey, input.business))}</h1>`;
    const html = `${head(pageCtx, pageKey, input.baseUrl ?? "")}
<body>
<a class="nx-skip" href="#main">Skip to content</a>
${input.demo ? '<aside role="note">Design preview — suggested content requires business approval.</aside>' : ""}
<main id="main">
${heading}
${body}
</main>
</body>
</html>
`;
    const fileName = pageKey === "index" ? "index.html" : `${pageKey}.html`;
    files.push({ path: fileName, content: html });
    pages.push(fileName);
  }

  files.push({
    path: "robots.txt",
    content: input.baseUrl ? `User-agent: *\nAllow: /\nSitemap: ${input.baseUrl.replace(/\/$/, "")}/sitemap.xml\n` : `User-agent: *\nDisallow: /\n`,
  });
  files.push({
    path: "sitemap.xml",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${(input.baseUrl ? pages : [])
  .map((p) => `  <url><loc>${esc(input.baseUrl!.replace(/\/$/, ""))}/${p}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`)
  .join("\n")}
</urlset>
`,
  });
  files.push({
    path: "manifest.webmanifest",
    content: JSON.stringify(
      {
        name: input.business.name,
        short_name: input.business.name.slice(0, 12),
        start_url: "/",
        display: "standalone",
        background_color: input.theme.bg,
        theme_color: input.theme.primary,
      },
      null,
      2,
    ),
  });

  return { files, pages, componentsUsed: Array.from(componentsUsed) };
}

/** Write a generated site to disk and return the result. */
export function writeSite(input: GenerateSiteInput): GenerationResult & { outputDir: string; totalBytes: number } {
  const result = generateSiteFiles(input);
  const outputDir = join(input.outputRoot, input.slug);
  mkdirSync(outputDir, { recursive: true });
  let totalBytes = 0;
  for (const file of result.files) {
    const bytes = Buffer.byteLength(file.content, "utf-8");
    totalBytes += bytes;
    writeFileSync(join(outputDir, file.path), file.content, "utf-8");
  }
  return { ...result, outputDir, totalBytes };
}

export function defaultPagePlan(category: string): Record<string, string[]> {
  const c = category.toLowerCase();
  const isRestaurant = /restaurant|cafe|food|bakery|dining|bistro/.test(c);
  const isEducation = /coaching|academy|institute|school|tuition|training/.test(c);
  const isRetail = /retail|store|shop|boutique|fashion/.test(c);
  const isService = /clinic|dental|doctor|salon|spa|gym|interior|travel|agency|consult/.test(c);

  const home: string[] = ["navbar", "hero", "stats"];
  const services: string[] = ["navbar", "services", "features", "timeline", "whatsappCta", "footer"];
  const about: string[] = ["navbar", "team", "testimonials", "map", "cta", "footer"];
  const contact: string[] = ["navbar", "contact", "map", "faq", "footer"];

  if (isRestaurant) {
    home.push("menu", "gallery", "testimonials", "booking", "whatsappCta");
    services.push("menu");
    about.push("gallery");
    contact.push("booking");
  } else if (isEducation) {
    home.push("courses", "features", "testimonials", "admissions", "faq");
    services.push("courses", "timeline");
    about.push("courses", "gallery");
    contact.push("admissions");
  } else if (isRetail) {
    home.push("products", "features", "reviews", "whatsappCta");
    services.push("products");
    about.push("products", "gallery");
  } else if (isService) {
    home.push("services", "features", "reviews", "booking", "whatsappCta");
    about.push("testimonials", "map");
    contact.push("booking", "faq");
  } else {
    home.push("services", "features", "testimonials", "cta");
    about.push("timeline", "map");
  }

  return { index: home, services, about, contact };
}
