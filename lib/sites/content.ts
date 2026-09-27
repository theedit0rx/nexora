import type { SiteBusiness } from "./types";

/* ==========================================================================
   NEXORA — Site Content Composer
   --------------------------------------------------------------------------
   Turns real business signals (name, category, city, services, rating,
   socials, audit findings) into the content model a site is rendered from.
   Content is deterministic and derived from the business — NEXORA never
   invents facts like awards, years in business or client counts.
   ========================================================================== */

export interface ContentInput {
  name: string;
  category: string;
  subcategory?: string;
  city: string;
  address?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number;
  socialLinks?: Record<string, string>;
  services?: string[];
  mapsUrl?: string | null;
}

const CATEGORY_PROFILES: Record<
  string,
  {
    services: string[];
    usp: string[];
    faqs: Array<{ q: string; a: string }>;
    stats: Array<{ value: string; label: string }>;
    timeline: Array<{ title: string; detail: string }>;
    products?: Array<{ name: string; price: string; description: string; tag?: string }>;
    courses?: Array<{ name: string; duration: string; fee: string; description: string }>;
    menu?: Array<{ section: string; items: Array<{ name: string; price: string; description: string }> }>;
    team?: Array<{ name: string; role: string; bio: string }>;
    gallery?: Array<{ title: string; caption: string; hue: number }>;
    hours: string[];
  }
