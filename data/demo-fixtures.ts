import type { DiscoveredBusiness } from "../lib/providers/lead-sources";

/* ==========================================================================
   NEXORA — Demo fixtures
   --------------------------------------------------------------------------
   Realistic FICTIONAL businesses used to populate Demo Mode. These are
   kept strictly separate from production data: the whole demo dataset is
   written under a demo-only organisation and can be reset at any time.
   ========================================================================== */

export interface DemoBusiness {
  name: string;
  category: string;
  subcategory: string;
  city: string;
  region: string;
  country: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  mapsUrl: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  reviewCount: number;
  socialLinks: Record<string, string>;
  discoverySource: DiscoveredBusiness["discoverySource"];
  /** Signals the audit + research agents will "discover" for this business. */
  siteProfile: {
    hasWebsite: boolean;
    reachable: boolean;
    https: boolean;
    responsive: boolean;
    hasNav: boolean;
    hasForm: boolean;
    hasWhatsapp: boolean;
    hasBooking: boolean;
    hasEcommerce: boolean;
    hasMeta: boolean;
    hasSocial: boolean;
    legacy: boolean;
    seoScore: number;
    perfScore: number;
    a11yScore: number;
  };
  services: string[];
  /** Stage this lead should appear in on the demo board. */
  demoStage:
    | "DISCOVERED"
    | "RESEARCHING"
    | "AUDITED"
    | "QUALIFIED"
    | "STRATEGY"
    | "DEMO_READY"
    | "OUTREACH"
    | "REPLIED"
    | "INTERESTED"
    | "PROPOSAL"
    | "NEGOTIATION"
    | "WON"
    | "LOST";
  /** Inbound prospect message (triggers the Sales agent). */
  inbound?: string;
  notes: string;
}

