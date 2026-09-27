import { expect, it } from "vitest";
import { parseBody, SignupInput, safeNext, assertSameOrigin, limitAuth } from "@/lib/security/http";

it("rejects malformed and oversized input with client errors", async () => {
  const request = (body: string) => new Request("https://example.com/api/auth/signup", { method: "POST", body });
  await expect(parseBody(request('{"email":13}'), SignupInput)).rejects.toMatchObject({ status: 400 });
  await expect(parseBody(request('not-json'), SignupInput)).rejects.toMatchObject({ status: 400 });
  await expect(parseBody(request('x'.repeat(300000)), SignupInput)).rejects.toMatchObject({ status: 413 });
});
it("blocks cross-site actions and unsafe post-login destinations", () => {
  expect(() => assertSameOrigin(new Request("https://example.com/api/settings", { headers: { origin: "https://attacker.example" } }))).toThrow();
  for (const destination of ["https://attacker.example", "//attacker.example", "/\\attacker.example"]) expect(safeNext(destination)).toBe("/dashboard");
  expect(safeNext("/leads")).toBe("/leads");
});
it("limits repeated authentication attempts", () => {
  for (let i = 0; i < 10; i++) limitAuth("rate-test@example.com", 1000);
  expect(() => limitAuth("rate-test@example.com", 1000)).toThrow();
  expect(() => limitAuth("rate-test@example.com", 62000)).not.toThrow();
});
