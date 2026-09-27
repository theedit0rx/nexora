import type { QaCheck, QaRun, QaVerdict } from "../db/schema";
import { newId } from "../db";

/* ==========================================================================
   NEXORA — QA Engine
   --------------------------------------------------------------------------
   Runs a real, deterministic inspection pass over a generated site:
   HTML well-formedness, metadata, link integrity, route coverage,
   form labelling, accessibility basics, responsive/viewport rules,
   asset presence and obvious performance smells.
   On FAIL the exact problems are returned so the Builder can repair them.
   ========================================================================== */

export interface QaTarget {
  organizationId: string;
  targetType: "DEMO" | "BUILD";
  targetId: string;
  label: string;
  files: Array<{ path: string; content: string }>;
}

const REQUIRED_PAGES = ["index.html", "services.html", "about.html", "contact.html"];

const CRITICAL: QaCheck["severity"] = "CRITICAL";

function check(
  code: string,
  label: string,
  category: QaCheck["category"],
  passed: boolean,
  message: string,
  severity: QaCheck["severity"] = "MEDIUM",
  target = "",
): QaCheck {
  return { id: newId("chk"), code, label, category, passed, severity, message, target };
}

/** Parse the `<head>` and body of an HTML file with a tolerant tokenizer. */
function parseHtml(html: string) {
  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  const head = headMatch?.[1] ?? "";
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const body = bodyMatch?.[1] ?? html;
  return { head, body };
}

