import { parseBody, SignupInput, limitAuth } from "@/lib/security/http";
import { createSession, setSessionCookie, signup } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { json, publicHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = publicHandler(async (req: Request) => {
  const body = await parseBody(req, SignupInput);
  limitAuth(body.email);
  const result = await signup(body);
  if (!result.ok) return json({ ok: false, error: result.error }, 400);
  const user = await db.byId("users", result.session.userId);
  if (user) await setSessionCookie(await createSession(user));
  return json({ ok: true, next: "/dashboard" });
});
