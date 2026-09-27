import Link from "next/link";
import { Inbox, MessageSquare } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { ConversationList } from "@/components/conversations/inbox";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATE_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent"> = {
  OPEN: "neutral",
  QUALIFYING: "brand",
  QUALIFIED: "success",
  INTERESTED: "success",
  PROPOSAL_SENT: "accent",
  WAITING_ON_PROSPECT: "warning",
  WAITING_ON_OWNER: "warning",
  OBJECTION: "danger",
  CLOSED_WON: "success",
  CLOSED_LOST: "neutral",
};

export default async function ConversationsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [conversations, messages, leads, clients] = await Promise.all([
    db.find("conversations", { organizationId: orgId }),
    db.find("messages", { organizationId: orgId }),
    db.find("leads", { organizationId: orgId }),
    db.find("clients", { organizationId: orgId }),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const byConversation = new Map<string, typeof messages>();
  for (const m of messages) {
    const list = byConversation.get(m.conversationId) ?? [];
    list.push(m);
    byConversation.set(m.conversationId, list);
  }

  const items = conversations
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => {
      const thread = (byConversation.get(c.id) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const lead = c.leadId ? leadById.get(c.leadId) : null;
      const client = c.clientId ? clientById.get(c.clientId) : null;
      return {
        id: c.id,
        subject: c.subject,
        channel: c.channel,
        state: c.state,
        lastIntent: c.lastIntent,
        unreadCount: c.unreadCount,
        counterparty: client?.name ?? lead?.businessId ?? "Prospect",
        leadId: c.leadId,
        clientId: c.clientId,
        messages: thread.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          subject: m.subject,
          createdAt: m.createdAt,
          intent: m.intent,
          intentConfidence: m.intentConfidence,
          suggestedReply: m.suggestedReply,
          isFromAgent: m.isFromAgent,
          agentKey: m.agentKey,
        })),
      };
    });

  const unread = items.reduce((acc, c) => acc + c.unreadCount, 0);
  const waiting = items.filter((c) => c.state === "WAITING_ON_OWNER").length;

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Conversations"
        description="Every prospect and client thread, with the intent the Sales agent classified for each reply."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <MessageSquare className="h-2.5 w-2.5" />
            {num(items.length)} threads
          </Badge>
          {unread > 0 && <Badge tone="warning">{num(unread)} unread</Badge>}
          {waiting > 0 && <Badge tone="danger">{num(waiting)} waiting on you</Badge>}
        </div>

        <Card>
          <CardBody>
            {items.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-4 w-4" />}
                title="No conversations yet"
                description="Threads appear here as soon as a prospect replies to outreach."
              />
            ) : (
              <ConversationList
                items={items.map((c) => ({ ...c, stateTone: STATE_TONE[c.state] ?? "neutral" }))}
              />
            )}
          </CardBody>
        </Card>

        <p className="px-1 text-[11px] text-ink-faint">
          Replying here sends through the connected channel and asks the Sales agent to classify the next inbound reply.
          See <Link href="/settings?section=integrations" className="text-brand-300">integrations</Link> to connect a
          live provider.
        </p>
      </PageBody>
    </>
  );
}
