import { describe, expect, it } from "vitest";
import { runCopilot } from "@/lib/copilot";

/* The copilot must never claim a destructive action happened. Anything gated
   returns a `confirm_action` action that the UI resolves through the API, and
   the reply wording must stay in the future/conditional tense. */

const ORG = "org_copilot_test";

describe("runCopilot", () => {
  it("answers help questions with the capability list", async () => {
    const r = await runCopilot("what can you do?", ORG);
    expect(r.reply.length).toBeGreaterThan(60);
    expect(r.actions.some((a) => a.kind === "navigate")).toBe(true);
  });

  it("returns a confirm action for pause autonomy instead of pretending", async () => {
    const r = await runCopilot("pause autonomy", ORG);
    const action = r.actions.find((a) => a.kind === "confirm_action");
    expect(action).toBeTruthy();
    expect(action?.payload?.action).toBe("pause_autonomy");
    // It must not claim the switch was already thrown.
    expect(r.reply.toLowerCase()).not.toMatch(/\bi (have|'ve) (paused|stopped)\b/);
  });

  it("returns a confirm action for pause outreach", async () => {
    const r = await runCopilot("stop sending outreach", ORG);
    const action = r.actions.find((a) => a.kind === "confirm_action");
    expect(action?.payload?.action).toBe("pause_outreach");
  });

  it("counts clients without inventing numbers", async () => {
    const r = await runCopilot("how many clients do I have?", ORG);
    expect(r.reply.toLowerCase()).toMatch(/client/);
  });

  it("explains the score of a named lead", async () => {
    const r = await runCopilot("why is Royal Spice Restaurant scored the way it is?", ORG);
    expect(typeof r.reply).toBe("string");
    expect(r.reply.length).toBeGreaterThan(10);
  });

  it("falls back to global search for unknown questions", async () => {
    const r = await runCopilot("zzzzz-nonexistent-query-zzzzz", ORG);
    expect(typeof r.reply).toBe("string");
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it("never claims a destructive action completed", async () => {
    for (const q of [
      "pause autonomy",
      "stop outreach",
      "pause all agents",
      "reset the demo data",
      "delete everything",
    ]) {
      const r = await runCopilot(q, ORG);
      const combined = r.reply.toLowerCase();
      expect(combined).not.toMatch(/\b(done|completed|deleted|removed|paused successfully)\b/);
    }
  });
});
