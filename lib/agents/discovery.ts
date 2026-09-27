import { db, newId, slugify } from "../db";
import { nowIso, type Business, type Lead, type LeadStatus, type PipelineStage } from "../db/schema";
import { bus, logActivity } from "../events/bus";
import { runTask, markAgentWorking, markAgentIdle } from "../tasks/engine";
import {
  GooglePlacesProvider,
  WebSearchProvider,
  parseLeadCsv,
  type DiscoveredBusiness,
} from "../providers/lead-sources";
import { isAgentAvailable } from "./registry";

/* ==========================================================================
   NEXORA — Scout Agent
   Multi-source discovery → dedupe → lead creation.
   ========================================================================== */

export interface ScoutInput {
  city: string;
  category: string;
  limit?: number;
  source?: "auto" | "google_places" | "web_search" | "csv" | "manual";
  csvText?: string;
  manualRows?: DiscoveredBusiness[];
}

export interface ScoutResult {
  discovered: number;
  created: number;
  duplicates: number;
  source: string;
  leads: Array<{ id: string; name: string }>;
  providerAvailable: boolean;
  note: string;
}

/** Demo discovery pool — used only when no live provider is configured. */
const DEMO_POOL: Array<DiscoveredBusiness & { websiteStatus: Lead["websiteStatus"] }> = [];

export async function scoutDiscover(
  organizationId: string,
  input: ScoutInput,
  trigger: "EVENT" | "MANUAL" | "SCHEDULE" | "RETRY" | "SUPERVISOR" = "MANUAL",
) {
  if (!(await isAgentAvailable(organizationId, "scout"))) {
    return { ok: false as const, error: "Scout agent is paused" };
  }

  return runTask(
    { organizationId, agentKey: "scout", trigger },
    "discover.businesses",
    async (task) => {
      await markAgentWorking(organizationId, "scout", task.id, `Scanning ${input.category} in ${input.city}`);

      let discovered: DiscoveredBusiness[] = [];
      let source = input.source ?? "auto";
      let note = "";
      let providerAvailable = false;

      const places = new GooglePlacesProvider();
      const web = new WebSearchProvider();

      if (input.source === "csv" && input.csvText) {
        discovered = parseLeadCsv(input.csvText);
        source = "csv";
        note = `Parsed ${discovered.length} rows from CSV`;
      } else if (input.source === "manual" && input.manualRows) {
        discovered = input.manualRows.map((r) => ({ ...r, discoverySource: "MANUAL" as const }));
        source = "manual";
        note = `Imported ${discovered.length} manually entered businesses`;
      } else if (places.available && (input.source === "auto" || input.source === "google_places")) {
        discovered = await places.discover({
          city: input.city,
          category: input.category,
          limit: input.limit ?? 20,
        });
        source = "google_places";
        providerAvailable = true;
        note = `Google Places returned ${discovered.length} businesses`;
      } else if (web.available && (input.source === "auto" || input.source === "web_search")) {
        discovered = await web.discover({
          city: input.city,
          category: input.category,
          limit: input.limit ?? 20,
        });
        source = "web_search";
        providerAvailable = true;
        note = `Web search returned ${discovered.length} businesses`;
      } else {
        // No live provider configured. NEXORA is explicit about this rather
        // than silently inventing businesses.
        throw new Error(
          "No lead source is connected. Add GOOGLE_PLACES_API_KEY or LEAD_SEARCH_API_KEY, import a CSV, or enable Demo Mode from the dashboard to explore the full workflow.",
        );
      }

      const created: Array<{ id: string; name: string }> = [];
      let duplicates = 0;

      for (const d of discovered) {
        const existing = await findDuplicateBusiness(organizationId, d);
        if (existing) {
          duplicates++;
          continue;
        }
        const lead = await createLeadFromBusiness(organizationId, d);
        created.push({ id: lead.id, name: lead.name });
      }

      await logActivity({
        organizationId,
        agentKey: "scout",
        actionType: "lead.discovered",
        title: `Scout discovered ${created.length} ${input.category} businesses in ${input.city}`,
        detail: note,
        entityType: "lead",
        status: "OK",
        meta: { source, category: input.category, city: input.city, duplicates },
      });

      for (const lead of created) {
        await bus.emit("lead.discovered", {
          organizationId,
          leadId: lead.id,
          count: 1,
          source,
          city: input.city,
          category: input.category,
        });
      }

      await markAgentIdle(organizationId, "scout");

      const result: ScoutResult = {
        discovered: discovered.length,
        created: created.length,
        duplicates,
        source,
        leads: created,
        providerAvailable,
        note,
      };
      return result;
    },
    {
      entityType: "organization",
      entityId: organizationId,
      priority: "HIGH",
      input: { city: input.city, category: input.category, source: input.source },
    },
  );
}

