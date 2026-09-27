import { db, newId } from "@/lib/db";
import { nowIso } from "@/lib/db/schema";
import { logActivity } from "@/lib/events/bus";
import { salesHandleInbound } from "@/lib/agents/sales";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx, req, params) => {
  const conversation = await db.byId("conversations", params.id);
  if (!conversation || conversation.organizationId !== ctx.session.organizationId) {
    return fail("Conversation not found", 404);
  }
  const body = await readBody<{ body?: string; subject?: string }>(req);
  if (!body.body?.trim()) return fail("A message body is required", 400);

  const message = await db.insert("messages", {
    id: newId("msg"),
    organizationId: ctx.session.organizationId,
    conversationId: conversation.id,
    direction: "OUTBOUND",
    channel: conversation.channel,
    fromAddress: "owner@nexora.app",
    toAddress: "",
    subject: body.subject ?? `Re: ${conversation.subject}`,
    body: body.body.trim(),
    intent: null,
    intentConfidence: null,
    suggestedReply: null,
    isFromAgent: false,
    agentKey: null,
    readAt: nowIso(),
    createdAt: nowIso(),
  });
  await db.update("conversations", conversation.id, {
    state: "WAITING_ON_PROSPECT",
    unreadCount: 0,
    updatedAt: nowIso(),
  });
  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    actionType: "message.sent",
    title: "Owner replied to a conversation",
    detail: body.body.slice(0, 120),
    entityType: "conversation",
    entityId: conversation.id,
    leadId: conversation.leadId,
    clientId: conversation.clientId,
    status: "OK",
  });

  // Simulate the prospect's inbound reply so the Sales agent classifies it.
  const inbound = await db.insert("messages", {
    id: newId("msg"),
    organizationId: ctx.session.organizationId,
    conversationId: conversation.id,
    direction: "INBOUND",
    channel: conversation.channel,
    fromAddress: "prospect",
    toAddress: "owner@nexora.app",
    subject: `Re: ${conversation.subject}`,
    body: "Thanks for the detail — let me review this with my partner and I'll come back to you this week.",
    intent: null,
    intentConfidence: null,
    suggestedReply: null,
    isFromAgent: false,
    agentKey: null,
    readAt: null,
    createdAt: nowIso(),
  });
  await salesHandleInbound(ctx.session.organizationId, conversation.id, inbound.id, "MANUAL");

  return json({ ok: true, messageId: message.id });
});
