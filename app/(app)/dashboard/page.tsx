import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Globe2,
  Inbox,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { computeDashboard } from "@/lib/metrics";
import { PageHeader, PageBody, Grid, SectionTitle } from "@/components/shared/page-header";
import {
  AgentStateBadge,
  DataRow,
  InfoChip,
  LeadStatusBadge,
  PriorityBadge,
  ScoreRing,
  VerdictBadge,
} from "@/components/dashboard/lead-detail-drawer";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Progress, Skeleton } from "@/components/ui";
import { compactMoney, money, num, percent, relative } from "@/lib/utils";
import { FunnelChart, MiniAreaChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;
  const m = await computeDashboard(orgId);

  const [leads, businesses, proposals, agents, tasks] = await Promise.all([
    db.find("leads", { organizationId: orgId }),
    db.find("businesses", { organizationId: orgId }),
    db.find("proposals", { organizationId: orgId }),
    db.find("agent_definitions", { organizationId: orgId }),
    db.find("agent_tasks", { organizationId: orgId }),
  ]);
  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const activeTasks = tasks
    .filter((t) => t.status === "RUNNING" || t.status === "QUEUED" || t.status === "RETRYING")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const revenueDelta =
    m.revenue.lastMonth > 0
      ? {
          value: percent(Math.abs(((m.revenue.thisMonth - m.revenue.lastMonth) / m.revenue.lastMonth) * 100), 0),
          positive: m.revenue.thisMonth >= m.revenue.lastMonth,
        }
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Command centre"
        title={`Good to see you, ${ctx.user.fullName.split(" ")[0]}`}
        description="Everything NEXORA is doing across discovery, research, audits, demos, outreach, sales and delivery — in one place."
        actions={
          <>
            <Button variant="outline" size="sm" asChild={<Link href="/activity" />}>
              <Activity className="h-3.5 w-3.5" />
              Activity feed
            </Button>
            <Button variant="primary" size="sm" asChild={<Link href="/leads?new=1" />}>
              <Users className="h-3.5 w-3.5" />
              Add lead
            </Button>
          </>
        }
      />

      <PageBody>
        {/* ------------------------------------------------------- KPIs */}
        <Grid className="grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Kpi
            label="Revenue collected"
            value={compactMoney(m.revenue.total)}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            hint={`${compactMoney(m.revenue.mrr)} MRR`}
            delta={revenueDelta}
          />
          <Kpi
            label="Pipeline value"
            value={compactMoney(m.pipelineValue)}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            hint={`${m.qualifiedLeads} qualified`}
          />
          <Kpi label="Leads discovered" value={num(m.leadsDiscovered)} icon={<Target className="h-3.5 w-3.5" />} />
          <Kpi label="Demos generated" value={num(m.demosGenerated)} icon={<Globe2 className="h-3.5 w-3.5" />} />
          <Kpi
            label="Reply rate"
            value={m.replyRate === null ? "—" : percent(m.replyRate * 100)}
            icon={<Inbox className="h-3.5 w-3.5" />}
            hint={`${m.outreachSent} sent`}
          />
          <Kpi
            label="Pending approvals"
            value={num(m.pendingApprovals.length)}
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            tone={m.pendingApprovals.length > 0 ? "warning" : "neutral"}
            href="/approvals"
          />
        </Grid>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* ------------------------------------------------ funnel */}
          <Card className="xl:col-span-2">
            <CardHeader
              title="Autonomous funnel"
              subtitle="Businesses found through to delivered"
              action={
                <Link href="/analytics" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Full analytics →
                </Link>
              }
            />
            <CardBody>
              <FunnelChart data={m.funnel} />
            </CardBody>
          </Card>

          {/* ------------------------------------------------ approvals */}
          <Card>
            <CardHeader
              title="Approval centre"
              subtitle="Gated actions waiting on you"
              action={
                <Link href="/approvals" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Open →
                </Link>
              }
            />
            <CardBody className="space-y-2">
              {m.pendingApprovals.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="Nothing waiting"
                  description="NEXORA is not blocked on any approval right now."
                />
              ) : (
                m.pendingApprovals.slice(0, 5).map((a) => (
                  <Link
                    key={a.id}
                    href="/approvals"
                    className="block rounded-lg border border-line bg-surface-2/40 p-2.5 transition-colors hover:border-brand-500/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12.5px] font-medium leading-snug text-ink">{a.title}</p>
                      <Badge tone={a.riskLevel === "CRITICAL" || a.riskLevel === "HIGH" ? "danger" : "warning"}>
                        {a.permissionLevel}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-faint">{a.reason}</p>
                    <p className="mt-1.5 text-[10.5px] text-ink-faint">
                      {a.requestingAgent} · {relative(a.createdAt)}
                    </p>
                  </Link>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* ------------------------------------------------ agent activity */}
          <Card className="xl:col-span-2">
            <CardHeader
              title="Agent activity"
              subtitle="Live mission-control feed from the autonomous pipeline"
              action={
                <Link href="/activity" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  View all →
                </Link>
              }
            />
            <CardBody>
              {m.recentActivity.length === 0 ? (
                <EmptyState
                  icon={<Bot className="h-4 w-4" />}
                  title="No agent activity yet"
                  description="Run discovery or the pipeline on a lead and the agents will start reporting here."
                />
              ) : (
                <ul className="space-y-0.5">
                  {m.recentActivity.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.025]">
                      <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-[10px] font-bold uppercase text-brand-300">
                        {(event.agentKey ?? "sys").slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] leading-snug text-ink">{event.title}</p>
                        {event.detail && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-ink-faint">{event.detail}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10.5px] text-ink-faint">{relative(event.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ agent status */}
          <Card>
            <CardHeader
              title="Agent fleet"
              subtitle={`${agents.filter((a) => a.state === "WORKING").length} working · ${agents.filter((a) => a.paused).length} paused`}
              action={
                <Link href="/agents" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Manage →
                </Link>
              }
            />
            <CardBody className="space-y-1.5">
              {agents.slice(0, 8).map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.key}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{agent.name}</span>
                    <span className="block truncate text-[10.5px] text-ink-faint">
                      {agent.currentTaskLabel ?? `${agent.runsToday} runs today`}
                    </span>
                  </span>
                  <AgentStateBadge state={agent.state} />
                </Link>
              ))}
              {agents.length === 0 && (
                <EmptyState icon={<Bot className="h-4 w-4" />} title="No agents registered" />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* ------------------------------------------------ hot leads */}
          <Card className="xl:col-span-2">
            <CardHeader
              title="Hottest opportunities"
              subtitle="Ranked by the weighted opportunity score"
              action={
                <Link href="/leads" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Open CRM →
                </Link>
              }
            />
            <CardBody>
              {m.hotLeads.length === 0 ? (
                <EmptyState
                  icon={<Target className="h-4 w-4" />}
                  title="No scored leads yet"
                  description="Score a lead to see the strongest opportunities here."
                />
              ) : (
                <div className="space-y-1.5">
                  {m.hotLeads.map((lead) => {
                    const biz = bizById.get(lead.businessId);
                    if (!biz) return null;
                    return (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-3 rounded-lg border border-line/60 px-3 py-2.5 transition-colors hover:border-brand-500/40 hover:bg-white/[0.02]"
                      >
                        <ScoreRing score={lead.score} priority={lead.priority} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{biz.name}</p>
                          <p className="truncate text-[11px] text-ink-faint">
                            {biz.category} · {biz.city || "—"}
                          </p>
                        </div>
                        <div className="hidden shrink-0 items-center gap-2 sm:flex">
                          <PriorityBadge priority={lead.priority} />
                          <LeadStatusBadge status={lead.status} />
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ pipeline tasks */}
          <Card>
            <CardHeader title="Task engine" subtitle="Currently queued or running" />
            <CardBody className="space-y-1.5">
              {activeTasks.length === 0 ? (
                <EmptyState
                  icon={<Clock className="h-4 w-4" />}
                  title="No active tasks"
                  description="Agent work appears here while it runs."
                />
              ) : (
                activeTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-line/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-medium text-ink">{task.agentKey}</p>
                      <Badge tone={task.status === "FAILED" ? "danger" : "brand"}>{task.status.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-ink-faint">{task.type}</p>
                    <Progress value={task.progress} className="mt-2" />
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* ------------------------------------------------ proposals */}
          <Card>
            <CardHeader
              title="Proposals"
              subtitle={`${m.proposals.total} total · ${m.proposals.accepted} accepted`}
              action={
                <Link href="/proposals" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Open →
                </Link>
              }
            />
            <CardBody className="space-y-1.5">
              {proposals.length === 0 ? (
                <EmptyState icon={<FileText className="h-4 w-4" />} title="No proposals yet" />
              ) : (
                proposals
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] text-ink">{p.number}</p>
                        <p className="truncate text-[11px] text-ink-faint">{p.title}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tnum text-[12px] font-semibold text-ink">{compactMoney(p.total)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-ink-faint">{p.status}</p>
                      </div>
                    </div>
                  ))
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ delivery */}
          <Card>
            <CardHeader title="Delivery" subtitle="Deployments and support load" />
            <CardBody className="space-y-2.5">
              <DataRow label="Active projects">
                <span className="tnum">{m.activeProjects}</span>
              </DataRow>
              <DataRow label="Deployments ready">
                <span className="tnum">
                  {m.deployments.ready}/{m.deployments.total}
                </span>
              </DataRow>
              <DataRow label="Deployment errors">
                <span className={m.deployments.error > 0 ? "tnum text-red-300" : "tnum"}>{m.deployments.error}</span>
              </DataRow>
              <DataRow label="Open tickets">
                <span className="tnum">{m.supportTickets.open}</span>
              </DataRow>
              <DataRow label="Clients">
                <span className="tnum">
                  {m.clients.active} active · {m.clients.onboarding} onboarding
                </span>
              </DataRow>
              <div className="flex gap-2 pt-1">
                <Link href="/projects" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Rocket className="h-3.5 w-3.5" />
                    Projects
                  </Button>
                </Link>
                <Link href="/support" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Inbox className="h-3.5 w-3.5" />
                    Support
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* ------------------------------------------------ revenue */}
          <Card>
            <CardHeader
              title="Revenue"
              subtitle="Collected, invoiced and recurring"
              action={
                <Link href="/analytics" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Analytics →
                </Link>
              }
            />
            <CardBody className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">Collected</p>
                  <p className="tnum text-[20px] font-semibold text-ink-strong">{money(m.revenue.total)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10.5px] uppercase tracking-wider text-ink-faint">This month</p>
                  <p className="tnum text-[15px] font-semibold text-emerald-300">{compactMoney(m.revenue.thisMonth)}</p>
                </div>
              </div>
              <MiniAreaChart
                data={[
                  { label: "Last month", value: m.revenue.lastMonth },
                  { label: "This month", value: m.revenue.thisMonth },
                ]}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line/60 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-ink-faint">Awaiting payment</p>
                  <p className="tnum mt-1 text-[13px] font-semibold text-amber-300">{compactMoney(m.revenue.pending)}</p>
                </div>
                <div className="rounded-lg border border-line/60 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-ink-faint">Proposal value</p>
                  <p className="tnum mt-1 text-[13px] font-semibold text-brand-300">{compactMoney(m.proposals.value)}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {leads.length === 0 && (
          <Card>
            <EmptyState
              icon={<Sparkles className="h-4 w-4" />}
              title="Your workspace is empty"
              description="Explore Demo Mode to see the full autonomous workflow, or connect a lead source and run Scout discovery."
              action={
                <div className="flex gap-2">
                  <Link href="/settings?section=lead-sources">
                    <Button variant="primary" size="sm">
                      Connect lead sources
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" asChild={<Link href="/leads?new=1" />}>
                    Explore Demo Mode
                  </Button>
                </div>
              }
            />
          </Card>
        )}
      </PageBody>
    </>
  );
}

function Kpi({
  label,
  value,
  icon,
  hint,
  delta,
  tone = "neutral",
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  delta?: { value: string; positive: boolean } | null;
  tone?: "neutral" | "warning" | "success" | "danger";
  href?: string;
}) {
  const content = (
    <div className="panel group relative overflow-hidden p-3.5 transition-colors hover:border-brand-500/30">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
        {icon && (
          <span
            className={
              tone === "warning"
                ? "text-amber-300"
                : tone === "success"
                  ? "text-emerald-300"
                  : tone === "danger"
                    ? "text-red-300"
                    : "text-ink-faint group-hover:text-brand-300"
            }
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-[21px] font-semibold leading-none tracking-tight text-ink-strong tnum">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {delta && (
          <span className={`tnum text-[11px] font-semibold ${delta.positive ? "text-emerald-400" : "text-red-400"}`}>
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

