import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { ApprovalList } from "@/components/approvals/approval-list";
import { Badge, Card, CardHeader } from "@/components/ui";
import { num } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [approvals, agents, settings] = await Promise.all([
    db.find("approval_requests", { organizationId: orgId }),
    db.find("agent_definitions", { organizationId: orgId }),
    db.findOne("settings", { organizationId: orgId }),
  ]);

  const sorted = approvals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = sorted.filter((a) => a.status === "PENDING");
  const resolved = sorted.filter((a) => a.status !== "PENDING");
  const canDecide = ctx.session.role === "OWNER" || ctx.session.role === "ADMIN";

  const agentName = (key: string | null) => agents.find((a) => a.key === key)?.name ?? key ?? "system";

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Approvals"
        description="Gated actions. NEXORA never performs an irreversible or external step without your explicit approval."
        actions={
          <Link href="/agents">
            <Badge tone="neutral" className="cursor-pointer hover:border-brand-500/40">
              <ShieldCheck className="h-2.5 w-2.5" />
              Permission levels
            </Badge>
          </Link>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={pending.length > 0 ? "warning" : "success"}>
            {pending.length > 0 ? `${num(pending.length)} waiting` : "nothing waiting"}
          </Badge>
          <Badge tone="neutral">{num(resolved.length)} resolved</Badge>
          <span className="text-[11.5px] text-ink-muted">
            {canDecide ? "You can approve and reject." : "Only the workspace owner can decide."}
          </span>
        </div>

        <Card>
          <CardHeader
            title="Awaiting your decision"
            subtitle={pending.length > 0 ? "Newest first" : "The queue is empty"}
          />
          <ApprovalList
            canDecide={canDecide}
            autonomyPaused={Boolean(settings?.autonomy.paused)}
            items={pending.map((a) => ({
              id: a.id,
              action: a.action,
              title: a.title,
              reason: a.reason,
              requestingAgent: a.requestingAgent ? agentName(a.requestingAgent) : null,
              permissionLevel: a.permissionLevel,
              riskLevel: a.riskLevel,
              status: a.status,
              payload: (a.payload ?? {}) as Record<string, unknown>,
              decisionNote: a.decisionNote,
              createdAt: a.createdAt,
              resolvedAt: a.decidedAt,
              entityType: a.entityType,
              entityId: a.entityId,
            }))}
          />
        </Card>

        {resolved.length > 0 && (
          <Card>
            <CardHeader title="Decision history" subtitle="Last 30 resolved requests" />
            <ApprovalList
              canDecide={canDecide}
              autonomyPaused={Boolean(settings?.autonomy.paused)}
              items={resolved.slice(0, 30).map((a) => ({
                id: a.id,
                action: a.action,
                title: a.title,
                reason: a.reason,
                requestingAgent: a.requestingAgent ? agentName(a.requestingAgent) : null,
                permissionLevel: a.permissionLevel,
                riskLevel: a.riskLevel,
                status: a.status,
                payload: (a.payload ?? {}) as Record<string, unknown>,
                decisionNote: a.decisionNote,
                createdAt: a.createdAt,
                resolvedAt: a.decidedAt,
                entityType: a.entityType,
                entityId: a.entityId,
              }))}
            />
          </Card>
        )}
      </PageBody>
    </>
  );
}
