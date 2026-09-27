import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { OrganizationSchema } from "@/lib/db/schema";
import { tenantById } from "@/lib/db/tenant";
import { ensureAgentRegistry, getAgent } from "@/lib/agents/registry";
import { markAgentWorking, runTask } from "@/lib/tasks/engine";
import { defaultSettings, hashPassword, verifyPassword } from "@/lib/bootstrap";
import { getDeploymentProvider } from "@/lib/providers/messaging";
import { isPublicAddress, validatePublicUrl } from "@/lib/security/public-web";

beforeAll(async () => {
  for (const id of ["org_security_a", "org_security_b"]) {
    await db.insert("organizations", OrganizationSchema.parse({ id, name: id, slug: id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    await ensureAgentRegistry(id);
    await defaultSettings(id);
  }
});

describe("tenant boundaries", () => {
  it("does not load another organization's resource", async () => {
    const agent = await getAgent("org_security_b", "scout");
    expect(await tenantById("org_security_a", "agent_definitions", agent!.id)).toBeNull();
    expect(await tenantById("org_security_b", "agent_definitions", agent!.id)).not.toBeNull();
  });
  it("updates only the requested organization's agent status and metrics", async () => {
    await markAgentWorking("org_security_b", "scout", null, "B's work");
    expect((await getAgent("org_security_a", "scout"))?.state).toBe("IDLE");
    expect((await getAgent("org_security_b", "scout"))?.state).toBe("WORKING");
    await runTask({ organizationId: "org_security_b", agentKey: "scout" }, "test", async () => ({ ok: true }));
    expect((await getAgent("org_security_a", "scout"))?.runsToday).toBe(0);
    expect((await getAgent("org_security_b", "scout"))?.runsToday).toBe(1);
  });
  it("blocks task execution while workspace automation is paused", async () => {
    const settings = (await db.findOne("settings", { organizationId: "org_security_a" }))!;
    await db.update("settings", settings.id, { autonomy: { ...settings.autonomy, paused: true } });
    const execute = vi.fn();
    const result = await runTask({ organizationId: "org_security_a", agentKey: "scout" }, "test", execute);
    expect(execute).not.toHaveBeenCalled();
    expect(result.task.status).toBe("BLOCKED");
  });
});

describe("authentication and deployment", () => {
  it("salts password hashes and rejects incorrect or legacy hashes", async () => {
    const first = await hashPassword("correct horse battery staple");
    expect(await hashPassword("correct horse battery staple")).not.toBe(first);
    expect(await verifyPassword("correct horse battery staple", first)).toBe(true);
    expect(await verifyPassword("wrong", first)).toBe(false);
    expect(await verifyPassword("anything", "a".repeat(64))).toBe(false);
  });
  it("refuses production deployment without a connected provider", async () => {
    vi.stubEnv("VERCEL_TOKEN", ""); vi.stubEnv("VERCEL_PROJECT_ID", "");
    try {
      expect(getDeploymentProvider("PRODUCTION").available).toBe(false);
      const result = await getDeploymentProvider("PREVIEW").deploy({ name: "test", kind: "PRODUCTION", files: [] });
      expect(result.ok).toBe(false);
    } finally { vi.unstubAllEnvs(); }
  });
});

describe("public website audit boundary", () => {
  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fe80::1", "fc00::1"])("rejects private address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it.each(["http://localhost", "http://2130706433", "http://[::1]", "file:///etc/passwd", "https://user:pass@example.com", "http://example.com:8080"])("rejects unsafe URL %s", (url) => {
    expect(() => validatePublicUrl(url)).toThrow();
  });
  it("accepts public HTTPS URLs and public addresses", () => {
    expect(validatePublicUrl("https://example.com/path").hostname).toBe("example.com");
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
});
