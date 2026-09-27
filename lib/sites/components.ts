import type { ComponentContext, SiteComponent } from "./types";

/* ==========================================================================
   NEXORA — Reusable Website Component Library
   --------------------------------------------------------------------------
   Every generated site is assembled from these primitives. The Builder
   never writes a bespoke page from scratch; it selects components and
   supplies business-specific content, which is why NEXORA sites stay
   maintainable while still looking distinct per industry.
   ========================================================================== */

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const phoneDigits = (p: string | null) => (p ?? "").replace(/[^\d]/g, "");
const waLink = (ctx: ComponentContext, text: string) => {
  const digits = phoneDigits(ctx.business.phone);
  if (!digits) return `mailto:${ctx.business.email ?? ""}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

/** CSS custom properties block injected into every page. */
export function themeVars(ctx: ComponentContext): string {
  const t = ctx.theme;
  return `:root{
  --nx-primary:${t.primary};--nx-primary-dark:${t.primaryDark};--nx-accent:${t.accent};
  --nx-bg:${t.bg};--nx-surface:${t.surface};--nx-text:${t.text};--nx-muted:${t.muted};
  --nx-radius:${t.radius};--nx-radius-lg:${t.radiusLg};
  --nx-font-h:${t.fontHeading};--nx-font-b:${t.fontBody};
}`;
}

/* --------------------------------------------------------------- navbar --- */

export const navbar: SiteComponent = (ctx) => {
  const links: Record<string, Array<[string, string]>> = {
    home: [
      ["index.html", "Home"],
      ["services.html", "Services"],
      ["about.html", "About"],
      ["contact.html", "Contact"],
    ],
    services: [
      ["index.html", "Home"],
      ["services.html", "Services"],
      ["about.html", "About"],
      ["contact.html", "Contact"],
    ],
    about: [
      ["index.html", "Home"],
      ["services.html", "Services"],
      ["about.html", "About"],
      ["contact.html", "Contact"],
    ],
    contact: [
      ["index.html", "Home"],
      ["services.html", "Services"],
      ["about.html", "About"],
      ["contact.html", "Contact"],
    ],
  };
  const items = links[ctx.page] ?? links.home!;
  const nav = items
    .map(
      ([href, label]) =>
        `<a class="nx-nav__link" href="${href}"${
          href.startsWith(ctx.page === "home" ? "index" : ctx.page) ? ' aria-current="page"' : ""
        }>${esc(label)}</a>`,
    )
    .join("");
  return `<header class="nx-nav" id="nx-top">
  <a class="nx-nav__brand" href="index.html">
    <span class="nx-nav__mark" aria-hidden="true">${esc(ctx.business.name.slice(0, 1))}</span>
    <span class="nx-nav__name">${esc(ctx.business.name)}</span>
  </a>
  <nav class="nx-nav__links" aria-label="Primary">${nav}</nav>
  <a class="nx-btn nx-btn--primary nx-nav__cta" href="${waLink(
    ctx,
    `Hi ${ctx.business.name}, I found you online and would like to know more.`,
  )}">${esc(ctx.business.phone ? "WhatsApp Us" : "Get in Touch")}</a>
  <button class="nx-nav__toggle" aria-expanded="false" aria-controls="nx-mobile-menu" aria-label="Open menu">
    <span></span><span></span><span></span>
  </button>
</header>
<div class="nx-mobile-menu" id="nx-mobile-menu" hidden>
  ${items.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join("")}
  <a class="nx-btn nx-btn--primary" href="contact.html">Contact</a>
</div>`;
};

/* ----------------------------------------------------------------- hero --- */

export const hero: SiteComponent = (ctx) => {
  const b = ctx.business;
  const ratingBlock =
    b.rating && b.rating > 0
      ? `<div class="nx-hero__rating"><span class="nx-stars" aria-label="Rated ${b.rating} out of 5">${"★".repeat(
          Math.round(b.rating),
        )}${"☆".repeat(5 - Math.round(b.rating))}</span><span>${b.rating.toFixed(
          1,
        )} · ${b.reviewCount} reviews</span></div>`
      : "";
  return `<section class="nx-hero">
  <div class="nx-hero__inner">
    <div class="nx-hero__copy">
      <p class="nx-eyebrow">${esc(b.subcategory || b.category)} · ${esc(b.city)}</p>
      <h1 class="nx-hero__title">${esc(b.tagline)}</h1>
      <p class="nx-hero__sub">${esc(b.about)}</p>
      <div class="nx-hero__actions">
        <a class="nx-btn nx-btn--primary nx-btn--lg" href="${waLink(
          ctx,
          `Hi ${b.name}, I'd like to enquire about your services.`,
        )}">Enquire on WhatsApp</a>
        <a class="nx-btn nx-btn--ghost nx-btn--lg" href="services.html">See what we do</a>
      </div>
      ${ratingBlock}
    </div>
    <div class="nx-hero__art" aria-hidden="true">
      <div class="nx-hero__blob"></div>
      <div class="nx-hero__card nx-hero__card--a"></div>
      <div class="nx-hero__card nx-hero__card--b"></div>
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------- services --- */

