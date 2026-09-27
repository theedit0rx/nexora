import type { PricingRule, Service } from "../db/schema";

/* ==========================================================================
   NEXORA — Pricing Rule Engine
   --------------------------------------------------------------------------
   Agents never invent prices. Every quote is derived from the owner's
   configured services and pricing rules, so the Proposal Agent produces
   deterministic, auditable numbers.
   ========================================================================== */

export interface PriceRequest {
  serviceKey: string;
  pages?: number;
  features?: string[];
  ecommerce?: boolean;
  cms?: boolean;
  booking?: boolean;
  advancedAnimation?: boolean;
  customDashboard?: boolean;
  aiFunctionality?: boolean;
  rush?: boolean;
  maintenanceMonths?: number;
  discountPercent?: number;
}

export interface PriceLine {
  key: string;
  label: string;
  amount: number;
  kind: "BASE" | "PAGE" | "ADDON" | "MAINTENANCE" | "DISCOUNT";
  description: string;
}

export interface PriceQuote {
  lines: PriceLine[];
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  discountPercent: number;
  discountApprovalRequired: boolean;
  maxDiscountPercent: number;
  estimatedDeliveryDays: number;
}

const FEATURE_RULE_KEYS: Record<string, string> = {
  ecommerce: "ecommerce",
  cms: "cms",
  booking: "booking",
  advancedAnimation: "advanced-animation",
  customDashboard: "custom-dashboard",
  aiFunctionality: "ai-functionality",
};

const FEATURE_LABELS: Record<string, string> = {
  ecommerce: "Ecommerce / online ordering",
  cms: "Content management system",
  booking: "Booking & appointments",
  advancedAnimation: "Advanced animation & motion",
  customDashboard: "Custom dashboard",
  aiFunctionality: "AI functionality",
};

export function computePrice(
  req: PriceRequest,
  services: Service[],
  rules: PricingRule[],
  currency = "INR",
): PriceQuote {
  const service = services.find((s) => s.key === req.serviceKey) ?? services[0];
  const active = rules.filter((r) => r.active);
  const lines: PriceLine[] = [];
  const deliveryDays = service?.estimatedDeliveryDays ?? 14;

  if (service) {
    lines.push({
      key: `base:${service.key}`,
      label: service.name,
      amount: service.basePrice,
      kind: "BASE",
      description: service.description,
    });
  }

  const extraPages = Math.max(0, (req.pages ?? 4) - 4);
  const pageRule = active.find((r) => r.kind === "PAGE");
  if (pageRule && extraPages > 0) {
    const amount = pageRule.unit === "PER_PAGE" ? pageRule.price * extraPages : pageRule.price;
    lines.push({
      key: `pages:${pageRule.key}`,
      label: `${extraPages} additional page${extraPages === 1 ? "" : "s"}`,
      amount,
      kind: "PAGE",
      description: pageRule.description,
    });
  }

  const featureFlags: Array<[string, boolean]> = [
    ["ecommerce", Boolean(req.ecommerce)],
    ["cms", Boolean(req.cms)],
    ["booking", Boolean(req.booking)],
    ["advancedAnimation", Boolean(req.advancedAnimation)],
    ["customDashboard", Boolean(req.customDashboard)],
    ["aiFunctionality", Boolean(req.aiFunctionality)],
  ];
  for (const [flag, on] of featureFlags) {
    if (!on) continue;
    const ruleKey = FEATURE_RULE_KEYS[flag];
    const rule = active.find((r) => r.key === ruleKey);
    if (rule) {
      lines.push({
        key: `feature:${rule.key}`,
        label: FEATURE_LABELS[flag] ?? flag,
        amount: rule.price,
        kind: "ADDON",
        description: rule.description,
      });
    }
  }
  for (const f of req.features ?? []) {
    const rule = active.find((r) => r.key === f || r.label.toLowerCase() === f.toLowerCase());
    if (rule && !lines.some((l) => l.key === `feature:${rule.key}`)) {
      lines.push({
        key: `feature:${rule.key}`,
        label: rule.label,
        amount: rule.price,
        kind: "ADDON",
        description: rule.description,
      });
    }
  }

  const rushRule = active.find((r) => r.kind === "RUSH");
  if (req.rush && rushRule) {
    lines.push({
      key: `rush:${rushRule.key}`,
      label: rushRule.label,
      amount: rushRule.price,
      kind: "ADDON",
      description: rushRule.description,
    });
  }

  const months = req.maintenanceMonths ?? 0;
  const maintenanceRule = active.find((r) => r.kind === "MAINTENANCE");
  if (maintenanceRule && months > 0) {
    const amount =
      maintenanceRule.unit === "PER_MONTH" ? maintenanceRule.price * months : maintenanceRule.price;
    lines.push({
      key: `maintenance:${maintenanceRule.key}`,
      label: `${months} month${months === 1 ? "" : "s"} — ${maintenanceRule.label}`,
      amount,
      kind: "MAINTENANCE",
      description: maintenanceRule.description,
    });
  }

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const maxDiscount = maintenanceRule?.maxDiscountPercent ?? 15;
  const discountRule = active.find((r) => r.kind === "DISCOUNT");
  const limit = discountRule?.maxDiscountPercent ?? maxDiscount;
  const requestedDiscount = Math.max(0, Math.min(100, req.discountPercent ?? 0));
  const effectiveDiscount = Math.min(requestedDiscount, limit);
  const discount = Math.round((subtotal * effectiveDiscount) / 100);

  if (discount > 0) {
    lines.push({
      key: "discount",
      label: `Discount (${effectiveDiscount}%)`,
      amount: -discount,
      kind: "DISCOUNT",
      description:
        requestedDiscount > limit
          ? `Requested ${requestedDiscount}% exceeds the configured ${limit}% limit — approval required.`
          : `Approved within the ${limit}% limit.`,
    });
  }

  const rushDays = req.rush ? Math.max(1, Math.round(deliveryDays * 0.6)) : deliveryDays;

  return {
    lines,
    subtotal,
    discount,
    total: subtotal - discount,
    currency,
    discountPercent: effectiveDiscount,
    discountApprovalRequired: requestedDiscount > limit,
    maxDiscountPercent: limit,
    estimatedDeliveryDays: rushDays,
  };
}