async function findDuplicateBusiness(organizationId: string, d: DiscoveredBusiness) {
  const normalized = normalizeName(d.name);
  const candidates = await db.find("businesses", { organizationId });
  return (
    candidates.find(
      (b) =>
        normalizeName(b.name) === normalized &&
        (b.city ?? "").toLowerCase() === (d.city ?? "").toLowerCase(),
    ) ?? null
  );
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(pvt|ltd|llp|llc|inc|co|the|and|&)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export async function createLeadFromBusiness(
  organizationId: string,
  d: DiscoveredBusiness,
): Promise<Lead & { name: string }> {
  const businessId = newId("biz");
  const business: Business = {
    id: businessId,
    organizationId,
    leadId: null,
    name: d.name,
    category: d.category,
    subcategory: d.subcategory ?? "",
    city: d.city ?? "",
    region: d.region ?? "",
    country: d.country ?? "India",
    address: d.address ?? "",
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    website: d.website ?? null,
    mapsUrl: d.mapsUrl ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    rating: d.rating ?? null,
    reviewCount: d.reviewCount ?? 0,
    socialLinks: d.socialLinks ?? {},
    discoverySource: d.discoverySource,
    discoveredAt: nowIso(),
    raw: d.raw ?? {},
  };
  await db.insert("businesses", business);

  const contacts = [];
  if (d.phone) {
    contacts.push({
      id: newId("con"),
      businessId,
      type: "PHONE" as const,
      label: "Primary phone",
      value: d.phone,
      isPrimary: true,
      source: d.discoverySource,
      createdAt: nowIso(),
    });
  }
  if (d.email) {
    contacts.push({
      id: newId("con"),
      businessId,
      type: "EMAIL" as const,
      label: "Primary email",
      value: d.email,
      isPrimary: true,
      source: d.discoverySource,
      createdAt: nowIso(),
    });
  }
  if (d.website) {
    contacts.push({
      id: newId("con"),
      businessId,
      type: "FORM" as const,
      label: "Website",
      value: d.website,
      isPrimary: false,
      source: d.discoverySource,
      createdAt: nowIso(),
    });
  }
  if (d.mapsUrl) {
    contacts.push({
      id: newId("con"),
      businessId,
      type: "MAPS" as const,
      label: "Google Business Profile",
      value: d.mapsUrl,
      isPrimary: false,
      source: d.discoverySource,
      createdAt: nowIso(),
    });
  }
  if (contacts.length > 0) await db.insertMany("business_contacts", contacts);

  const lead: Lead = {
    id: newId("led"),
    organizationId,
    businessId,
    status: "DISCOVERED" as LeadStatus,
    pipelineStage: "Discovered" as PipelineStage,
    priority: null,
    score: null,
    websiteStatus: d.website ? "UNKNOWN" : "NONE",
    assignedTo: null,
    tags: [d.category],
    optOut: false,
    suppressed: false,
    lastContactedAt: null,
    nextFollowUpAt: null,
    lostReason: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert("leads", lead);
  await db.update("businesses", businessId, { leadId: lead.id });
  return { ...lead, name: d.name };
}

export function demoSuggestions() {
  return [
    { city: "Lucknow", category: "Restaurant" },
    { city: "Lucknow", category: "Coaching Institute" },
    { city: "Kanpur", category: "Gym" },
    { city: "Delhi", category: "Dental Clinic" },
    { city: "Noida", category: "Interior Designer" },
    { city: "Jaipur", category: "Boutique" },
  ];
}

export { slugify };
