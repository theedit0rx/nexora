import type { Business } from "../db/schema";

/* ==========================================================================
   NEXORA — Lead Source Providers
   --------------------------------------------------------------------------
   NEXORA never depends on a single discovery source. Each provider returns
   the same `DiscoveredBusiness` shape, so Scout can merge, dedupe and
   score them identically regardless of origin.
   ========================================================================== */

export interface DiscoveredBusiness {
  name: string;
  category: string;
  subcategory?: string;
  city?: string;
  region?: string;
  country?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  mapsUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  rating?: number | null;
  reviewCount?: number;
  socialLinks?: Record<string, string>;
  discoverySource: Business["discoverySource"];
  raw?: Record<string, unknown>;
}

export interface LeadSourceProvider {
  key: string;
  name: string;
  available: boolean;
  requiredEnv: string[];
  discover(query: LeadQuery): Promise<DiscoveredBusiness[]>;
}

export interface LeadQuery {
  city: string;
  category: string;
  limit?: number;
  keyword?: string;
}

/* ------------------------------------------------------------ Google Places */

export class GooglePlacesProvider implements LeadSourceProvider {
  key = "google_places";
  name = "Google Places API";
  requiredEnv = ["GOOGLE_PLACES_API_KEY"];
  available = Boolean(process.env.GOOGLE_PLACES_API_KEY);

