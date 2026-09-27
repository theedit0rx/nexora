import Link from "next/link";
import { Activity, Bot, Pause, Play, Settings2, Zap } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, PageBody, Grid } from "@/components/shared/page-header";
import { AgentControlButton } from "@/components/agents/agent-control";
import { AgentStateBadge } from "@/components/dashboard/lead-detail-drawer";
import { Badge, Button, Card, CardBody, EmptyState, Progress } from "@/components/ui";
import { num, percent, relative } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERMISSION_HELP: Record<string, string> = {
  GREEN: "Runs autonomously and only logs the outcome.",
  YELLOW: "Acts autonomously, but asks before anything irreversible or external.",
  RED: "Never acts. Produces a proposal that the owner must approve.",
};

export default async function AgentsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const [agents, tasks, runs, settings] = await Promise.all([
    db.find("agent_definitions", { organizationId: orgId }),
    db.find("agent_tasks", { organizationId: orgId }),
    db.find("agent_runs", { organizationId: orgId }),
    db.findOne("settings", { organizationId: orgId }),
  ]);

  const tasksByAgent = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByAgent.get(t.agentKey) ?? [];
    list.push(t);
    tasksByAgent.set(t.agentKey, list);
  }
  const runsByAgent = new Map<string, typeof runs>();
  for (const r of runs) {
    const list = runsByAgent.get(r.agentKey) ?? [];
    list.push(r);
    runsByAgent.set(r.agentKey, list);
  }

  const working = agents.filter((a) => a.state === "WORKING").length;
  const paused = agents.filter((a) => a.paused).length;

  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="Agents"
        description="Fourteen specialists that run the agency. Each has an explicit permission level, a daily budget and a live state you can override."
        actions={
          <Link href="/activity">
            <Button variant="outline" size="sm">
              <Activity className="h-3.5 w-3.5" />
              Full activity feed
            </Button>
          </Link>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-ink-muted">
          <span>
            <strong className="tnum text-ink">{agents.length}</strong> agents registered
          </span>
          <span>
            <strong className="tnum text-ink">{working}</strong> working
          </span>
          <span>
            <strong className="tnum text-ink">{paused}</strong> paused
          </span>
          {settings?.autonomy.paused && (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
              Kill switch engaged — all agents parked
            </span>
          )}
        </div>

        {agents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bot className="h-4 w-4" />}
              title="No agents registered"
              description="The agent registry is created on first load of an authenticated page."
            />
          </Card>
        ) : (
          <Grid className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => {
              const myTasks = tasksByAgent.get(agent.key) ?? [];
              const myRuns = runsByAgent.get(agent.key) ?? [];
              const queued = myTasks.filter((t) => t.status === "QUEUED" || t.status === "RUNNING").length;
              const failed = myRuns.filter((r) => r.status === "FAILED").length;
              const successRate = myRuns.length > 0 ? (myRuns.length - failed) / myRuns.length : null;
              return (
                <Card key={agent.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-3 border-b border-line p-3.5">
                    <div className="flex min-w-0 gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-[11px] font-bold uppercase text-brand-300">
                        {agent.key.slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/agents/${agent.key}`} className="block truncate text-[13px] font-semibold text-ink hover:text-brand-200">
                          {agent.name}
                        </Link>
                        <p className="truncate text-[10.5px] text-ink-faint">{agent.key}</p>
                      </div>
                    </div>
                    <AgentStateBadge state={agent.state} />
                  </div>
                  <CardBody className="flex flex-1 flex-col gap-3">
                    <p className="line-clamp-3 text-[12px] leading-relaxed text-ink-muted">{agent.description}</p>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={agent.permissionLevel === "RED" ? "danger" : agent.permissionLevel === "YELLOW" ? "warning" : "success"}>
                        <Zap className="h-2.5 w-2.5" />
                        {agent.permissionLevel}
                      </Badge>
                      {agent.purpose && <Badge tone="neutral">{agent.purpose.replace(/_/g, " ").toLowerCase()}</Badge>}
                      {String(agent.config.schedule ?? "") && <Badge tone="info">{String(agent.config.schedule)}</Badge>}
                    </div>

                    <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1">
                      {[
                        ["Runs today", num(agent.runsToday)],
                        ["Runs today", num(agent.runsToday)],
                        ["Queued", num(queued)],
                        ["Success", successRate === null ? "—" : percent(successRate * 100)],
                        ["Avg execution", agent.avgExecutionMs ? `${(agent.avgExecutionMs / 1000).toFixed(1)}s` : "—"],
                        ["Last run", agent.lastRunAt ? relative(agent.lastRunAt) : "never"],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[10px] uppercase tracking-wider text-ink-faint">{k}</dt>
                          <dd className="tnum text-[12px] text-ink">{v}</dd>
                        </div>
                      ))}
                    </dl>

                    {agent.avgExecutionMs > 0 && <Progress value={Math.min(100, agent.successRate * 100)} className="mt-1" />}

                    <p className="text-[10.5px] leading-relaxed text-ink-faint">
                      {PERMISSION_HELP[agent.permissionLevel] ?? agent.permissionLevel}
                    </p>

                    <div className="flex items-center gap-2 border-t border-line pt-3">
                      <AgentControlButton agentKey={agent.key} paused={agent.paused} />
                      <Link href={`/agents/${agent.key}`}>
                        <Button variant="ghost" size="sm">
                          <Settings2 className="h-3.5 w-3.5" />
                          Details
                        </Button>
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </Grid>
        )}
      </PageBody>
    </>
  );
}

