import { outreachSend } from "@/lib/agents/sales";
import { fail, handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req, params) => {
  try {
    const result = await outreachSend(ctx.session.organizationId, params.id);
    if (!result.ok) return fail(result.error ?? "Send failed", 409);
    return json({ ok: true, providerMessageId: result.providerMessageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, 409);
  }
});
