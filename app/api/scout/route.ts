import { scoutDiscover } from "@/lib/agents/discovery";
import { getSettings } from "@/lib/agents/sales";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req) => {
  const body = await readBody<{
    city?: string;
    category?: string;
    limit?: number;
    source?: "auto" | "google_places" | "web_search" | "csv" | "manual";
    csvText?: string;
  }>(req);
  if (!body.city || !body.category) return fail("A city and category are required", 400);

  const settings = await getSettings(ctx.session.organizationId);
  if (settings.autonomy.paused) return fail("Autonomy is paused. Resume before running discovery.", 409);

  const result = await scoutDiscover(ctx.session.organizationId, {
    city: body.city,
    category: body.category,
    limit: body.limit ?? 20,
    source: body.source ?? "auto",
    csvText: body.csvText,
  });
  if (!result.ok) return fail(result.error, 409);
  return json({
    ok: true,
    discovered: result.value.discovered,
    created: result.value.created,
    duplicates: result.value.duplicates,
    source: result.value.source,
    note: result.value.note,
    leads: result.value.leads,
  });
});
