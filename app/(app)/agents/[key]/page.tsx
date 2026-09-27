import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Clock, ListTree } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageBody } from "@/components/shared/page-header";
import { AgentControlButton } from "@/components/agents/agent-control";
import { AgentStateBadge } from "@/components/dashboard/lead-detail-drawer";
import { Badge, Card, CardBody, CardHeader, EmptyState, Progress } from "@/components/ui";
import { dateTime, duration, num, percent, relative } from "@/lib/utils";
import { AGENT_SEEDS } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return AGENT_SEEDS.map((a) => ({ key: a.key }));
}

export default async function AgentDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const agent = (await db.find("agent_definitions", { organizationId: orgId })).find((a) => a.key === key);
  if (!agent) notFound();

  const [runs, tasks, logs, allAgents] = await Promise.all([
    db.find("agent_runs", { organizationId: orgId, agentKey: agent.key }),
    db.find("agent_tasks", { organizationId: orgId, agentKey: agent.key }),
    db.find("agent_logs", { organizationId: orgId, agentKey: agent.key }),
    db.find("agent_definitions", { organizationId: orgId }),
  ]);

  const myRuns = runs.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const myTasks = tasks.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const myLogs = logs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
  const failed = myRuns.filter((r) => r.status === "FAILED").length;
  const successRate = myRuns.length > 0 ? (myRuns.length - failed) / myRuns.length : null;
  const avgMs = myRuns.length > 0 ? myRuns.reduce((a, r) => a + (r.durationMs ?? 0), 0) / myRuns.length : null;
  const upstream = allAgents.filter((a) => a.key !== agent.key).slice(0, 20);

  return (
    <>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <Link
          href="/agents"
          className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All agents
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-[13px] font-bold uppercase text-brand-300">
              {agent.key.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[19px] font-semibold tracking-tight text-ink-strong">{agent.name}</h1>
                <AgentStateBadge state={agent.state} />
                <Badge tone={agent.permissionLevel === "RED" ? "danger" : agent.permissionLevel === "YELLOW" ? "warning" : "success"}>
                  {agent.permissionLevel}
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">{agent.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.purpose && <Badge tone="neutral">{agent.purpose.replace(/_/g, " ").toLowerCase()}</Badge>}
                {String(agent.config.schedule ?? "") && <Badge tone="info">{String(agent.config.schedule)}</Badge>}
                <Badge tone="neutral">runs today {num(agent.runsToday)}</Badge>
                {agent.lastRunAt && <Badge tone="neutral">last run {relative(agent.lastRunAt)}</Badge>}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <AgentControlButton agentKey={agent.key} paused={agent.paused} />
          </div>
        </div>
      </div>

      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total runs", num(myRuns.length)],
            ["Success rate", successRate === null ? "—" : percent(successRate * 100)],
            ["Average duration", avgMs ? duration(avgMs) : "—"],
            ["Tasks queued", num(myTasks.filter((t) => t.status === "QUEUED").length)],
          ].map(([k, v]) => (
            <div key={k} className="panel p-3.5">
              <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">{k}</p>
              <p className="tnum mt-1.5 text-[19px] font-semibold leading-none text-ink-strong">{v}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Recent runs"
              subtitle={`${myRuns.length} recorded`}
              action={
                <Link href="/activity" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Activity →
                </Link>
              }
            />
            <CardBody>
              {myRuns.length === 0 ? (
                <EmptyState icon={<Clock className="h-4 w-4" />} title="No runs recorded yet" />
              ) : (
                <ul className="space-y-1">
                  {myRuns.slice(0, 14).map((run) => (
                    <li key={run.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.025]">
                      <Badge tone={run.status === "FAILED" ? "danger" : run.status === "COMPLETED" ? "success" : "warning"}>
                        {run.status.toLowerCase()}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] text-ink">{run.trigger}</p>
                        <p className="truncate text-[10.5px] text-ink-faint">
                          {run.error ?? (Object.keys(run.output).length > 0 ? JSON.stringify(run.output).slice(0, 120) : "completed without detail")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10.5px] text-ink-faint">{relative(run.startedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Task queue" subtitle={`${myTasks.length} tasks`} />
            <CardBody className="space-y-1.5">
              {myTasks.length === 0 ? (
                <EmptyState icon={<ListTree className="h-4 w-4" />} title="No tasks" description="Nothing queued for this agent." />
              ) : (
                myTasks.slice(0, 12).map((task) => (
                  <div key={task.id} className="rounded-lg border border-line/60 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-medium text-ink">{task.type}</p>
                      <Badge tone={task.status === "FAILED" ? "danger" : task.status === "COMPLETED" ? "success" : "brand"}>
                        {task.status.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">
                      {task.entityType} · {task.entityId.slice(0, 10)}
                    </p>
                    {task.error && <p className="mt-1 text-[10.5px] leading-relaxed text-red-300">{task.error}</p>}
                    <Progress value={task.progress} className="mt-1.5" />
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Agent log" subtitle="Most recent structured log lines" />
          <CardBody>
            {myLogs.length === 0 ? (
              <EmptyState icon={<Bot className="h-4 w-4" />} title="No log lines yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-line">
                      {["Time", "Level", "Message", "Detail"].map((h) => (
                        <th key={h} className="px-2 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myLogs.map((log) => (
                      <tr key={log.id} className="border-b border-line/40 last:border-0">
                        <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-ink-faint">{dateTime(log.createdAt)}</td>
                        <td className="px-2 py-1.5">
                          <Badge tone={log.level === "ERROR" ? "danger" : log.level === "WARN" ? "warning" : "neutral"}>
                            {log.level.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-ink">{log.message}</td>
                        <td className="max-w-[260px] truncate px-2 py-1.5 text-ink-faint">
                          {Object.keys(log.meta).length > 0 ? JSON.stringify(log.meta).slice(0, 120) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Fleet" subtitle="Jump to another agent" />
          <CardBody className="flex flex-wrap gap-1.5">
            {upstream.map((a) => (
              <Link key={a.id} href={`/agents/${a.key}`}>
                <Badge tone="neutral" className="hover:border-brand-500/40">
                  {a.name}
                </Badge>
              </Link>
            ))}
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