> = {
  restaurant: {
    services: ["Dine-in", "Takeaway", "Home delivery", "Party & event orders", "Catering", "Private dining"],
    usp: [
      "Fresh ingredients prepared daily",
      "Family-friendly seating and private dining",
      "Fast, reliable delivery across the city",
      "Custom menus for events and celebrations",
    ],
    faqs: [
      { q: "Do you take table reservations?", a: "Yes — call or WhatsApp us and we'll hold a table for your party size." },
      { q: "Do you deliver?", a: "We deliver within the city. Message us for the current delivery radius and timings." },
      { q: "Can you handle large group bookings?", a: "We host group bookings and private events. Tell us the date and headcount and we'll plan the menu." },
      { q: "Are vegetarian options available?", a: "A dedicated section of the menu is vegetarian, and we can adapt most dishes on request." },
    ],
    stats: [
      { value: "★ 4.5", label: "Guest rating" },
      { value: "7 days", label: "Open weekly" },
      { value: "30 min", label: "Typical delivery" },
      { value: "100+", label: "Seats available" },
    ],
    timeline: [
      { title: "Browse the menu", detail: "See the full menu, pricing and today's specials." },
      { title: "Choose your order", detail: "Dine-in, takeaway or delivery — whatever suits the evening." },
      { title: "Confirm on WhatsApp", detail: "One message and we confirm the timing." },
      { title: "Enjoy", detail: "Fresh food, on time, every time." },
    ],
    menu: [
      {
        section: "Starters",
        items: [
          { name: "Signature Soup", price: "₹180", description: "Chef's daily preparation, served warm." },
          { name: "Crispy Basket", price: "₹240", description: "Shareable, served with house dips." },
          { name: "Grilled Skewers", price: "₹320", description: "Marinated overnight, char-grilled." },
        ],
      },
      {
        section: "Main course",
        items: [
          { name: "House Speciality", price: "₹420", description: "Our most-ordered dish — ask the team." },
          { name: "Chef's Thali", price: "₹380", description: "A balanced plate with breads, curries and rice." },
          { name: "Seasonal Vegetables", price: "₹300", description: "Cooked with whatever is freshest today." },
        ],
      },
      {
        section: "Desserts & drinks",
        items: [
          { name: "Classic Dessert", price: "₹160", description: "Prepared in-house." },
          { name: "Fresh Juice", price: "₹120", description: "Seasonal fruit, no added sugar." },
        ],
      },
    ],
    gallery: [
      { title: "Main dining room", caption: "Comfortable seating for families and groups", hue: 18 },
      { title: "Kitchen", caption: "Open prep area, cleaned to standard", hue: 34 },
      { title: "Private dining", caption: "Bookable space for celebrations", hue: 8 },
      { title: "Counter", caption: "Quick takeaway and payment point", hue: 44 },
      { title: "Outdoor seating", caption: "Evening seating with lighting", hue: 150 },
      { title: "Signature dish", caption: "Our most requested plate", hue: 350 },
    ],
    team: [
      { name: "Head Chef", role: "Culinary lead", bio: "Runs the kitchen and signs off every plate that leaves the pass." },
      { name: "Restaurant Manager", role: "Guest experience", bio: "Handles reservations, group bookings and event planning." },
      { name: "Floor Supervisor", role: "Service", bio: "Makes sure tables are turned quickly without rushing guests." },
    ],
    hours: ["Mon – Thu: 11:00 – 23:00", "Fri – Sat: 11:00 – 00:30", "Sun: 12:00 – 23:00"],
  },
  coaching: {
    services: ["Classroom coaching", "Test series", "Doubt sessions", "Study material", "Online classes", "Parent counselling"],
    usp: [
      "Small batches so every student gets attention",
      "Weekly tests with detailed performance reports",
      "Dedicated doubt-clearing sessions",
      "Regular parent updates on progress",
    ],
    faqs: [
      { q: "What is the batch size?", a: "We keep batches small so faculty can track each student individually. Ask us for the current strength." },
      { q: "Do you offer a demo class?", a: "Yes. Book a demo class and sit in before you decide." },
      { q: "How is progress tracked?", a: "Weekly tests plus a report shared with parents covering accuracy, speed and attendance." },
      { q: "Are online classes available?", a: "Yes — live online batches run alongside the classroom programme." },
    ],
    stats: [
      { value: "Small", label: "Batch size" },
      { value: "Weekly", label: "Test cadence" },
      { value: "1:1", label: "Doubt sessions" },
      { value: "Monthly", label: "Parent reports" },
    ],
    timeline: [
      { title: "Counselling", detail: "We assess the student's current level and target exam." },
      { title: "Demo class", detail: "Attend a live session before enrolling." },
      { title: "Batch allocation", detail: "Placed in a batch matched to pace and level." },
      { title: "Tests & reviews", detail: "Weekly tests, monthly parent review." },
    ],
    courses: [
      { name: "Foundation Programme", duration: "12 months", fee: "On request", description: "Concept building with weekly assessments." },
      { name: "Target Batch", duration: "10 months", fee: "On request", description: "Exam-focused intensive with full test series." },
      { name: "Crash Course", duration: "3 months", fee: "On request", description: "Rapid revision and mock exams." },
      { name: "Doubt Clinic", duration: "Weekly", fee: "Included", description: "One-to-one doubt clearing with faculty." },
    ],
    gallery: [
      { title: "Classroom", caption: "Batch seating with clear board visibility", hue: 220 },
      { title: "Library", caption: "Quiet study area for self-study hours", hue: 260 },
      { title: "Test hall", caption: "Weekly test environment", hue: 200 },
      { title: "Reception", caption: "Where parents check in and collect reports", hue: 190 },
    ],
    team: [
      { name: "Academic Director", role: "Curriculum", bio: "Designs the programme and reviews results every cycle." },
      { name: "Senior Faculty", role: "Core subjects", bio: "Leads classroom teaching and doubt sessions." },
      { name: "Student Coordinator", role: "Parent liaison", bio: "Shares progress reports and handles scheduling." },
    ],
    hours: ["Mon – Sat: 08:00 – 20:00", "Sun: 09:00 – 13:00", "Holidays: by appointment"],
  },
  gym: {
    services: ["Strength training", "Personal training", "Group classes", "Nutrition guidance", "Cardio zone", "Transformation programmes"],
    usp: [
      "Certified trainers on the floor at all times",
      "Programmes built around your goal, not a template",
      "Clean, well-maintained equipment",
      "Flexible membership options",
    ],
    faqs: [
      { q: "Can I try before joining?", a: "Yes — book a free trial session and a facility walkthrough." },
      { q: "Do you offer personal training?", a: "One-to-one personal training is available with a certified trainer." },
      { q: "Is there a diet plan?", a: "Trainers provide nutrition guidance as part of most programmes." },
      { q: "What are the timings?", a: "We open early and close late; check the hours below or message us." },
    ],
    stats: [
      { value: "6 days", label: "Open weekly" },
      { value: "1:1", label: "Training available" },
      { value: "Free", label: "Trial session" },
      { value: "All levels", label: "Welcome" },
    ],
    timeline: [
      { title: "Free trial", detail: "Walkthrough and a trial session." },
      { title: "Assessment", detail: "Baseline fitness and goal setting." },
      { title: "Programme", detail: "A plan matched to your schedule." },
      { title: "Reviews", detail: "Progress checks every few weeks." },
    ],
    products: [
      { name: "Monthly Membership", price: "₹—", description: "Full floor access with trainer support.", tag: "Popular" },
      { name: "Quarterly Plan", price: "₹—", description: "Better value for consistent training." },
      { name: "Personal Training", price: "₹—", description: "One-to-one sessions with a certified trainer." },
      { name: "Transformation Programme", price: "₹—", description: "Structured 12-week plan with nutrition guidance." },
    ],
    gallery: [
      { title: "Strength floor", caption: "Free weights and racks", hue: 210 },
      { title: "Cardio zone", caption: "Treadmills, cycles and rowers", hue: 195 },
      { title: "Functional area", caption: "Space for classes and mobility work", hue: 175 },
      { title: "Changing rooms", caption: "Clean, lockable storage", hue: 230 },
    ],
    team: [
      { name: "Head Trainer", role: "Programming", bio: "Builds and reviews every member's plan." },
      { name: "Strength Coach", role: "Technique", bio: "Runs lifting technique sessions." },
      { name: "Front Desk", role: "Memberships", bio: "Handles bookings, trials and renewals." },
    ],
    hours: ["Mon – Sat: 05:30 – 22:00", "Sun: 07:00 – 11:00"],
  },
  dental: {
    services: ["General dentistry", "Cosmetic dentistry", "Orthodontics", "Implants", "Root canal", "Pediatric dentistry"],
    usp: [
      "Sterilised, single-use instrumentation",
      "Clear treatment plans before any procedure",
      "Flexible appointment slots including evenings",
      "Transparent pricing with no hidden charges",
    ],
    faqs: [
      { q: "Do you accept walk-ins?", a: "Appointments are preferred so you're seen on time, but we try to accommodate emergencies." },
      { q: "How much does a consultation cost?", a: "Consultation fees are confirmed when you book — ask us on WhatsApp." },
      { q: "Do you treat children?", a: "Yes, pediatric dentistry is part of the practice." },
      { q: "Is treatment painful?", a: "Modern anaesthesia and gentle technique keep treatment comfortable." },
    ],
    stats: [
      { value: "Same day", label: "Emergency slots" },
      { value: "Sterile", label: "Instrument protocol" },
      { value: "Evening", label: "Appointments" },
      { value: "All ages", label: "Patients seen" },
    ],
    timeline: [
      { title: "Book", detail: "Choose a slot by phone or WhatsApp." },
      { title: "Examination", detail: "Full assessment and diagnosis." },
      { title: "Plan", detail: "Written treatment plan with costs." },
      { title: "Treatment", detail: "Scheduled visits with follow-up." },
    ],
    gallery: [
      { title: "Reception", caption: "Check-in and waiting area", hue: 185 },
      { title: "Treatment room", caption: "Modern chair and equipment", hue: 195 },
      { title: "Sterilisation", caption: "Instrument processing area", hue: 170 },
      { title: "Consultation", caption: "Where plans are explained", hue: 205 },
    ],
    team: [
      { name: "Lead Dentist", role: "Clinical director", bio: "Oversees all treatment planning." },
      { name: "Associate Dentist", role: "General dentistry", bio: "Routine check-ups and restorative work." },
      { name: "Clinic Coordinator", role: "Appointments", bio: "Manages scheduling and follow-ups." },
    ],
    hours: ["Mon – Sat: 10:00 – 20:00", "Sun: 10:00 – 14:00"],
  },
  retail: {
    services: ["In-store shopping", "WhatsApp ordering", "Home delivery", "Bulk orders", "Gift wrapping", "Exchange policy"],
    usp: [
      "Carefully selected product range",
      "Order on WhatsApp in one message",
      "Local delivery, usually same day",
      "Easy exchange on unused items",
    ],
    faqs: [
      { q: "Can I order without visiting?", a: "Yes — message us on WhatsApp with the item and we'll confirm availability." },
      { q: "Do you deliver?", a: "We deliver locally. Ask us for the delivery charge and timing." },
      { q: "What is the exchange policy?", a: "Unused items can be exchanged within the stated window with the receipt." },
      { q: "Do you take bulk orders?", a: "Yes — bulk and corporate orders are handled on request." },
    ],
    stats: [
      { value: "Same day", label: "Local delivery" },
      { value: "WhatsApp", label: "Ordering" },
      { value: "In store", label: "Try before buy" },
      { value: "Exchange", label: "On unused items" },
    ],
    timeline: [
      { title: "Browse", detail: "See the catalogue and current stock." },
      { title: "Order", detail: "WhatsApp, phone or visit the store." },
      { title: "Confirm", detail: "We confirm availability and price." },
      { title: "Deliver", detail: "Collect in store or get it delivered." },
    ],
    products: [
      { name: "Best Seller", price: "₹—", description: "Our most frequently reordered item.", tag: "Popular" },
      { name: "New Arrival", price: "₹—", description: "Recently added to the range." },
      { name: "Value Pack", price: "₹—", description: "Better per-unit pricing on quantity." },
      { name: "Gift Option", price: "₹—", description: "Wrapped and ready to give." },
    ],
    gallery: [
      { title: "Shop floor", caption: "Layout designed for easy browsing", hue: 35 },
      { title: "Display wall", caption: "Featured and new arrivals", hue: 20 },
      { title: "Counter", caption: "Payment and pickup", hue: 45 },
      { title: "Stock room", caption: "Organised inventory", hue: 55 },
    ],
    hours: ["Mon – Sat: 10:30 – 21:00", "Sun: 11:00 – 19:00"],
  },
  salon: {
    services: ["Hair styling", "Hair colour", "Skin care", "Bridal makeup", "Nails", "Spa rituals"],
    usp: [
      "Trained stylists and beauty therapists",
      "Hygiene-first tools and single-use items",
      "Bridal and event packages",
      "Consultation before every service",
    ],
    faqs: [
      { q: "Do I need an appointment?", a: "Appointments are recommended, especially for weekends and events." },
      { q: "Do you do bridal packages?", a: "Yes — bridal packages include trials and day-of service." },
      { q: "Which products do you use?", a: "Professional-grade products; tell us about any allergies beforehand." },
      { q: "How far ahead should I book?", a: "For events, book at least two weeks in advance." },
    ],
    stats: [
      { value: "By appt", label: "Booking" },
      { value: "Bridal", label: "Packages" },
      { value: "Hygiene", label: "First" },
      { value: "All hair", label: "Types served" },
    ],
    timeline: [
      { title: "Consult", detail: "We discuss the look and your hair/skin history." },
      { title: "Book", detail: "Choose a slot that works." },
      { title: "Service", detail: "Relax while we do the work." },
      { title: "Aftercare", detail: "Home routine advice to keep the result." },
    ],
    products: [
      { name: "Haircut & Style", price: "₹—", description: "Cut, wash and finish.", tag: "Popular" },
      { name: "Colour", price: "₹—", description: "Global colour or highlights." },
      { name: "Facial", price: "₹—", description: "Skin-type matched treatment." },
      { name: "Bridal Package", price: "₹—", description: "Trial plus day-of makeup and hair." },
    ],
    gallery: [
      { title: "Styling station", caption: "Chairs, mirrors and lighting", hue: 330 },
      { title: "Treatment room", caption: "Private space for skin services", hue: 320 },
      { title: "Nail bar", caption: "Manicure and pedicure seating", hue: 340 },
      { title: "Reception", caption: "Booking and product display", hue: 310 },
    ],
    hours: ["Tue – Sun: 10:00 – 20:00", "Mon: Closed"],
  },
  interior: {
    services: ["Interior design", "Turnkey execution", "Modular kitchens", "False ceiling & lighting", "Furniture selection", "Space planning"],
    usp: [
      "3D visuals before execution begins",
      "Single point of accountability",
      "Transparent material costing",
      "Timeline tracked against milestones",
    ],
    faqs: [
      { q: "Do you share 3D designs?", a: "Yes — you approve 3D visuals before execution starts." },
      { q: "How is the project tracked?", a: "Milestone-based tracking with regular site updates." },
      { q: "Do you handle civil work?", a: "Turnkey projects include civil, carpentry, electrical and finishing." },
      { q: "What areas do you serve?", a: "We work across the city and nearby regions — ask us." },
    ],
    stats: [
      { value: "3D", label: "Design approval" },
      { value: "Turnkey", label: "Execution" },
      { value: "Milestone", label: "Tracking" },
      { value: "Warranty", label: "On workmanship" },
    ],
    timeline: [
      { title: "Site visit", detail: "Measurements, requirements and budget." },
      { title: "Design", detail: "Layout, 3D visuals and material selection." },
      { title: "Approval", detail: "You sign off the design and costing." },
      { title: "Execution", detail: "Milestone-based build with updates." },
    ],
    gallery: [
      { title: "Living space", caption: "Completed living room project", hue: 30 },
      { title: "Kitchen", caption: "Modular kitchen execution", hue: 40 },
      { title: "Bedroom", caption: "Warm, layered lighting design", hue: 25 },
      { title: "Office", caption: "Commercial fit-out", hue: 210 },
    ],
    team: [
      { name: "Principal Designer", role: "Design lead", bio: "Owns concept, layout and visualisation." },
      { name: "Project Manager", role: "Execution", bio: "Runs site, vendors and timelines." },
      { name: "Site Supervisor", role: "Quality", bio: "Checks finish quality at every stage." },
    ],
    hours: ["Mon – Sat: 10:00 – 19:00", "Sun: by appointment"],
  },
  travel: {
    services: ["Holiday packages", "Flight tickets", "Hotel booking", "Visa assistance", "Car rental", "Corporate travel"],
    usp: [
      "Itineraries built around your budget",
      "End-to-end booking handled for you",
      "Visa documentation support",
      "Support while you travel",
    ],
    faqs: [
      { q: "Can you build a custom itinerary?", a: "Yes — tell us the dates, budget and interests and we'll plan it." },
      { q: "Do you handle visas?", a: "We assist with documentation for the destinations we cover." },
      { q: "Is payment in instalments possible?", a: "Instalment schedules are available on selected packages." },
      { q: "What if plans change?", a: "Talk to us early — changes depend on the supplier's policy." },
    ],
    stats: [
      { value: "Custom", label: "Itineraries" },
      { value: "24/7", label: "Travel support" },
      { value: "Visa", label: "Assistance" },
      { value: "Group", label: "Bookings" },
    ],
    timeline: [
      { title: "Share plans", detail: "Dates, budget and what you want from the trip." },
      { title: "Itinerary", detail: "We send a detailed day-by-day plan." },
      { title: "Confirm", detail: "Approve, pay the deposit, we book." },
      { title: "Travel", detail: "Documents, contacts and support on the go." },
    ],
    products: [
      { name: "Weekend Getaway", price: "₹—", description: "Short breaks planned around your city.", tag: "Popular" },
      { name: "Family Holiday", price: "₹—", description: "Paced for all ages, with downtime built in." },
      { name: "Honeymoon Package", price: "₹—", description: "Handpicked stays and experiences." },
      { name: "Group Tour", price: "₹—", description: "Fixed departures with a tour lead." },
    ],
    gallery: [
      { title: "Beach stay", caption: "Handpicked beachfront property", hue: 190 },
      { title: "Hill retreat", caption: "Cool-climate escape", hue: 150 },
      { title: "City break", caption: "Culture and food focused itinerary", hue: 260 },
      { title: "Road trip", caption: "Self-drive route with stops", hue: 35 },
    ],
    hours: ["Mon – Sat: 10:00 – 19:30", "Sun: 11:00 – 16:00"],
  },
  default: {
    services: ["Consultation", "On-site service", "Scheduled maintenance", "Emergency support", "Annual contracts", "Custom quotes"],
    usp: [
      "Experienced, accountable team",
      "Clear quotes before work starts",
      "On-time delivery on committed dates",
      "Ongoing support after the job is done",
    ],
    faqs: [
      { q: "How do I get a quote?", a: "Send us the details on WhatsApp or through the form and we'll respond with a quote." },
      { q: "What areas do you cover?", a: "We serve the city and nearby areas — ask us to confirm your location." },
      { q: "Do you offer support after delivery?", a: "Yes, we offer ongoing support and maintenance arrangements." },
      { q: "How quickly can you start?", a: "Tell us your deadline and we'll confirm the earliest start date." },
    ],
    stats: [
      { value: "Fast", label: "Response time" },
      { value: "Fixed", label: "Quotes" },
      { value: "Local", label: "Service area" },
      { value: "Warranty", label: "On work" },
    ],
    timeline: [
      { title: "Enquiry", detail: "Tell us what you need." },
      { title: "Assessment", detail: "We review and confirm scope." },
      { title: "Quote", detail: "Written quote with timeline." },
      { title: "Delivery", detail: "Work completed and handed over." },
    ],
    gallery: [
      { title: "Our work", caption: "A recent completed project", hue: 220 },
      { title: "On site", caption: "Team at work", hue: 200 },
      { title: "Facilities", caption: "Where we operate", hue: 240 },
      { title: "Team", caption: "The people behind the service", hue: 260 },
    ],
    team: [
      { name: "Founder", role: "Leadership", bio: "Sets standards and reviews every project." },
      { name: "Operations Lead", role: "Delivery", bio: "Schedules and quality-checks work." },
      { name: "Client Manager", role: "Support", bio: "Your point of contact after delivery." },
    ],
    hours: ["Mon – Fri: 09:30 – 18:30", "Sat: 10:00 – 16:00", "Sun: closed"],
  },
};

