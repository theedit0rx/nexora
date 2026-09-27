/* ==========================================================================
   NEXORA — Onboarding field catalogue
   --------------------------------------------------------------------------
   Kept in its own dependency-free module so it can be imported from client
   components (the onboarding form) as well as from the Sales agent, which
   pulls in `node:fs` / `node:path` through the site generator.
   ========================================================================== */

export interface OnboardingField {
  key: string;
  label: string;
  /** Relative weight used to compute the completion percentage. */
  weight: number;
}

export const ONBOARDING_FIELDS: OnboardingField[] = [
  { key: "companyName", label: "Company name", weight: 8 },
  { key: "logoUrl", label: "Logo", weight: 8 },
  { key: "brandColors", label: "Brand colours", weight: 6 },
  { key: "businessDescription", label: "Business description", weight: 10 },
  { key: "services", label: "Services list", weight: 10 },
  { key: "socialUrls", label: "Social URLs", weight: 6 },
  { key: "phone", label: "Phone", weight: 8 },
  { key: "email", label: "Email", weight: 8 },
  { key: "address", label: "Address", weight: 6 },
  { key: "images", label: "Images", weight: 8 },
  { key: "productInfo", label: "Product / service information", weight: 8 },
  { key: "preferredFeatures", label: "Preferred features", weight: 6 },
  { key: "inspiration", label: "Website inspiration", weight: 4 },
  { key: "domain", label: "Domain information", weight: 4 },
];

/** Alias kept for call sites that already import the catalogue by name. */
export const ONBOARDING_FIELD_LIST = ONBOARDING_FIELDS;