/** Default service catalogue installed on first run. */
export const DEFAULT_SERVICES: Array<Omit<Service, "id" | "organizationId" | "createdAt" | "updatedAt">> = [
  {
    key: "business-website",
    name: "Business Website",
    description: "A professional multi-page website that explains what you do and turns visitors into enquiries.",
    basePrice: 24999,
    estimatedDeliveryDays: 10,
    features: ["Up to 5 pages", "Mobile-first design", "Contact form + WhatsApp", "Basic SEO setup", "Google Maps"],
    upgrades: [
      { id: "upg-blog", label: "Blog / news section", price: 6000 },
      { id: "upg-cms", label: "Self-editable CMS", price: 9000 },
      { id: "upg-copy", label: "Professional copywriting", price: 7000 },
    ],
    active: true,
  },
  {
    key: "landing-page",
    name: "Landing Page",
    description: "A single high-converting page for a campaign, product launch or offer.",
    basePrice: 11999,
    estimatedDeliveryDays: 5,
    features: ["One long-form page", "Lead capture form", "Analytics ready", "A/B friendly structure"],
    upgrades: [
      { id: "upg-lp-copy", label: "Conversion copywriting", price: 5000 },
      { id: "upg-lp-ads", label: "Ad campaign landing variants", price: 4000 },
    ],
    active: true,
  },
  {
    key: "ecommerce",
    name: "Ecommerce Store",
    description: "Sell online with catalogue, cart, checkout and order management.",
    basePrice: 64999,
    estimatedDeliveryDays: 25,
    features: ["Product catalogue", "Cart & checkout", "Payment gateway", "Order dashboard", "WhatsApp ordering"],
    upgrades: [
      { id: "upg-ec-import", label: "Bulk product import", price: 12000 },
      { id: "upg-ec-ship", label: "Shipping integrations", price: 15000 },
    ],
    active: true,
  },
  {
    key: "restaurant-website",
    name: "Restaurant Website",
    description: "Menu, reservations, gallery, reviews and WhatsApp ordering.",
    basePrice: 21999,
    estimatedDeliveryDays: 9,
    features: ["Digital menu", "Reservations", "Gallery", "Reviews", "WhatsApp ordering", "Location & hours"],
    upgrades: [
      { id: "upg-res-order", label: "Online ordering flow", price: 18000 },
      { id: "upg-res-en", label: "Bilingual menu", price: 6000 },
    ],
    active: true,
  },
  {
    key: "institute-website",
    name: "Institute / School Website",
    description: "Courses, admissions enquiry, faculty, notices, results and gallery.",
    basePrice: 29999,
    estimatedDeliveryDays: 14,
    features: ["Courses & fees", "Admission enquiry form", "Faculty pages", "Notices & results", "Gallery"],
    upgrades: [
      { id: "upg-inst-portal", label: "Student/parent portal", price: 35000 },
      { id: "upg-inst-pay", label: "Fee payment integration", price: 22000 },
    ],
    active: true,
  },
  {
    key: "website-redesign",
    name: "Website Redesign",
    description: "Rebuild an outdated site with modern design, speed and conversion focus.",
    basePrice: 27999,
    estimatedDeliveryDays: 12,
    features: ["Design refresh", "Content migration", "Speed optimisation", "SEO preservation", "Redirects"],
    upgrades: [
      { id: "upg-rd-brand", label: "Brand identity refresh", price: 15000 },
      { id: "upg-rd-photo", label: "Photography direction", price: 8000 },
    ],
    active: true,
  },
  {
    key: "ai-chatbot",
    name: "AI Chatbot",
    description: "A trained assistant that answers customer questions and captures leads 24/7.",
    basePrice: 34999,
    estimatedDeliveryDays: 12,
    features: ["Knowledge base training", "Website embed", "Lead capture", "Handover to human", "Conversation logs"],
    upgrades: [
      { id: "upg-ai-wa", label: "WhatsApp channel", price: 18000 },
      { id: "upg-ai-analytics", label: "Conversation analytics", price: 12000 },
    ],
    active: true,
  },
  {
    key: "seo-setup",
    name: "SEO Setup",
    description: "Technical SEO, on-page optimisation and local search presence.",
    basePrice: 17999,
    estimatedDeliveryDays: 10,
    features: ["Technical audit", "On-page optimisation", "Local SEO", "Schema markup", "Search Console setup"],
    upgrades: [
      { id: "upg-seo-content", label: "Monthly content package", price: 12000 },
      { id: "upg-seo-links", label: "Link building", price: 20000 },
    ],
    active: true,
  },
  {
    key: "website-maintenance",
    name: "Website Maintenance",
    description: "Monthly updates, backups, uptime monitoring and small content changes.",
    basePrice: 4999,
    estimatedDeliveryDays: 3,
    features: ["Monthly content changes", "Backups", "Uptime monitoring", "Security updates", "Priority support"],
    upgrades: [
      { id: "upg-maint-extra", label: "Extra change requests", price: 3000 },
    ],
    active: true,
  },
  {
    key: "automation-setup",
    name: "Automation Setup",
    description: "Connect your tools and remove repetitive manual work.",
    basePrice: 39999,
    estimatedDeliveryDays: 15,
    features: ["Process mapping", "Workflow automation", "CRM setup", "Notifications", "Documentation"],
    upgrades: [
      { id: "upg-auto-ai", label: "AI-assisted workflows", price: 25000 },
    ],
    active: true,
  },
];