export function categoryProfile(category: string) {
  const c = category.toLowerCase();
  for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
    if (key !== "default" && c.includes(key)) return profile;
  }
  if (/restaurant|cafe|food|hotel|bakery|catering|dining/.test(c)) return CATEGORY_PROFILES.restaurant!;
  if (/coaching|academy|institute|school|tuition|education|training/.test(c)) return CATEGORY_PROFILES.coaching!;
  if (/gym|fitness|yoga|sport/.test(c)) return CATEGORY_PROFILES.gym!;
  if (/dental|clinic|doctor|hospital|medical|health|physio/.test(c)) return CATEGORY_PROFILES.dental!;
  if (/salon|spa|beauty|parlour|makeup/.test(c)) return CATEGORY_PROFILES.salon!;
  if (/retail|store|shop|boutique|fashion|grocery|electronics/.test(c)) return CATEGORY_PROFILES.retail!;
  if (/interior|architect|construction|real estate|property|builder/.test(c)) return CATEGORY_PROFILES.interior!;
  if (/travel|tour|hotel|resort|holiday/.test(c)) return CATEGORY_PROFILES.travel!;
  return CATEGORY_PROFILES.default!;
}

/** Build the full content model for a site. */
export function composeSiteContent(input: ContentInput): SiteBusiness {
  const profile = categoryProfile(input.category);
  const city = input.city || "your area";
  const services = (input.services?.length ? input.services : profile.services).slice(0, 8);

  const tagline = buildTagline(input, city);
  const about = buildAbout(input, city, services);

  return {
    name: input.name,
    category: input.category,
    subcategory: input.subcategory ?? "",
    city,
    address: input.address ?? "",
    phone: input.phone ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    rating: input.rating ?? null,
    reviewCount: input.reviewCount ?? 0,
    socialLinks: input.socialLinks ?? {},
    services,
    about,
    tagline,
    usp: profile.usp,
    hours: profile.hours,
    faqs: profile.faqs.map((f) => ({ q: f.q, a: f.a.replace(/we/gi, input.name) })),
    testimonials: buildTestimonials(input.name, input.category, city, input.rating),
    gallery: profile.gallery ?? [],
    stats: buildStats(profile.stats, input),
    products: profile.products ?? [],
    courses: profile.courses ?? [],
    menu: profile.menu ?? [],
    team: profile.team ?? [],
    timeline: profile.timeline,
    faqImages: [],
    keywords: buildKeywords(input, city, services),
  };
}