export const DEMO_BUSINESSES: DemoBusiness[] = [
  {
    name: "Royal Spice Restaurant",
    category: "Restaurant",
    subcategory: "North Indian",
    city: "Lucknow",
    region: "Uttar Pradesh",
    country: "India",
    address: "12 Hazratganj Main Road, Lucknow 226001",
    latitude: 26.8467,
    longitude: 80.9462,
    website: "https://royalspice-demo.example.com",
    mapsUrl: "https://maps.google.com/?q=Royal+Spice+Restaurant+Lucknow",
    phone: "+91 98765 43210",
    email: "hello@royalspice-demo.example.com",
    rating: 4.3,
    reviewCount: 412,
    socialLinks: { instagram: "https://instagram.com/royalspice-demo" },
    discoverySource: "GOOGLE_PLACES",
    siteProfile: {
      hasWebsite: true,
      reachable: true,
      https: false,
      responsive: false,
      hasNav: true,
      hasForm: false,
      hasWhatsapp: false,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: true,
      hasSocial: false,
      legacy: true,
      seoScore: 38,
      perfScore: 34,
      a11yScore: 40,
    },
    services: ["Dine-in", "Takeaway", "Home delivery", "Party orders", "Catering"],
    demoStage: "DEMO_READY",
    inbound:
      "Hi, I saw the website you made for us — it looks great. How much would it cost to add online ordering to it?",
    notes: "Established family restaurant, high review volume, no WhatsApp or booking path on the current site.",
  },
  {
    name: "Vertex Coaching Academy",
    category: "Coaching Institute",
    subcategory: "Competitive exam preparation",
    city: "Lucknow",
    region: "Uttar Pradesh",
    country: "India",
    address: "Sector B, Mahanagar, Lucknow 226006",
    latitude: 26.8731,
    longitude: 80.9481,
    website: "https://vertexacademy-demo.example.com",
    mapsUrl: "https://maps.google.com/?q=Vertex+Coaching+Academy+Lucknow",
    phone: "+91 91234 56780",
    email: "admissions@vertexacademy-demo.example.com",
    rating: 4.6,
    reviewCount: 187,
    socialLinks: { youtube: "https://youtube.com/@vertexacademy-demo", instagram: "https://instagram.com/vertexacademy-demo" },
    discoverySource: "WEB_SEARCH",
    siteProfile: {
      hasWebsite: true,
      reachable: true,
      https: true,
      responsive: true,
      hasNav: true,
      hasForm: true,
      hasWhatsapp: false,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: true,
      hasSocial: true,
      legacy: false,
      seoScore: 55,
      perfScore: 62,
      a11yScore: 58,
    },
    services: ["Classroom coaching", "Test series", "Doubt sessions", "Online batches"],
    demoStage: "PROPOSAL",
    inbound:
      "The proposal looks reasonable. Can we do it in two instalments instead of three? Also, can you include the student portal?",
    notes: "Strong reputation, site exists but has no admissions funnel and no WhatsApp capture.",
  },
  {
    name: "UrbanFit Gym",
    category: "Gym",
    subcategory: "Strength & conditioning",
    city: "Lucknow",
    region: "Uttar Pradesh",
    country: "India",
    address: "Gomti Nagar Vistar, Lucknow 226010",
    latitude: 26.856,
    longitude: 81.021,
    website: null,
    mapsUrl: "https://maps.google.com/?q=UrbanFit+Gym+Lucknow",
    phone: "+91 90011 22334",
    email: null,
    rating: 4.1,
    reviewCount: 96,
    socialLinks: { instagram: "https://instagram.com/urbanfit-demo" },
    discoverySource: "GOOGLE_PLACES",
    siteProfile: {
      hasWebsite: false,
      reachable: false,
      https: false,
      responsive: false,
      hasNav: false,
      hasForm: false,
      hasWhatsapp: false,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: false,
      hasSocial: false,
      legacy: false,
      seoScore: 0,
      perfScore: 0,
      a11yScore: 0,
    },
    services: ["Strength training", "Personal training", "Group classes", "Nutrition guidance"],
    demoStage: "DISCOVERED",
    notes: "No website at all — 96 reviews on the listing is real demand with nowhere to land.",
  },
  {
    name: "BrightSmile Dental Studio",
    category: "Dental Clinic",
    subcategory: "Cosmetic & general dentistry",
    city: "Kanpur",
    region: "Uttar Pradesh",
    country: "India",
    address: "14 Mall Road, Kanpur 208001",
    latitude: 26.4499,
    longitude: 80.3319,
    website: "https://brightsmile-demo.example.com",
    mapsUrl: "https://maps.google.com/?q=BrightSmile+Dental+Kanpur",
    phone: "+91 88888 77766",
    email: "care@brightsmile-demo.example.com",
    rating: 4.8,
    reviewCount: 264,
    socialLinks: { facebook: "https://facebook.com/brightsmile-demo" },
    discoverySource: "CSV_IMPORT",
    siteProfile: {
      hasWebsite: true,
      reachable: true,
      https: true,
      responsive: true,
      hasNav: true,
      hasForm: false,
      hasWhatsapp: false,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: false,
      hasSocial: false,
      legacy: false,
      seoScore: 42,
      perfScore: 71,
      a11yScore: 45,
    },
    services: ["General dentistry", "Cosmetic dentistry", "Orthodontics", "Implants", "Pediatric dentistry"],
    demoStage: "INTERESTED",
    inbound:
      "Yes please — we definitely need online appointment booking. Can you also add a before/after gallery? What's the timeline?",
    notes: "High rating, no booking flow, no metadata. Classic appointment-driven upsell.",
  },
  {
    name: "Oakline Interiors",
    category: "Interior Designer",
    subcategory: "Residential & commercial",
    city: "Noida",
    region: "Uttar Pradesh",
    country: "India",
    address: "Sector 62, Noida 201309",
    latitude: 28.627,
    longitude: 77.372,
    website: "https://oakline-demo.example.com",
    mapsUrl: "https://maps.google.com/?q=Oakline+Interiors+Noida",
    phone: "+91 77766 55544",
    email: "studio@oakline-demo.example.com",
    rating: 4.5,
    reviewCount: 73,
    socialLinks: { instagram: "https://instagram.com/oakline-demo", linkedin: "https://linkedin.com/company/oakline-demo" },
    discoverySource: "WEB_SEARCH",
    siteProfile: {
      hasWebsite: true,
      reachable: false,
      https: true,
      responsive: true,
      hasNav: true,
      hasForm: true,
      hasWhatsapp: false,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: true,
      hasSocial: true,
      legacy: false,
      seoScore: 60,
      perfScore: 0,
      a11yScore: 55,
    },
    services: ["Interior design", "Turnkey execution", "Modular kitchens", "Space planning"],
    demoStage: "WON",
    notes: "Won client — the demo became the production build. Website is now deployed.",
  },
  {
    name: "Voyage Travel Co.",
    category: "Travel Agency",
    subcategory: "Holidays & corporate travel",
    city: "Lucknow",
    region: "Uttar Pradesh",
    country: "India",
    address: "Nishatganj, Lucknow 226007",
    latitude: 26.8673,
    longitude: 80.9142,
    website: "https://voyagetravel-demo.example.com",
    mapsUrl: "https://maps.google.com/?q=Voyage+Travel+Lucknow",
    phone: "+91 93355 12211",
    email: "book@voyagetravel-demo.example.com",
    rating: 4.2,
    reviewCount: 141,
    socialLinks: { instagram: "https://instagram.com/voyage-demo" },
    discoverySource: "GOOGLE_PLACES",
    siteProfile: {
      hasWebsite: true,
      reachable: true,
      https: true,
      responsive: false,
      hasNav: true,
      hasForm: false,
      hasWhatsapp: true,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: false,
      hasSocial: true,
      legacy: true,
      seoScore: 30,
      perfScore: 45,
      a11yScore: 35,
    },
    services: ["Holiday packages", "Flight tickets", "Hotel booking", "Visa assistance"],
    demoStage: "REPLIED",
    inbound: "Not right now — we're mid-way through our own rebrand. Maybe check back in a few months?",
    notes: "Currently lost for now — polite decline, good candidate for a follow-up sequence.",
  },
  {
    name: "Sharma Hardware & Paints",
    category: "Retail Store",
    subcategory: "Hardware and paints",
    city: "Lucknow",
    region: "Uttar Pradesh",
    country: "India",
    address: "Chowk Road, Lucknow 226003",
    latitude: 26.858,
    longitude: 80.901,
    website: null,
    mapsUrl: "https://maps.google.com/?q=Sharma+Hardware+Lucknow",
    phone: "+91 94150 77889",
    email: null,
    rating: 4.0,
    reviewCount: 58,
    socialLinks: {},
    discoverySource: "MANUAL",
    siteProfile: {
      hasWebsite: false,
      reachable: false,
      https: false,
      responsive: false,
      hasNav: false,
      hasForm: false,
      hasWhatsapp: false,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: false,
      hasSocial: false,
      legacy: false,
      seoScore: 0,
      perfScore: 0,
      a11yScore: 0,
    },
    services: ["Paints", "Tools", "Plumbing", "Electrical", "Bulk supply"],
    demoStage: "AUDITED",
    notes: "No website, no email — phone-only outreach. Retail catalogue with WhatsApp ordering fits well.",
  },
  {
    name: "Aaradhya Beauty Salon",
    category: "Beauty Salon",
    subcategory: "Hair, skin & bridal",
    city: "Kanpur",
    region: "Uttar Pradesh",
    country: "India",
    address: "Swaroop Nagar, Kanpur 208002",
    latitude: 26.4701,
    longitude: 80.3193,
    website: "https://aaradhya-demo.example.com",
    mapsUrl: "https://maps.google.com/?q=Aaradhya+Beauty+Salon+Kanpur",
    phone: "+91 88557 44223",
    email: "book@aaradhya-demo.example.com",
    rating: 4.7,
    reviewCount: 322,
    socialLinks: { instagram: "https://instagram.com/aaradhya-demo" },
    discoverySource: "GOOGLE_PLACES",
    siteProfile: {
      hasWebsite: true,
      reachable: true,
      https: false,
      responsive: true,
      hasNav: true,
      hasForm: true,
      hasWhatsapp: false,
      hasBooking: false,
      hasEcommerce: false,
      hasMeta: true,
      hasSocial: true,
      legacy: false,
      seoScore: 48,
      perfScore: 58,
      a11yScore: 50,
    },
    services: ["Hair styling", "Hair colour", "Skin care", "Bridal makeup", "Nails"],
    demoStage: "QUALIFIED",
    notes: "High review volume, appointment-driven, no online booking.",
  },
];

export const DEMO_ORG = {
  name: "NEXORA Demo Agency",
  slug: "nexora-demo",
  ownerName: "Sajid Raza",
  ownerEmail: "owner@nexora.demo",
};

export const DEMO_USER = {
  email: "owner@nexora.demo",
  password: "nexora-demo",
  fullName: "Sajid Raza",
};
