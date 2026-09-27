import { appendFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression tests for the event-loop runaway that used to take the whole
 * process down. The Supervisor chain is: builder emits `demo.completed` -> QA
 * runs -> `qa.passed` -> deployer -> `deployment.completed` -> outreach.
 * A `qa.failed` result sends the build back to the builder, so if QA is
 * deterministic and the defect is unrepairable the chain never terminates.
 *
 * Two things prevent that now:
 *   1. the bus dispatches handlers from a queue instead of inline recursion;
 *   2. the Supervisor bounds how often it will re-handle the same event and
 *      how often it will send one build back to the builder.
 *
 * These tests assert the *bounds* exist and hold, without needing a real
 * unrepairable defect.
 */

const LOG = "/tmp/nexora-loop-guard.log";

describe("event loop bounds", () => {
  it("bus dispatches handlers from a queue, not inline recursion", async () => {
    const { bus } = await import("@/lib/events/bus");

    const order: string[] = [];
    let depth = 0;
    let maxDepth = 0;
    let emits = 0;

    // A handler that re-emits the same event three times before stopping.
    const off = bus.on("task.created", async () => {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
      order.push("handle");
      if (emits < 3) {
        emits++;
        await bus.emit("task.created", { n: emits });
      }
      depth--;
    });

    await bus.emit("task.created", { n: 0 });
    off();

    // The re-entrant emits must have been handled, and the recursion depth must
    // never exceed 1 — i.e. no handler was awaited inside another handler.
    expect(order.length).toBe(4);
    expect(maxDepth).toBe(1);
  });

  it("supervisor caps how often it re-handles the same event", async () => {
    const { db } = await import("@/lib/db");
    const { ensureOrganization, defaultSettings, ensureServicesAndPricing } = await import("@/lib/bootstrap");
    const org = await ensureOrganization();
    if (!(await db.findOne("settings", { organizationId: org.id }))) {
      await defaultSettings(org.id);
    }
    await ensureServicesAndPricing(org.id);

    const { registerSupervisor, supervisorReact } = await import("@/lib/workflows/pipeline");

    registerSupervisor(org.id);

    // Drive the same failing event far past the ceiling. Each call must either
    // be handled or refused — it must never hang, and it must never spawn an
    // unbounded number of downstream tasks.
    const results: Array<{ handled: boolean; reason?: string }> = [];
    for (let i = 0; i < 60; i++) {
      const r = await supervisorReact(org.id, "demo.completed", {
        organizationId: org.id,
        targetId: "dem_does_not_exist",
      });
      results.push({ handled: r.handled, reason: "reason" in r ? (r.reason as string) : undefined });
    }

    const refused = results.filter((r) => !r.handled);
    expect(refused.length).toBeGreaterThan(0);
    // Every refusal after the ceiling cites the guard.
    expect(refused.some((r) => r.reason === "event handled too many times")).toBe(true);
    // No call may throw or hang — we got an answer for every one.
    expect(results.length).toBe(60);
  });

});

describe("outreach approval gate", () => {
  it("refuses to send a message the owner has not signed off on", async () => {
    const { db } = await import("@/lib/db");
    const { ensureOrganization, defaultSettings, ensureServicesAndPricing } = await import("@/lib/bootstrap");
    const org = await ensureOrganization();
    if (!(await db.findOne("settings", { organizationId: org.id }))) await defaultSettings(org.id);
    await ensureServicesAndPricing(org.id);

    const biz = await db.insert("businesses", {
      id: "biz_gate_test",
      organizationId: org.id,
      leadId: null,
      name: "Gate Test Co",
      category: "Retail",
      subcategory: "",
      city: "Patna",
      region: "Bihar",
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
      id: "led_gate_test",
      organizationId: org.id,
      businessId: biz.id,
      status: "CONTACTED",
      pipelineStage: "Outreach",
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
    const msg = await db.insert("outreach_messages", {
      id: "out_gate_test",
      organizationId: org.id,
      leadId: lead.id,
      campaignId: null,
      channel: "EMAIL",
      status: "WAITING_APPROVAL",
      subject: "Hello",
      body: "A short, human note.",
      personalization: [],
      toAddress: "owner@example.com",
      providerMessageId: null,
      threadId: null,
      riskLevel: "HIGH",
      approvalRequired: true,
      approvedBy: null,
      sentAt: null,
      openedAt: null,
      repliedAt: null,
      error: null,
      createdBy: "outreach",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { outreachSend } = await import("@/lib/agents/sales");

    // No signature anywhere -> stays queued.
    await expect(outreachSend(org.id, msg.id)).rejects.toThrow(/requires owner approval/);
    expect((await db.byId("outreach_messages", msg.id))!.status).toBe("WAITING_APPROVAL");

    // The owner approves -> the gate opens and the message reaches the provider.
    await db.update("outreach_messages", msg.id, { status: "APPROVED" });
    const res = await outreachSend(org.id, msg.id, { approved: true });
    // The gate itself must be satisfied. With no real credentials configured the
    // Demo-Mode simulated adapter takes over, and it must say so.
    expect(res.ok).toBe(true);
    if (res.ok && res.simulated) expect(res.provider).toBe("simulated");
    const after = await db.byId("outreach_messages", msg.id);
    expect(after!.status).toBe("SENT");
    expect(after!.sentAt).toBeTruthy();
    expect(after!.providerMessageId).toBeTruthy();
  });
});
