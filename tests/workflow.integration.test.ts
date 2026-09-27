import { expect, it } from "vitest";
import { signup } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createLeadFromBusiness } from "@/lib/agents/discovery";
import { runPipeline } from "@/lib/workflows/pipeline";
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("runs a local lead through research, scoring, generation, QA, preview and an unsent outreach draft", async () => {
  const account = await signup({ email: "workflow@example.com", password: "test-only-password-123", fullName: "Test Owner", organizationName: "Workflow Agency" });
  expect(account.ok).toBe(true); if (!account.ok) return;
  const org = account.session.organizationId;
  const settings = (await db.findOne("settings", { organizationId: org }))!;
  await db.update("settings", settings.id, { automation: { ...settings.automation, automaticDemoCreation: true } });
  const lead = await createLeadFromBusiness(org, {
    name: "Fixture Web Studio", category: "Professional services", city: "Patna", subcategory: "", region: "Bihar", country: "India",
    address: "", latitude: null, longitude: null, website: null, mapsUrl: null, phone: null, email: "fixture@example.com",
    rating: null, reviewCount: 0, socialLinks: {}, discoverySource: "MANUAL",
  });
  const result = await runPipeline(org, lead.id);
  expect(result.results, JSON.stringify(result.results)).toHaveLength(8);
  expect(result.completed, JSON.stringify(result.results)).toBe(true);
  const demo = (await db.find("demo_sites", { organizationId: org, leadId: lead.id }))[0];
  const html = readFileSync(join(demo.outputDir, "index.html"), "utf8");
  expect(html).toContain('<main id="main">'); expect(html).not.toContain('<main id="main" hidden>');
  expect(html).not.toContain('href="//"');
  expect(html).toContain('name="robots" content="noindex,nofollow"');
  const outreach = await db.find("outreach_messages", { organizationId: org });
  expect(outreach).toHaveLength(1); expect(["DRAFT", "WAITING_APPROVAL"]).toContain(outreach[0].status);
  await db.update("settings", settings.id, { autonomy: { ...settings.autonomy, paused: true } });
  expect((await runPipeline(org, lead.id)).completed).toBe(false);
  await expect(runPipeline("another-organization", lead.id)).rejects.toThrow("Lead not found");
});
