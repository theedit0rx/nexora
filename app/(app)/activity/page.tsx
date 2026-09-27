import Link from "next/link";
import { Activity, Bot, Filter, User } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { ActivityFeed } from "@/components/activity/feed";
import { Badge, Button, Card, CardBody, EmptyState } from "@/components/ui";
import { dateTime, num, relative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; status?: string; risk?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [events, agents] = await Promise.all([
    db.find("activity_events", { organizationId: orgId }),
    db.find("agent_definitions", { organizationId: orgId }),
  ]);

  const sorted = events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const agentKeys = Array.from(new Set(sorted.map((e) => e.agentKey).filter(Boolean) as string[]));
  const counts = {
    total: sorted.length,
    agent: sorted.filter((e) => e.actorType === "AGENT").length,
    user: sorted.filter((e) => e.actorType === "USER").length,
    system: sorted.filter((e) => e.actorType === "SYSTEM").length,
    warn: sorted.filter((e) => e.status === "WARN" || e.status === "ERROR").length,
  };
  void params;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Activity feed"
        description="An append-only record of everything the agents and the owner did, in reverse chronological order."
        actions={
          <div className="flex gap-2">
            <Link href="/agents">
              <Button variant="outline" size="sm">
                <Bot className="h-3.5 w-3.5" />
                Agents
              </Button>
            </Link>
          </div>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <Activity className="h-2.5 w-2.5" />
            {num(counts.total)} events
          </Badge>
          <Badge tone="brand">{num(counts.agent)} agent</Badge>
          <Badge tone="info">{num(counts.user)} owner</Badge>
          <Badge tone="neutral">{num(counts.system)} system</Badge>
          {counts.warn > 0 && <Badge tone="warning">{num(counts.warn)} flagged</Badge>}
          <span className="ml-auto hidden text-[11px] text-ink-faint sm:block">
            Newest first · {sorted[0] ? relative(sorted[0].createdAt) : "—"}
          </span>
        </div>

        <Card>
          <CardBody>
            {sorted.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-4 w-4" />}
                title="No activity recorded yet"
                description="Run discovery or a pipeline stage and every action will appear here."
              />
            ) : (
              <ActivityFeed
                events={sorted.map((e) => ({
                  id: e.id,
                  title: e.title,
                  detail: e.detail ?? "",
                  actorType: e.actorType,
                  agentKey: e.agentKey,
                  actionType: e.actionType,
                  status: e.status,
                  riskLevel: e.riskLevel,
                  entityType: e.entityType,
                  entityId: e.entityId,
                  createdAt: e.createdAt,
                }))}
                agents={agentKeys.map((k) => ({ key: k, name: agents.find((a) => a.key === k)?.name ?? k }))}
              />
            )}
          </CardBody>
        </Card>

        <p className="px-1 text-[11px] text-ink-faint">
          Feed ends at {sorted.length > 0 ? dateTime(sorted[sorted.length - 1]!.createdAt) : "—"}. Every row is stored
          locally in the demo workspace and mirrored to Supabase in production.
        </p>
      </PageBody>
    </>
  );
}

