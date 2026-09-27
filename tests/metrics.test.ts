import { describe, expect, it } from "vitest";
import { computeDashboard } from "@/lib/metrics";

/* Metric semantics must never fake a number: zero-denominator rates are null,
   and `hasData` gates the analytics empty states. */

describe("computeDashboard", () => {
  it("reports null rates when there is no outreach", async () => {
    const org = "org_metrics_empty";
    const m = await computeDashboard(org);
    expect(m.replyRate).toBeNull();
    expect(m.proposals.acceptanceRate).toBeNull();
    expect(m.leadsDiscovered).toBe(0);
    expect(m.pipelineValue).toBe(0);
    expect(m.funnel.every((f) => f.count === 0)).toBe(true);
  });
});
