import { db } from "@/lib/db";
import { nowIso, type TicketStatus } from "@/lib/db/schema";
import { logActivity } from "@/lib/events/bus";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUSES: TicketStatus[] = ["OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export const POST = handler(async (ctx, req, params) => {
  const ticket = await db.byId("support_tickets", params.id);
  if (!ticket || ticket.organizationId !== ctx.session.organizationId) return fail("Ticket not found", 404);
  const body = await readBody<{ status?: TicketStatus; resolution?: string }>(req);
  if (body.status && !STATUSES.includes(body.status)) return fail("Invalid ticket status", 400);

  const updated = await db.update("support_tickets", ticket.id, {
    ...(body.status ? { status: body.status } : {}),
    ...(body.resolution !== undefined ? { resolution: body.resolution } : {}),
    updatedAt: nowIso(),
  });
  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    agentKey: "support",
    actionType: "support.updated",
    title: `Ticket updated: ${ticket.subject}`,
    detail: `${body.status ?? ticket.status}${body.resolution ? ` · ${body.resolution}` : ""}`,
    entityType: "ticket",
    entityId: ticket.id,
    clientId: ticket.clientId,
    status: "OK",
  });
  return json({ ok: true, ticket: updated });
});