  async discover(query: LeadQuery): Promise<DiscoveredBusiness[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    const limit = query.limit ?? 20;

    // Text search to find candidate places
    const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    searchUrl.searchParams.set("query", `${query.category} in ${query.city}`);
    searchUrl.searchParams.set("key", apiKey);
    const searchRes = await fetch(searchUrl);
    const searchJson = (await searchRes.json()) as {
      status: string;
      error_message?: string;
      results?: Array<Record<string, any>>;
    };
    if (searchJson.status !== "OK" && searchJson.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places textsearch: ${searchJson.status} ${searchJson.error_message ?? ""}`);
    }

    const places = (searchJson.results ?? []).slice(0, limit);
    const out: DiscoveredBusiness[] = [];

    for (const place of places) {
      // Place details for website / phone / address
      let details: Record<string, any> = {};
      try {
        const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailUrl.searchParams.set("place_id", String(place.place_id));
        detailUrl.searchParams.set(
          "fields",
          "name,formatted_address,formatted_phone_number,international_phone_number,website,url,geometry,rating,user_ratings_total,types,business_status",
        );
        detailUrl.searchParams.set("key", apiKey);
        const detailRes = await fetch(detailUrl);
        const detailJson = (await detailRes.json()) as { result?: Record<string, any> };
        details = detailJson.result ?? {};
      } catch {
        /* details are best-effort */
      }

      out.push({
        name: String(details.name ?? place.name ?? ""),
        category: query.category,
        subcategory: (place.types as string[] | undefined)?.[0] ?? "",
        city: query.city,
        region: "",
        country: "India",
        address: String(details.formatted_address ?? place.formatted_address ?? ""),
        latitude: details.geometry?.location?.lat ?? null,
        longitude: details.geometry?.location?.lng ?? null,
        website: (details.website as string) ?? null,
        mapsUrl: (details.url as string) ?? null,
        phone: (details.formatted_phone_number as string) ?? (details.international_phone_number as string) ?? null,
        email: null,
        rating: (details.rating as number) ?? null,
        reviewCount: (details.user_ratings_total as number) ?? 0,
        socialLinks: {},
        discoverySource: "GOOGLE_PLACES",
        raw: { place_id: place.place_id, types: place.types, business_status: details.business_status },
      });
    }
    return out;
  }
}

/* -------------------------------------------------------------- Web search */

export class WebSearchProvider implements LeadSourceProvider {
  key = "web_search";
  name = "Public Web Search";
  requiredEnv = ["LEAD_SEARCH_API_KEY"];
  available = Boolean(process.env.LEAD_SEARCH_API_KEY);

  async discover(query: LeadQuery): Promise<DiscoveredBusiness[]> {
    const apiKey = process.env.LEAD_SEARCH_API_KEY;
    const provider = process.env.LEAD_SEARCH_PROVIDER ?? "serp";
    if (!apiKey) throw new Error("LEAD_SEARCH_API_KEY is not configured");

    const url = new URL("https://google.serper.dev/search");
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        q: `${query.category} in ${query.city} ${query.keyword ?? ""}`.trim(),
        num: query.limit ?? 20,
        gl: "in",
      }),
    });
    if (!res.ok) throw new Error(`Web search ${provider} ${res.status}`);
    const json = (await res.json()) as {
      places?: Array<Record<string, any>>;
      organic?: Array<Record<string, any>>;
    };
    const places = json.places ?? [];
    if (places.length > 0) {
      return places.slice(0, query.limit ?? 20).map((p) => ({
        name: String(p.title ?? ""),
        category: query.category,
        city: query.city,
        address: String(p.address ?? ""),
        website: (p.website as string) ?? null,
        phone: (p.phoneNumber as string) ?? null,
        rating: (p.rating as number) ?? null,
        reviewCount: (p.ratingCount as number) ?? 0,
        mapsUrl: null,
        email: null,
        socialLinks: {},
        discoverySource: "WEB_SEARCH" as const,
        raw: p,
      }));
    }
    return (json.organic ?? []).slice(0, query.limit ?? 20).map((r) => ({
      name: String(r.title ?? "").replace(/\s*[-|].*$/, ""),
      category: query.category,
      city: query.city,
      website: (r.link as string) ?? null,
      phone: null,
      email: null,
      rating: null,
      reviewCount: 0,
      mapsUrl: null,
      address: "",
      socialLinks: {},
      discoverySource: "WEB_SEARCH" as const,
      raw: r,
    }));
  }
}

/* ------------------------------------------------------------- CSV import */

export class CsvLeadProvider implements LeadSourceProvider {
  key = "csv";
  name = "CSV Import";
  requiredEnv: string[] = [];
  available = true;

  async discover(_query: LeadQuery): Promise<DiscoveredBusiness[]> {
    // CSV import does not query a service — rows are supplied by the caller
    // through `importCsvRows` below.
    return [];
  }
}

/** Convert already-parsed CSV rows into discovered businesses. */
export function importCsvRows(rows: DiscoveredBusiness[]): DiscoveredBusiness[] {
  return rows.map((r) => ({ ...r, discoverySource: "CSV_IMPORT" as const }));
}

/** Parse a CSV buffer into discovered businesses (header-based, tolerant). */
export function parseLeadCsv(text: string): DiscoveredBusiness[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));

  const iName = idx(["name", "business", "business name", "company"]);
  const iCat = idx(["category", "type", "industry"]);
  const iCity = idx(["city", "location", "town"]);
  const iWeb = idx(["website", "url", "site", "domain"]);
  const iPhone = idx(["phone", "mobile", "contact"]);
  const iEmail = idx(["email", "mail", "email address"]);
  const iAddr = idx(["address", "street"]);
  const iMaps = idx(["maps", "maps url", "google maps"]);
  const iRating = idx(["rating", "stars"]);

  const out: DiscoveredBusiness[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const name = (iName >= 0 ? cells[iName] : cells[0])?.trim();
    if (!name) continue;
    out.push({
      name,
      category: (iCat >= 0 ? cells[iCat] : "")?.trim() || "Local Business",
      city: (iCity >= 0 ? cells[iCity] : "")?.trim() || "",
      address: (iAddr >= 0 ? cells[iAddr] : "")?.trim() || "",
      website: normalizeUrl((iWeb >= 0 ? cells[iWeb] : "")?.trim()),
      phone: (iPhone >= 0 ? cells[iPhone] : "")?.trim() || null,
      email: (iEmail >= 0 ? cells[iEmail] : "")?.trim() || null,
      mapsUrl: normalizeUrl((iMaps >= 0 ? cells[iMaps] : "")?.trim()),
      rating: iRating >= 0 && cells[iRating] ? Number(cells[iRating]) : null,
      reviewCount: 0,
      socialLinks: {},
      discoverySource: "CSV_IMPORT",
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function normalizeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || v === "-" || v.toLowerCase() === "n/a") return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/* -------------------------------------------------------------- registry -- */

export function getLeadSourceProviders(): LeadSourceProvider[] {
  return [new GooglePlacesProvider(), new WebSearchProvider(), new CsvLeadProvider()];
}
