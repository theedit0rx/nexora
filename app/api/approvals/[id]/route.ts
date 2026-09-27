import { resolveApproval } from "@/lib/approvals";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(
  async (ctx, req, params) => {
    const body = await readBody<{
      decision?: "APPROVED" | "REJECTED";
      note?: string;
      modifiedPayload?: Record<string, unknown>;
    }>(req);
    if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
      return fail("A decision of APPROVED or REJECTED is required", 400);
    }
    const result = await resolveApproval({
      organizationId: ctx.session.organizationId,
      approvalId: params.id,
      decision: body.decision,
      note: body.note,
      decidedBy: ctx.session.userId,
      modifiedPayload: body.modifiedPayload,
    });
    return json({
      ok: true,
      approval: result.approval,
      executed: result.executed,
      result: result.result,
      error: result.error,
    });
  },
  { ownerOnly: true },
);