/** Default pricing rules installed on first run. */
export const DEFAULT_PRICING_RULES: Array<Omit<PricingRule, "id" | "organizationId">> = [
  {
    key: "extra-page",
    label: "Additional page",
    kind: "PAGE",
    price: 3500,
    unit: "PER_PAGE",
    active: true,
    maxDiscountPercent: 15,
    description: "Each page beyond the first four included in the base service.",
  },
  {
    key: "ecommerce",
    label: "Ecommerce / online ordering",
    kind: "FEATURE",
    price: 28000,
    unit: "FLAT",
    active: true,
    maxDiscountPercent: 15,
    description: "Catalogue, cart, checkout and order management.",
  },
  {
    key: "cms",
    label: "Content management system",
    kind: "FEATURE",
    price: 9000,
    unit: "FLAT",
    active: true,
    maxDiscountPercent: 15,
    description: "Self-editable content without touching code.",
  },
  {
    key: "booking",
    label: "Booking & appointments",
    kind: "FEATURE",
    price: 8000,
    unit: "FLAT",
    active: true,
    maxDiscountPercent: 15,
    description: "Slot booking with confirmations.",
  },
  {
    key: "advanced-animation",
    label: "Advanced animation & motion",
    kind: "FEATURE",
    price: 12000,
    unit: "FLAT",
    active: true,
    maxDiscountPercent: 15,
    description: "Scroll choreography, transitions and micro-interactions.",
  },
  {
    key: "custom-dashboard",
    label: "Custom dashboard",
    kind: "FEATURE",
    price: 45000,
    unit: "FLAT",
    active: true,
    maxDiscountPercent: 15,
    description: "Private authenticated area with reporting.",
  },
  {
    key: "ai-functionality",
    label: "AI functionality",
    kind: "FEATURE",
    price: 35000,
    unit: "FLAT",
    active: true,
    maxDiscountPercent: 15,
    description: "AI assistant, content generation or smart search.",
  },
  {
    key: "rush-delivery",
    label: "Urgent delivery",
    kind: "RUSH",
    price: 12000,
    unit: "FLAT",
    active: true,
    maxDiscountPercent: 15,
    description: "Compressed timeline with priority scheduling.",
  },
  {
    key: "maintenance",
    label: "Maintenance plan",
    kind: "MAINTENANCE",
    price: 4999,
    unit: "PER_MONTH",
    active: true,
    maxDiscountPercent: 15,
    description: "Monthly updates, backups and support.",
  },
  {
    key: "discount-limit",
    label: "Discount ceiling",
    kind: "DISCOUNT",
    price: 0,
    unit: "PERCENT",
    active: true,
    maxDiscountPercent: 15,
    description: "Maximum discount the agents may apply without owner approval.",
  },
];
