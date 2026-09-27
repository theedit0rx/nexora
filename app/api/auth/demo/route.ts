import { loginDemo, setSessionCookie } from "@/lib/auth/session";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await loginDemo();
  if (!result.ok) return json({ ok: false, error: result.error }, 400);
  const user = await db.byId("users", result.session.userId);
  if (!user) return json({ ok: false, error: "Demo user missing" }, 500);
  await setSessionCookie(await createSession(user));
  return json({ ok: true, next: "/dashboard" });
}
