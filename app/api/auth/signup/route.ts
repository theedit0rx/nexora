import { createSession, setSessionCookie, signup } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readBody<{
    email?: string;
    password?: string;
    fullName?: string;
    organizationName?: string;
  }>(req);
  const result = await signup({
    email: body.email ?? "",
    password: body.password ?? "",
    fullName: body.fullName ?? "",
    organizationName: body.organizationName ?? "",
  });
  if (!result.ok) return json({ ok: false, error: result.error }, 400);
  const user = await db.byId("users", result.session.userId);
  if (user) await setSessionCookie(await createSession(user));
  return json({ ok: true, next: "/dashboard" });
}