export const services: SiteComponent = (ctx) => {
  const items = ctx.business.services.slice(0, 6);
  if (items.length === 0) return "";
  return `<section class="nx-section" id="services">
  <div class="nx-container">
    <p class="nx-eyebrow">What we do</p>
    <h2 class="nx-h2">Services built around ${esc(ctx.business.city)}</h2>
    <div class="nx-grid nx-grid--3">
      ${items
        .map(
          (s, i) => `<article class="nx-card nx-card--service">
        <span class="nx-card__index">${String(i + 1).padStart(2, "0")}</span>
        <h3 class="nx-card__title">${esc(s)}</h3>
        <p class="nx-card__text">${esc(
          serviceBlurb(ctx, s),
        )}</p>
        <a class="nx-link" href="contact.html">Ask about this →</a>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

function serviceBlurb(ctx: ComponentContext, service: string): string {
  const b = ctx.business;
  const map: Record<string, string> = {
    default: `Delivered by the ${b.name} team with the same care we give every client in ${b.city}.`,
  };
  return (
    map[service.toLowerCase()] ??
    map.default!.replace("${b.city}", b.city)
  );
}

/* ------------------------------------------------------------- features --- */

export const features: SiteComponent = (ctx) => {
  const items = ctx.business.usp.slice(0, 4);
  if (items.length === 0) return "";
  return `<section class="nx-section nx-section--alt">
  <div class="nx-container">
    <p class="nx-eyebrow">Why ${esc(ctx.business.name)}</p>
    <h2 class="nx-h2">The difference is in the detail</h2>
    <div class="nx-grid nx-grid--4">
      ${items
        .map(
          (u) => `<div class="nx-feature">
        <div class="nx-feature__icon" aria-hidden="true">✓</div>
        <h3 class="nx-feature__title">${esc(u)}</h3>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

/* ---------------------------------------------------------------- stats --- */

export const stats: SiteComponent = (ctx) => {
  const items = ctx.business.stats.slice(0, 4);
  if (items.length === 0) return "";
  return `<section class="nx-stats">
  <div class="nx-container nx-stats__grid">
    ${items
      .map(
        (s) => `<div class="nx-stat">
      <span class="nx-stat__value tnum">${esc(s.value)}</span>
      <span class="nx-stat__label">${esc(s.label)}</span>
    </div>`,
      )
      .join("")}
  </div>
</section>`;
};

/* --------------------------------------------------------- testimonials --- */

export const testimonials: SiteComponent = (ctx) => {
  const items = ctx.business.testimonials.slice(0, 3);
  if (items.length === 0) return "";
  return `<section class="nx-section nx-section--alt">
  <div class="nx-container">
    <p class="nx-eyebrow">Client words</p>
    <h2 class="nx-h2">Trusted by people in ${esc(ctx.business.city)}</h2>
    <div class="nx-grid nx-grid--3">
      ${items
        .map(
          (t) => `<figure class="nx-quote">
        <blockquote>“${esc(t.quote)}”</blockquote>
        <figcaption><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></figcaption>
      </figure>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------- gallery --- */

export const gallery: SiteComponent = (ctx) => {
  const items = ctx.business.gallery.slice(0, 6);
  if (items.length === 0) return "";
  return `<section class="nx-section" id="gallery">
  <div class="nx-container">
    <p class="nx-eyebrow">Gallery</p>
    <h2 class="nx-h2">A look inside ${esc(ctx.business.name)}</h2>
    <div class="nx-gallery">
      ${items
        .map(
          (g) => `<figure class="nx-gallery__item" style="--hue:${g.hue}">
        <div class="nx-gallery__ph" role="img" aria-label="${esc(g.title)}"></div>
        <figcaption>${esc(g.caption)}</figcaption>
      </figure>`,
        )
        .join("")}
    </div>
    <p class="nx-note">Images shown are placeholders — the live site uses the client's own photography.</p>
  </div>
</section>`;
};

/* -------------------------------------------------------------- pricing --- */

export const pricing: SiteComponent = (ctx) => {
  const products = ctx.business.products;
  const courses = ctx.business.courses;
  const source: Array<{ name: string; price: string; description: string; tag?: string }> =
    products.length > 0
      ? products
      : courses.map((c) => ({ name: c.name, price: c.fee, description: c.description }));
  if (source.length === 0) return "";
  const isCourses = products.length === 0;
  return `<section class="nx-section nx-section--alt" id="pricing">
  <div class="nx-container">
    <p class="nx-eyebrow">${isCourses ? "Programmes" : "Pricing"}</p>
    <h2 class="nx-h2">${isCourses ? "Courses & fees" : "Straightforward pricing"}</h2>
    <div class="nx-grid nx-grid--3">
      ${source
        .slice(0, 6)
        .map(
          (p) => `<article class="nx-card nx-card--price">
        ${"tag" in p && p.tag ? `<span class="nx-badge">${esc(p.tag)}</span>` : ""}
        <h3 class="nx-card__title">${esc(p.name)}</h3>
        <p class="nx-price">${esc(p.price)}</p>
        <p class="nx-card__text">${esc(p.description)}</p>
        <a class="nx-btn nx-btn--primary" href="contact.html">Enquire</a>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

/* ----------------------------------------------------------------- team --- */

export const team: SiteComponent = (ctx) => {
  const items = ctx.business.team.slice(0, 4);
  if (items.length === 0) return "";
  return `<section class="nx-section" id="team">
  <div class="nx-container">
    <p class="nx-eyebrow">The people</p>
    <h2 class="nx-h2">Who you'll be working with</h2>
    <div class="nx-grid nx-grid--4">
      ${items
        .map(
          (t) => `<article class="nx-person">
        <div class="nx-person__avatar" aria-hidden="true">${esc(t.name.slice(0, 1))}</div>
        <h3 class="nx-person__name">${esc(t.name)}</h3>
        <p class="nx-person__role">${esc(t.role)}</p>
        <p class="nx-person__bio">${esc(t.bio)}</p>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------- timeline --- */

export const timeline: SiteComponent = (ctx) => {
  const items = ctx.business.timeline.slice(0, 5);
  if (items.length === 0) return "";
  return `<section class="nx-section nx-section--alt">
  <div class="nx-container">
    <p class="nx-eyebrow">How it works</p>
    <h2 class="nx-h2">A simple, predictable process</h2>
    <ol class="nx-timeline">
      ${items
        .map(
          (t, i) => `<li class="nx-timeline__item">
        <span class="nx-timeline__num tnum">${i + 1}</span>
        <div><h3>${esc(t.title)}</h3><p>${esc(t.detail)}</p></div>
      </li>`,
        )
        .join("")}
    </ol>
  </div>
</section>`;
};

/* ------------------------------------------------------------------ faq --- */

export const faq: SiteComponent = (ctx) => {
  const items = ctx.business.faqs.slice(0, 6);
  if (items.length === 0) return "";
  return `<section class="nx-section" id="faq">
  <div class="nx-container nx-container--narrow">
    <p class="nx-eyebrow">Questions</p>
    <h2 class="nx-h2">Frequently asked</h2>
    <div class="nx-faq">
      ${items
        .map(
          (f, i) => `<details class="nx-faq__item"${i === 0 ? " open" : ""}>
        <summary>${esc(f.q)}</summary>
        <p>${esc(f.a)}</p>
      </details>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------------ map --- */

export const map: SiteComponent = (ctx) => {
  const b = ctx.business;
  if (!b.address && !b.phone) return "";
  const maps = b.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address} ${b.city}`)}`;
  return `<section class="nx-section nx-section--alt" id="location">
  <div class="nx-container">
    <p class="nx-eyebrow">Find us</p>
    <h2 class="nx-h2">Visit ${esc(b.name)}</h2>
    <div class="nx-map">
      <div class="nx-map__frame" role="img" aria-label="Map showing ${esc(b.name)} in ${esc(b.city)}">
        <div class="nx-map__pin"></div>
        <span class="nx-map__label">${esc(b.city)}</span>
      </div>
      <div class="nx-map__meta">
        <h3>Address</h3>
        <p>${esc(b.address || b.city)}</p>
        <h3>Opening hours</h3>
        <ul class="nx-hours">${b.hours.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
        <a class="nx-btn nx-btn--primary" href="${maps}" target="_blank" rel="noopener">Open in Google Maps</a>
      </div>
    </div>
  </div>
</section>`;
};

/* -------------------------------------------------------------- contact --- */

export const contact: SiteComponent = (ctx) => {
  const b = ctx.business;
  const social = Object.entries(b.socialLinks)
    .map(
      ([k, v]) =>
        `<a class="nx-social" href="${esc(v)}" target="_blank" rel="noopener">${esc(
          k.charAt(0).toUpperCase() + k.slice(1),
        )}</a>`,
    )
    .join("");
  return `<section class="nx-section" id="contact">
  <div class="nx-container">
    <p class="nx-eyebrow">Get in touch</p>
    <h2 class="nx-h2">Let's start a conversation</h2>
    <div class="nx-contact">
      <form class="nx-form" data-nx-form novalidate>
        <div class="nx-field">
          <label for="nx-name">Your name</label>
          <input id="nx-name" name="name" type="text" autocomplete="name" required placeholder="Priya Sharma" />
        </div>
        <div class="nx-field">
          <label for="nx-phone">Phone</label>
          <input id="nx-phone" name="phone" type="tel" autocomplete="tel" placeholder="+91 …" />
        </div>
        <div class="nx-field">
          <label for="nx-email">Email</label>
          <input id="nx-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="nx-field">
          <label for="nx-message">How can we help?</label>
          <textarea id="nx-message" name="message" rows="4" placeholder="Tell us what you need…"></textarea>
        </div>
        <button class="nx-btn nx-btn--primary nx-btn--lg" type="submit">Send enquiry</button>
        <p class="nx-form__status" role="status" aria-live="polite"></p>
      </form>
      <aside class="nx-contact__aside">
        <h3>Talk to us directly</h3>
        ${b.phone ? `<a class="nx-contact__row" href="tel:${esc(phoneDigits(b.phone))}"><strong>Phone</strong><span>${esc(b.phone)}</span></a>` : ""}
        ${b.email ? `<a class="nx-contact__row" href="mailto:${esc(b.email)}"><strong>Email</strong><span>${esc(b.email)}</span></a>` : ""}
        <a class="nx-contact__row" href="${waLink(ctx, `Hi ${b.name}`)}"><strong>WhatsApp</strong><span>Message us</span></a>
        <div class="nx-contact__social">${social}</div>
        <p class="nx-note">${esc(b.address || b.city)}</p>
      </aside>
    </div>
  </div>
</section>`;
};

/* ---------------------------------------------------------- whatsapp cta --- */

export const whatsappCta: SiteComponent = (ctx) => {
  const b = ctx.business;
  return `<section class="nx-wa">
  <div class="nx-container nx-wa__inner">
    <div>
      <h2 class="nx-h2">Ready when you are</h2>
      <p>Message ${esc(b.name)} on WhatsApp and we'll reply the same day.</p>
    </div>
    <a class="nx-btn nx-btn--wa nx-btn--lg" href="${waLink(ctx, `Hi ${b.name}, I'd like to get started.`)}">
      Chat on WhatsApp
    </a>
  </div>
</section>`;
};

/* -------------------------------------------------------------- booking --- */

export const booking: SiteComponent = (ctx) => {
  const b = ctx.business;
  return `<section class="nx-section nx-section--alt" id="booking">
  <div class="nx-container nx-container--narrow">
    <p class="nx-eyebrow">Appointments</p>
    <h2 class="nx-h2">Book a slot</h2>
    <p class="nx-lead">Pick a time that suits you and we'll confirm on WhatsApp.</p>
    <form class="nx-form nx-form--inline" data-nx-form novalidate>
      <div class="nx-field">
        <label for="nx-date">Preferred date</label>
        <input id="nx-date" name="date" type="date" />
      </div>
      <div class="nx-field">
        <label for="nx-slot">Preferred time</label>
        <select id="nx-slot" name="slot">
          <option>Morning (9am – 12pm)</option>
          <option>Afternoon (12pm – 4pm)</option>
          <option>Evening (4pm – 8pm)</option>
        </select>
      </div>
      <div class="nx-field">
        <label for="nx-bname">Name</label>
        <input id="nx-bname" name="name" type="text" required placeholder="Your name" />
      </div>
      <div class="nx-field">
        <label for="nx-bphone">Phone</label>
        <input id="nx-bphone" name="phone" type="tel" placeholder="+91 …" />
      </div>
      <button class="nx-btn nx-btn--primary nx-btn--lg" type="submit">Request appointment</button>
      <p class="nx-form__status" role="status" aria-live="polite"></p>
    </form>
    <p class="nx-note">${esc(b.name)} · ${esc(b.city)}</p>
  </div>
</section>`;
};

/* --------------------------------------------------------------- footer --- */

export const footer: SiteComponent = (ctx) => {
  const b = ctx.business;
  const year = new Date().getFullYear();
  const social = Object.entries(b.socialLinks)
    .map(
      ([k, v]) =>
        `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(
          k.charAt(0).toUpperCase() + k.slice(1),
        )}</a>`,
    )
    .join("");
  return `<footer class="nx-footer">
  <div class="nx-container nx-footer__grid">
    <div>
      <p class="nx-footer__brand">${esc(b.name)}</p>
      <p class="nx-note">${esc(b.address || b.city)}</p>
    </div>
    <nav aria-label="Footer">
      <a href="index.html">Home</a>
      <a href="services.html">Services</a>
      <a href="about.html">About</a>
      <a href="contact.html">Contact</a>
    </nav>
    <div class="nx-footer__social">${social}</div>
  </div>
  <div class="nx-container nx-footer__legal">
    <p>© ${year} ${esc(b.name)}. All rights reserved.</p>
    ${
      ctx.demo
        ? `<p class="nx-footer__demo">Demo build produced by <strong>NEXORA</strong> — not a live business website.</p>`
        : ""
    }
  </div>
</footer>`;
};

/* --------------------------------------------------------------- extras --- */

export const products: SiteComponent = (ctx) => {
  const items = ctx.business.products.slice(0, 8);
  if (items.length === 0) return "";
  return `<section class="nx-section" id="products">
  <div class="nx-container">
    <p class="nx-eyebrow">Catalogue</p>
    <h2 class="nx-h2">What's in store</h2>
    <div class="nx-grid nx-grid--4">
      ${items
        .map(
          (p) => `<article class="nx-product">
        <div class="nx-product__ph" aria-hidden="true"></div>
        <h3 class="nx-product__name">${esc(p.name)}</h3>
        <p class="nx-product__price">${esc(p.price)}</p>
        <p class="nx-product__desc">${esc(p.description)}</p>
        <a class="nx-btn nx-btn--sm nx-btn--primary" href="${waLink(
          ctx,
          `Hi ${ctx.business.name}, I'm interested in ${p.name}.`,
        )}">Order on WhatsApp</a>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

export const courses: SiteComponent = (ctx) => {
  const items = ctx.business.courses.slice(0, 8);
  if (items.length === 0) return "";
  return `<section class="nx-section" id="courses">
  <div class="nx-container">
    <p class="nx-eyebrow">Academics</p>
    <h2 class="nx-h2">Courses & programmes</h2>
    <div class="nx-table" role="table" aria-label="Courses">
      <div class="nx-table__head" role="row">
        <span role="columnheader">Programme</span>
        <span role="columnheader">Duration</span>
        <span role="columnheader">Fee</span>
        <span role="columnheader"></span>
      </div>
      ${items
        .map(
          (c) => `<div class="nx-table__row" role="row">
        <span role="cell"><strong>${esc(c.name)}</strong><br /><small>${esc(c.description)}</small></span>
        <span role="cell">${esc(c.duration)}</span>
        <span role="cell">${esc(c.fee)}</span>
        <span role="cell"><a class="nx-btn nx-btn--sm" href="contact.html">Enquire</a></span>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

export const menu: SiteComponent = (ctx) => {
  const items = ctx.business.menu;
  if (items.length === 0) return "";
  return `<section class="nx-section" id="menu">
  <div class="nx-container">
    <p class="nx-eyebrow">The menu</p>
    <h2 class="nx-h2">Fresh, made to order</h2>
    ${items
      .map(
        (sec) => `<div class="nx-menu">
      <h3 class="nx-menu__section">${esc(sec.section)}</h3>
      <ul class="nx-menu__list">
        ${sec.items
          .map(
            (i) => `<li><span class="nx-menu__name">${esc(i.name)}</span><span class="nx-menu__dots" aria-hidden="true"></span><span class="nx-menu__price">${esc(
              i.price,
            )}</span>${
              i.description ? `<span class="nx-menu__desc">${esc(i.description)}</span>` : ""
            }</li>`,
          )
          .join("")}
      </ul>
    </div>`,
      )
      .join("")}
  </div>
</section>`;
};

export const admissions: SiteComponent = (ctx) => {
  const b = ctx.business;
  return `<section class="nx-section nx-section--alt" id="admissions">
  <div class="nx-container">
    <p class="nx-eyebrow">Admissions</p>
    <h2 class="nx-h2">Join the next batch</h2>
    <div class="nx-grid nx-grid--2">
      <div>
        <h3>How to apply</h3>
        <ol class="nx-timeline">
          ${b.timeline
            .slice(0, 4)
            .map(
              (t, i) => `<li class="nx-timeline__item"><span class="nx-timeline__num tnum">${
                i + 1
              }</span><div><h3>${esc(t.title)}</h3><p>${esc(t.detail)}</p></div></li>`,
            )
            .join("")}
        </ol>
      </div>
      <form class="nx-form" data-nx-form novalidate>
        <h3>Admission enquiry</h3>
        <div class="nx-field">
          <label for="nx-student">Student name</label>
          <input id="nx-student" name="student" type="text" required placeholder="Student name" />
        </div>
        <div class="nx-field">
          <label for="nx-course">Course of interest</label>
          <select id="nx-course" name="course">
            ${b.courses.map((c) => `<option>${esc(c.name)}</option>`).join("") || "<option>General enquiry</option>"}
          </select>
        </div>
        <div class="nx-field">
          <label for="nx-parent">Parent / guardian phone</label>
          <input id="nx-parent" name="phone" type="tel" placeholder="+91 …" />
        </div>
        <button class="nx-btn nx-btn--primary nx-btn--lg" type="submit">Submit enquiry</button>
        <p class="nx-form__status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
</section>`;
};

export const reviews: SiteComponent = (ctx) => {
  const items = ctx.business.testimonials.slice(0, 6);
  if (items.length === 0) return "";
  return `<section class="nx-section nx-section--alt" id="reviews">
  <div class="nx-container">
    <p class="nx-eyebrow">Reviews</p>
    <h2 class="nx-h2">What people say</h2>
    <div class="nx-grid nx-grid--3">
      ${items
        .map(
          (t) => `<figure class="nx-quote nx-quote--compact">
        <div class="nx-stars" aria-label="5 out of 5">★★★★★</div>
        <blockquote>“${esc(t.quote)}”</blockquote>
        <figcaption><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></figcaption>
      </figure>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

export const portfolio: SiteComponent = (ctx) => {
  const items = ctx.business.gallery.slice(0, 6);
  if (items.length === 0) return "";
  return `<section class="nx-section" id="portfolio">
  <div class="nx-container">
    <p class="nx-eyebrow">Selected work</p>
    <h2 class="nx-h2">Recent projects</h2>
    <div class="nx-grid nx-grid--3">
      ${items
        .map(
          (g) => `<article class="nx-work">
        <div class="nx-work__ph" style="--hue:${g.hue}" aria-hidden="true"></div>
        <h3>${esc(g.title)}</h3>
        <p>${esc(g.caption)}</p>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
};

export const cta: SiteComponent = (ctx) => {
  const b = ctx.business;
  return `<section class="nx-cta">
  <div class="nx-container nx-cta__inner">
    <h2 class="nx-h2">Work with ${esc(b.name)}</h2>
    <p>${esc(b.usp[0] ?? `Serving ${b.city} with reliable, professional service.`)}</p>
    <div class="nx-cta__actions">
      <a class="nx-btn nx-btn--primary nx-btn--lg" href="${waLink(
        ctx,
        `Hi ${b.name}, I'd like to work with you.`,
      )}">Message us</a>
      <a class="nx-btn nx-btn--ghost nx-btn--lg" href="contact.html">Contact details</a>
    </div>
  </div>
</section>`;
};

/* -------------------------------------------------------------- registry -- */

export const COMPONENTS: Record<string, SiteComponent> = {
  navbar,
  hero,
  services,
  features,
  stats,
  testimonials,
  gallery,
  pricing,
  team,
  timeline,
  faq,
  map,
  contact,
  whatsappCta,
  booking,
  footer,
  products,
  courses,
  menu,
  admissions,
  reviews,
  portfolio,
  cta,
};

export const COMPONENT_KEYS = Object.keys(COMPONENTS);

export function renderComponent(key: string, ctx: ComponentContext): string {
  const c = COMPONENTS[key];
  if (!c) return `<!-- unknown component: ${esc(key)} -->`;
  return c(ctx);
}