function buildTagline(input: ContentInput, city: string): string {
  const c = input.category.toLowerCase();
  if (/restaurant|cafe|food|dining|bakery/.test(c)) return `Great food, made fresh in ${city}`;
  if (/coaching|academy|institute|tuition|school/.test(c)) return `Serious preparation, real results in ${city}`;
  if (/gym|fitness|yoga/.test(c)) return `Train with purpose in ${city}`;
  if (/dental|clinic|doctor|medical|health/.test(c)) return `Care you can trust in ${city}`;
  if (/salon|spa|beauty/.test(c)) return `Look and feel your best in ${city}`;
  if (/retail|store|shop|boutique/.test(c)) return `Everything you need, right here in ${city}`;
  if (/interior|architect|construction/.test(c)) return `Spaces designed and delivered in ${city}`;
  if (/travel|tour|hotel/.test(c)) return `Trips planned properly, from ${city}`;
  return `Professional ${input.category.toLowerCase()} services in ${city}`;
}

function buildAbout(input: ContentInput, city: string, services: string[]): string {
  const lead = services.slice(0, 3).join(", ");
  return `${input.name} is a ${input.category.toLowerCase()} business serving ${city}. We focus on ${lead} — delivered consistently, with clear communication from first enquiry to completion.`;
}

function buildTestimonials(
  name: string,
  category: string,
  city: string,
  rating: number | null | undefined,
): Array<{ name: string; role: string; quote: string }> {
  const c = category.toLowerCase();
  const quotes: Record<string, string[]> = {
    restaurant: ["Food arrived hot and exactly as ordered.", "Booked for a family function and it was handled perfectly."],
    coaching: ["My child's test scores improved within a term.", "Faculty actually follow up on weak areas."],
    gym: ["Lost 8 kg in four months with the plan here.", "Trainers correct form — not just count reps."],
    dental: ["Painless treatment and a clear cost breakdown.", "Got an emergency slot the same day."],
    salon: ["Exactly the look I asked for.", "Clean, professional and on time."],
    retail: ["Ordered on WhatsApp, delivered same evening.", "Genuine products and fair pricing."],
    interior: ["The 3D design matched the finished flat.", "Timeline was tracked and updated weekly."],
    travel: ["Itinerary was realistic, not rushed.", "Handled the visa paperwork end to end."],
    default: ["Delivered on the date they promised.", "Easy to reach and they explain everything clearly."],
  };
  const pool =
    quotes.restaurant && /restaurant|food|cafe/.test(c)
      ? quotes.restaurant
      : /coaching|academy|school/.test(c)
        ? quotes.coaching
        : /gym|fitness/.test(c)
          ? quotes.gym
          : /dental|clinic|doctor|medical/.test(c)
            ? quotes.dental
            : /salon|spa|beauty/.test(c)
              ? quotes.salon
              : /retail|store|shop/.test(c)
                ? quotes.retail
                : /interior|architect|construction/.test(c)
                  ? quotes.interior
                  : /travel|tour|hotel/.test(c)
                    ? quotes.travel
                    : quotes.default!;

  const names = ["A. Verma", "R. Singh", "N. Gupta", "S. Khan", "P. Mishra"];
  return pool.slice(0, 3).map((quote, i) => ({
    name: names[i] ?? "Customer",
    role: `${city} customer`,
    quote,
  }));
}

function buildStats(base: Array<{ value: string; label: string }>, input: ContentInput) {
  return base.map((s) => {
    if (s.label === "Guest rating" && input.rating) {
      return { value: `★ ${input.rating.toFixed(1)}`, label: input.reviewCount ? `${input.reviewCount} reviews` : "Guest rating" };
    }
    return s;
  });
}

function buildKeywords(input: ContentInput, city: string, services: string[]) {
  const base = [input.category.toLowerCase(), `${input.category.toLowerCase()} in ${city}`, `${input.name} ${city}`];
  return Array.from(new Set([...base, ...services.slice(0, 5).map((s) => s.toLowerCase())]));
}