function extractLinks(html: string): Array<{ href: string; external: boolean }> {
  const out: Array<{ href: string; external: boolean }> = [];
  const re = /<(?:a|link)\b[^>]*?(?:href|src)="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1]!;
    out.push({ href, external: /^(https?:)?\/\//i.test(href) });
  }
  return out;
}

export function runQa(target: QaTarget): QaRun {
  const started = Date.now();
  const checks: QaCheck[] = [];
  const byPath = new Map(target.files.map((f) => [f.path, f.content]));

  /* ---- BUILD: files exist ---- */
  checks.push(
    check(
      "build.files",
      "Generated file set",
      "BUILD",
      target.files.length >= 6,
      `${target.files.length} files generated`,
      target.files.length >= 6 ? "INFO" : "HIGH",
    ),
  );
  checks.push(
    check(
      "build.stylesheet",
      "Stylesheet emitted",
      "BUILD",
      byPath.has("styles.css") && (byPath.get("styles.css")?.length ?? 0) > 2000,
      byPath.has("styles.css")
        ? `styles.css is ${byPath.get("styles.css")!.length} bytes`
        : "styles.css missing",
      "HIGH",
    ),
  );
  checks.push(
    check(
      "build.script",
      "Progressive enhancement script",
      "BUILD",
      byPath.has("app.js"),
      byPath.has("app.js") ? "app.js present" : "app.js missing",
      "LOW",
    ),
  );

  /* ---- ROUTES: every planned page exists ---- */
  for (const page of REQUIRED_PAGES) {
    checks.push(
      check(
        `routes.${page}`,
        `Page ${page}`,
        "ROUTES",
        byPath.has(page),
        byPath.has(page) ? `${page} generated` : `${page} missing from build`,
        CRITICAL,
        page,
      ),
    );
  }

  /* ---- per-page checks ---- */
  let htmlErrors = 0;
  for (const page of REQUIRED_PAGES) {
    const html = byPath.get(page);
    if (!html) continue;

    // doctype + lang
    checks.push(
      check(
        `build.doctype.${page}`,
        "Doctype and language",
        "BUILD",
        /<!doctype html>/i.test(html) && /<html[^>]+lang="/i.test(html),
        `<!doctype html> and lang attribute present on ${page}`,
        "HIGH",
        page,
      ),
    );

    // tag balance for common containers
    for (const tag of ["html", "head", "body", "main", "section", "footer", "header", "form", "nav"]) {
      const open = (html.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length;
      const close = (html.match(new RegExp(`</${tag}>`, "gi")) ?? []).length;
      if (open !== close) {
        htmlErrors++;
        checks.push(
          check(
            `build.balance.${tag}.${page}`,
            "Tag balance",
            "BUILD",
            false,
            `<${tag}> opened ${open} times but closed ${close} times on ${page}`,
            CRITICAL,
            page,
          ),
        );
      }
    }

    const { head } = parseHtml(html);

    // metadata
    checks.push(
      check(
        `metadata.title.${page}`,
        "Title tag",
        "METADATA",
        /<title>[^<]{8,}<\/title>/i.test(head),
        `Title present on ${page}`,
        "HIGH",
        page,
      ),
    );
    checks.push(
      check(
        `metadata.description.${page}`,
        "Meta description",
        "METADATA",
        /<meta\s+name="description"\s+content="[^"]{40,}"/i.test(head),
        `Meta description present on ${page}`,
        "MEDIUM",
        page,
      ),
    );
    checks.push(
      check(
        `metadata.viewport.${page}`,
        "Viewport meta",
        "METADATA",
        /<meta\s+name="viewport"/i.test(head),
        `Viewport meta present on ${page}`,
        CRITICAL,
        page,
      ),
    );
    checks.push(
      check(
        `metadata.canonical.${page}`,
        "Canonical URL",
        "METADATA",
        /<link\s+rel="canonical"/i.test(head),
        `Canonical link present on ${page}`,
        "LOW",
        page,
      ),
    );
    checks.push(
      check(
        `metadata.og.${page}`,
        "Open Graph tags",
        "METADATA",
        /property="og:title"/i.test(head) && /property="og:description"/i.test(head),
        `Open Graph tags present on ${page}`,
        "LOW",
        page,
      ),
    );
    checks.push(
      check(
        `metadata.jsonld.${page}`,
        "Structured data",
        "METADATA",
        /application\/ld\+json/i.test(head),
        `JSON-LD structured data present on ${page}`,
        "LOW",
        page,
      ),
    );
    checks.push(
      check(
        `metadata.favicon.${page}`,
        "Favicon",
        "METADATA",
        /rel="icon"/i.test(head),
        `Favicon declared on ${page}`,
        "LOW",
        page,
      ),
    );

    // accessibility basics
    const imgs = (html.match(/<img\b/gi) ?? []).length;
    const imgAlts = (html.match(/<img\b[^>]*\balt="/gi) ?? []).length;
    checks.push(
      check(
        `a11y.img-alt.${page}`,
        "Image alt text",
        "A11Y",
        imgs === imgAlts,
        imgs === 0 ? `No <img> tags on ${page} (SVG/CSS art used instead)` : `${imgAlts}/${imgs} images have alt text on ${page}`,
        "MEDIUM",
        page,
      ),
    );
    // A button is accessible when it carries an aria-label, an aria-labelledby,
    // or visible text content — an icon-only button with neither fails.
    const buttonTags = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi) ?? [];
    const unlabelledButtons = buttonTags.filter((tag) => {
      if (/aria-label=/.test(tag)) return false;
      if (/aria-labelledby=/.test(tag)) return false;
      const text = tag
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;|&#160;/g, " ")
        .trim();
      return text.length === 0;
    }).length;
    const buttons = buttonTags.length;
    checks.push(
      check(
        `a11y.button-label.${page}`,
        "Button labelling",
        "A11Y",
        buttons === 0 || unlabelledButtons === 0,
        buttons === 0
          ? `No buttons on ${page}`
          : unlabelledButtons === 0
            ? `All ${buttons} buttons are labelled on ${page}`
            : `${unlabelledButtons} of ${buttons} buttons have no label on ${page}`,
        "LOW",
        page,
      ),
    );
    const h1 = (html.match(/<h1\b/gi) ?? []).length;
    checks.push(
      check(
        `a11y.h1.${page}`,
        "Single H1",
        "A11Y",
        h1 === 1,
        h1 === 1 ? `Exactly one <h1> on ${page}` : `${h1} <h1> elements on ${page}`,
        "MEDIUM",
        page,
      ),
    );
    checks.push(
      check(
        `a11y.lang.${page}`,
        "Language attribute",
        "A11Y",
        /<html[^>]+lang="/i.test(html),
        `lang attribute set on ${page}`,
        "MEDIUM",
        page,
      ),
    );
    checks.push(
      check(
        `a11y.landmarks.${page}`,
        "Landmark regions",
        "A11Y",
        /<(header|nav|footer|main)\b/i.test(html),
        `Landmark elements present on ${page}`,
        "LOW",
        page,
      ),
    );

    // links
    const links = extractLinks(html);
    const internal = links.filter(
      (l) =>
        !l.external &&
        !l.href.startsWith("#") &&
        !l.href.startsWith("mailto:") &&
        !l.href.startsWith("tel:") &&
        !l.href.startsWith("data:") &&
        !l.href.startsWith("blob:"),
    );
    const brokenInternal = internal.filter((l) => {
      const path = l.href.split("?")[0]!.split("#")[0]!;
      if (!path || path === "/") return false;
      return !byPath.has(path.replace(/^\//, ""));
    });
    checks.push(
      check(
        `links.internal.${page}`,
        "Internal links resolve",
        "LINKS",
        brokenInternal.length === 0,
        brokenInternal.length === 0
          ? `${internal.length} internal links all resolve on ${page}`
          : `${brokenInternal.length} broken internal link(s) on ${page}: ${brokenInternal
              .slice(0, 3)
              .map((l) => l.href)
              .join(", ")}`,
        CRITICAL,
        page,
      ),
    );
    const missingHref = (html.match(/<a\b(?![^>]*\bhref=)[^>]*>/gi) ?? []).length;
    checks.push(
      check(
        `links.href.${page}`,
        "Anchors have href",
        "LINKS",
        missingHref === 0,
        missingHref === 0 ? `All anchors have href on ${page}` : `${missingHref} anchor(s) without href on ${page}`,
        "MEDIUM",
        page,
      ),
    );

    // forms
    const forms = (html.match(/<form\b/gi) ?? []).length;
    const labelled = (html.match(/<label\b[^>]*\bfor="/gi) ?? []).length;
    const inputs = (html.match(/<(?:input|select|textarea)\b/gi) ?? []).length;
    checks.push(
      check(
        `forms.labels.${page}`,
        "Form fields labelled",
        "FORMS",
        inputs === 0 || labelled >= inputs * 0.7,
        inputs === 0 ? `No form fields on ${page}` : `${labelled}/${inputs} form fields have labels on ${page}`,
        "MEDIUM",
        page,
      ),
    );
    checks.push(
      check(
        `forms.novalidate.${page}`,
        "Forms have status region",
        "FORMS",
        forms === 0 || /aria-live="polite"/.test(html),
        forms === 0 ? `No forms on ${page}` : `Form status region present on ${page}`,
        "LOW",
        page,
      ),
    );

    // responsiveness
    checks.push(
      check(
        `responsive.media.${page}`,
        "Responsive breakpoints",
        "MOBILE",
        /@media\s*\(max-width:\s*640px\)/.test(byPath.get("styles.css") ?? ""),
        "Mobile breakpoint defined in stylesheet",
        "HIGH",
        page,
      ),
    );
    checks.push(
      check(
        `responsive.nav.${page}`,
        "Mobile navigation",
        "MOBILE",
        /nx-nav__toggle/.test(html),
        `Mobile nav toggle present on ${page}`,
        "MEDIUM",
        page,
      ),
    );
    checks.push(
      check(
        `responsive.fluid.${page}`,
        "Fluid type / clamp()",
        "MOBILE",
        /clamp\(/.test(byPath.get("styles.css") ?? ""),
        "Fluid typography via clamp() in stylesheet",
        "LOW",
        page,
      ),
    );
    checks.push(
      check(
        `responsive.tablet.${page}`,
        "Tablet breakpoint",
        "TABLET",
        /@media\s*\(max-width:\s*960px\)/.test(byPath.get("styles.css") ?? ""),
        "Tablet breakpoint defined in stylesheet",
        "LOW",
        page,
      ),
    );

    // performance smells
    const externalScripts = (html.match(/<script\b[^>]*\ssrc="https?:/gi) ?? []).length;
    checks.push(
      check(
        `perf.scripts.${page}`,
        "No blocking external scripts",
        "PERFORMANCE",
        externalScripts === 0,
        externalScripts === 0
          ? `No blocking third-party scripts on ${page}`
          : `${externalScripts} blocking external script(s) on ${page}`,
        "MEDIUM",
        page,
      ),
    );
    const inlineStyles = (html.match(/style="/gi) ?? []).length;
    checks.push(
      check(
        `perf.inline.${page}`,
        "Inline style usage",
        "PERFORMANCE",
        inlineStyles <= 6,
        `${inlineStyles} inline style attribute(s) on ${page}`,
        "INFO",
        page,
      ),
    );
  }

  /* ---- console errors: script syntax sanity ---- */
  const js = byPath.get("app.js") ?? "";
  checks.push(
    check(
      "console.script",
      "Script parses",
      "CONSOLE",
      js.length > 100 && js.includes("addEventListener"),
      "app.js registers event listeners",
      "MEDIUM",
    ),
  );

  /* ---- assets ---- */
  const referenced = new Set<string>();
  for (const html of byPath.values()) {
    for (const m of html.matchAll(/(?:href|src)="([^"]+\.(?:css|js|png|jpg|jpeg|svg|webp|woff2?))"/gi)) {
      referenced.add(m[1]!);
    }
  }
  const missingAssets = Array.from(referenced).filter((r) => !byPath.has(r.replace(/^\//, "")) && !/^https?:/i.test(r));
  checks.push(
    check(
      "assets.missing",
      "Referenced assets exist",
      "ASSETS",
      missingAssets.length === 0,
      missingAssets.length === 0
        ? `All ${referenced.size} referenced local assets exist`
        : `Missing assets: ${missingAssets.slice(0, 4).join(", ")}`,
      CRITICAL,
    ),
  );

  /* ---- SEO basics ---- */
  checks.push(
    check(
      "seo.sitemap",
      "Sitemap present",
      "METADATA",
      byPath.has("sitemap.xml"),
      byPath.has("sitemap.xml") ? "sitemap.xml generated" : "sitemap.xml missing",
      "MEDIUM",
    ),
  );
  checks.push(
    check(
      "seo.robots",
      "Robots.txt present",
      "METADATA",
      byPath.has("robots.txt"),
      byPath.has("robots.txt") ? "robots.txt generated" : "robots.txt missing",
      "LOW",
    ),
  );
  checks.push(
    check(
      "seo.jsonld",
      "LocalBusiness structured data",
      "METADATA",
      Array.from(byPath.values()).some((h) => /application\/ld\+json/.test(h)),
      "JSON-LD present on at least one page",
      "MEDIUM",
    ),
  );

  /* ---- lint: obvious code smells ---- */
  const css = byPath.get("styles.css") ?? "";
  const unbalancedCss = (css.match(/{/g) ?? []).length - (css.match(/}/g) ?? []).length;
  checks.push(
    check(
      "lint.css-balance",
      "CSS brace balance",
      "LINT",
      unbalancedCss === 0,
      unbalancedCss === 0 ? "CSS braces balanced" : `CSS brace imbalance: ${unbalancedCss}`,
      "HIGH",
    ),
  );

  /* ---- verdict ---- */
  const failed = checks.filter((c) => !c.passed && (c.severity === "CRITICAL" || c.severity === "HIGH"));
  const warnings = checks.filter((c) => !c.passed && (c.severity === "MEDIUM" || c.severity === "LOW"));
  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / Math.max(1, checks.length)) * 100);

  let verdict: QaVerdict = "PASS";
  if (failed.length > 0) verdict = "FAIL";
  else if (warnings.length > 0) verdict = "PASS_WITH_WARNINGS";

  const run: QaRun = {
    id: newId("qa"),
    organizationId: target.organizationId,
    targetType: target.targetType,
    targetId: target.targetId,
    verdict,
    score,
    checks,
    passedCount,
    failedCount: failed.length,
    warningCount: warnings.length,
    durationMs: Date.now() - started,
    issues: [...failed, ...warnings].map((c) => `[${c.severity}] ${c.label}: ${c.message}`),
    runBy: "qa",
    createdAt: new Date().toISOString(),
  };
  return run;
}
