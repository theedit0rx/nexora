import { db } from "@/lib/db";
import { nowIso, type Settings } from "@/lib/db/schema";
import { logActivity } from "@/lib/events/bus";
import { fail, handler, json, readBody } from "@/lib/api";
import { defaultSettings } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  const { requireAuth } = await import("@/lib/auth/session");
  try {
    const ctx = await requireAuth();
    let settings = await db.findOne("settings", { organizationId: ctx.session.organizationId });
    if (!settings) settings = await defaultSettings(ctx.session.organizationId);
    return json({ ok: true, settings });
  } catch {
    return fail("Not authenticated", 401);
  }
}

export const POST = handler(async (ctx, req) => {
  const body = await readBody<{ patch?: Partial<Settings> }>(req);
  if (!body.patch) return fail("A settings patch is required", 400);
  let settings = await db.findOne("settings", { organizationId: ctx.session.organizationId });
  if (!settings) settings = await defaultSettings(ctx.session.organizationId);

  // Merge only known top-level sections to avoid injecting arbitrary keys.
  const sections = [
    "automation",
    "permissions",
    "outreach",
    "leadSources",
    "ai",
    "company",
    "autonomy",
    "notifications",
  ] as const;
  const patch: Partial<Settings> = {};
  for (const section of sections) {
    if (body.patch[section]) {
      (patch as Record<string, unknown>)[section] = {
        ...(settings[section] as Record<string, unknown>),
        ...(body.patch[section] as Record<string, unknown>),
      };
    }
  }
  const updated = await db.update("settings", settings.id, { ...patch, updatedAt: nowIso() });

  await db.insert("audit_logs", {
    id: `aud_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    actorId: ctx.session.userId,
    actorLabel: ctx.user.fullName,
    action: "settings.updated",
    entityType: "settings",
    entityId: settings.id,
    before: { sections: Object.keys(body.patch) },
    after: patch as Record<string, unknown>,
    ip: "",
    createdAt: nowIso(),
  });
  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    actionType: "settings.updated",
    title: "Settings updated",
    detail: Object.keys(body.patch).join(", "),
    status: "OK",
  });
  return json({ ok: true, settings: updated });
});
