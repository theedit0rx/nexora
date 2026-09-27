import { createSessionFrom, login, setSessionCookie } from "@/lib/auth/session";
import { fail, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readBody<{ email?: string; password?: string; next?: string }>(req);
  const result = await login(body.email ?? "", body.password ?? "");
  if (!result.ok) return fail(result.error, 401);
  await setSessionCookie(await createSessionFrom(result.session));
  return json({ ok: true, next: body.next ?? "/dashboard" });
}
