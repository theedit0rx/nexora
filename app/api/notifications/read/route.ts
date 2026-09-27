import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx) => {
  const unread = (await db.find("notifications", { organizationId: ctx.session.organizationId })).filter(
    (n) => !n.read,
  );
  for (const n of unread) await db.update("notifications", n.id, { read: true });
  return json({ ok: true, marked: unread.length });
});
