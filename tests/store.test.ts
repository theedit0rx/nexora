import { beforeAll, describe, expect, it } from "vitest";
import { db, resetDb } from "@/lib/db";
import { defaultSettings, ensureOrganization, ensureServicesAndPricing } from "@/lib/bootstrap";
import { TABLE_NAMES } from "@/lib/db/schema";

/* The local store is the engine behind Demo Mode: it enforces the same
   relational contract as Supabase, so those guarantees must hold. */

let orgId = "";

beforeAll(async () => {
  const org = await ensureOrganization();
  orgId = org.id;
  if (!(await db.findOne("settings", { organizationId: orgId }))) await defaultSettings(orgId);
  await ensureServicesAndPricing(orgId);
});

describe("local store", () => {
  it("creates every table the schema declares", () => {
    for (const table of TABLE_NAMES) {
      expect(() => db.all(table)).not.toThrow();
    }
  });

  it("round-trips a row through insert / find / update / delete", async () => {
    const biz = await db.insert("businesses", {
      id: "biz_test_roundtrip",
      organizationId: orgId,
      leadId: null,
      name: "Roundtrip Co",
      category: "Retail",
      subcategory: "",
      city: "Lucknow",
      region: "Uttar Pradesh",
      country: "India",
      address: "",
      latitude: null,
      longitude: null,
      website: null,
      mapsUrl: null,
      phone: null,
      email: null,
      rating: null,
      reviewCount: 0,
      socialLinks: {},
      discoverySource: "MANUAL",
      discoveredAt: new Date().toISOString(),
      raw: {},
    });
    const lead = await db.insert("leads", {
      id: "led_test_roundtrip",
      organizationId: orgId,
      businessId: biz.id,
      status: "DISCOVERED",
      pipelineStage: "Discovered",
      priority: null,
      score: null,
      websiteStatus: "UNKNOWN",
      assignedTo: null,
      tags: [],
      optOut: false,
      suppressed: false,
      lastContactedAt: null,
      nextFollowUpAt: null,
      lostReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(await db.byId("leads", lead.id)).toBeTruthy();
    await db.update("leads", lead.id, { score: 72 });
    expect((await db.byId("leads", lead.id))!.score).toBe(72);
    await db.delete("leads", lead.id);
    expect(await db.byId("leads", lead.id)).toBeNull();
    // businessId is SET_NULL, so the business survives its lead being removed.
    await db.delete("businesses", biz.id);
    expect(await db.byId("businesses", biz.id)).toBeNull();
  });

  it("rejects a foreign-key violation", async () => {
    await expect(
      db.insert("leads", {
        id: "led_test_bad_fk",
        organizationId: "org_does_not_exist",
        businessId: "biz_nope",
        status: "DISCOVERED",
        pipelineStage: "Discovered",
        priority: null,
        score: null,
        websiteStatus: "UNKNOWN",
        assignedTo: null,
        tags: [],
        optOut: false,
        suppressed: false,
        lastContactedAt: null,
        nextFollowUpAt: null,
        lostReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Foreign key violation/);
  });

  it("enforces unique constraints", async () => {
    const existing = (await db.find("organizations", {}))[0]!;
    await expect(
      db.insert("organizations", {
        id: "org_test_dupe",
        name: "Dupe",
        slug: existing.slug,
        ownerName: "Dupe Owner",
        ownerEmail: "dupe@nexora.app",
        logoUrl: null,
        brandColor: "#6366f1",
        accentColor: "#22d3ee",
        tagline: "Dupe",
        currency: "INR",
        timezone: "Asia/Kolkata",
        mode: "DEMO",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Unique violation/);
  });

  it("persists to disk and reloads", async () => {
    await db.insert("businesses", {
      id: "biz_test_persist",
      organizationId: orgId,
      leadId: null,
      name: "Persist Co",
      category: "Retail",
      subcategory: "",
      city: "Lucknow",
      region: "Uttar Pradesh",
      country: "India",
      address: "",
      latitude: null,
      longitude: null,
      website: null,
      mapsUrl: null,
      phone: null,
      email: null,
      rating: null,
      reviewCount: 0,
      socialLinks: {},
      discoverySource: "MANUAL",
      discoveredAt: new Date().toISOString(),
      raw: {},
    });
    await db.flush();
    resetDb();
    expect(await db.byId("businesses", "biz_test_persist")).toBeTruthy();
  });

  it("insertMany writes every row and keeps the id index consistent", async () => {
    const rows = [1, 2, 3].map((n) => ({
      id: `biz_test_bulk_${n}`,
      organizationId: orgId,
      leadId: null,
      name: `Bulk ${n}`,
      category: "Retail",
      subcategory: "",
      city: "Lucknow",
      region: "Uttar Pradesh",
      country: "India",
      address: "",
      latitude: null,
      longitude: null,
      website: null,
      mapsUrl: null,
      phone: null,
      email: null,
      rating: null,
      reviewCount: 0,
      socialLinks: {},
      discoverySource: "MANUAL" as const,
      discoveredAt: new Date().toISOString(),
      raw: {},
    }));
    const out = await db.insertMany("businesses", rows);
    expect(out).toHaveLength(3);
    for (const row of out) expect(await db.byId("businesses", row.id)).toBeTruthy();
    for (const row of out) await db.delete("businesses", row.id);
  });

  it("writes to the configured data directory", () => {
    expect(process.env.NEXORA_DB_FILE).toBeTruthy();
    expect(process.env.NEXORA_DB_FILE).toContain("nexora-test-");
  });
});
