import { runCopilot } from "@/lib/copilot";
import { handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req) => {
  const body = await readBody<{ query?: string }>(req);
  const response = await runCopilot(body.query ?? "", ctx.session.organizationId);
  return json(response);
});
