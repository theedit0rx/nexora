/* ==========================================================================
   NEXORA — Website Generation Engine: types
   ========================================================================== */

export interface SiteTheme {
  palette: string;
  primary: string;
  primaryDark: string;
  accent: string;
  neutral: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  fontHeading: string;
  fontBody: string;
  radius: string;
  radiusLg: string;
  mood: string;
}

export interface SiteBusiness {
  name: string;
  category: string;
  subcategory?: string;
  city: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  mapsUrl?: string | null;
  rating: number | null;
  reviewCount?: number | null;
  socialLinks: Record<string, string>;
  services: string[];
  about: string;
  tagline: string;
  usp: string[];
  hours: string[];
  faqs: Array<{ q: string; a: string }>;
  testimonials: Array<{ name: string; role: string; quote: string }>;
  gallery: Array<{ title: string; caption: string; hue: number }>;
  stats: Array<{ value: string; label: string }>;
  products: Array<{ name: string; price: string; description: string; tag?: string }>;
  courses: Array<{ name: string; duration: string; fee: string; description: string }>;
  menu: Array<{ section: string; items: Array<{ name: string; price: string; description: string }> }>;
  team: Array<{ name: string; role: string; bio: string }>;
  timeline: Array<{ title: string; detail: string }>;
  faqImages: string[];
  keywords: string[];
}

export interface ComponentContext {
  business: SiteBusiness;
  theme: SiteTheme;
  page: string;
  /** Whether this is a demo build (shows the NEXORA attribution bar). */
  demo: boolean;
}

export type SiteComponent = (ctx: ComponentContext) => string;

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationResult {
  files: GeneratedFile[];
  pages: string[];
  componentsUsed: string[];
}
