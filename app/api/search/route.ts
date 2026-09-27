import { globalSearch } from "@/lib/search";
import { handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handler(async (ctx, req) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await globalSearch(ctx.session.organizationId, q, 10);
  return json({ results });
});
