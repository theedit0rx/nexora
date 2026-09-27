import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Isolate every test run in its own store file. */
const dir = mkdtempSync(join(tmpdir(), "nexora-test-"));
process.env.NEXORA_DB_FILE = join(dir, "nexora.json");
process.env.NEXORA_SITE_ROOT = join(dir, "generated");
process.env.NEXORA_SESSION_SECRET = "test-secret-value-for-vitest-only";

process.on("exit", () => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});
