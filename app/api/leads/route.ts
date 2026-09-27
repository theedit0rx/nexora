import { createLeadFromBusiness } from "@/lib/agents/discovery";
import { logActivity } from "@/lib/events/bus";
import { fail, handler, json, readBody } from "@/lib/api";
import type { DiscoveredBusiness } from "@/lib/providers/lead-sources";

export const dynamic = "force-dynamic";

/** Manually add a lead. */
export const POST = handler(async (ctx, req) => {
  const body = await readBody<Partial<DiscoveredBusiness>>(req);
  if (!body.name?.trim()) return fail("A business name is required", 400);
  const lead = await createLeadFromBusiness(ctx.session.organizationId, {
    name: body.name.trim(),
    category: body.category?.trim() || "Local Business",
    subcategory: body.subcategory ?? "",
    city: body.city ?? "",
    region: body.region ?? "",
    country: body.country ?? "India",
    address: body.address ?? "",
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    website: body.website ?? null,
    mapsUrl: body.mapsUrl ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    rating: body.rating ?? null,
    reviewCount: body.reviewCount ?? 0,
    socialLinks: body.socialLinks ?? {},
    discoverySource: "MANUAL",
  });
  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    agentKey: "scout",
    actionType: "lead.discovered",
    title: `Lead added manually: ${lead.name}`,
    detail: "Entered by the owner",
    entityType: "lead",
    entityId: lead.id,
    leadId: lead.id,
    status: "OK",
  });
  return json({ ok: true, lead });
});
