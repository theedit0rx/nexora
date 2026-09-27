import Link from "next/link";
import { BarChart3, Download, TrendingUp } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { computeAnalytics } from "@/lib/metrics";
import { db } from "@/lib/db";
import { PageHeader, PageBody, SectionTitle } from "@/components/shared/page-header";
import {
  BarsChart,
  DonutChart,
  HorizontalBars,
  LinesChart,
  RevenueChart,
  StackedBarsChart,
} from "@/components/charts";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { compactMoney, money, num, percent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;
  const a = await computeAnalytics(orgId);
  const agents = await db.find("agent_definitions", { organizationId: orgId });

  if (!a.hasData) {
    return (
      <>
        <PageHeader
          eyebrow="Insight"
          title="Analytics"
          description="Conversion, outreach, revenue and delivery performance computed from real activity."
        />
        <PageBody>
          <Card>
            <EmptyState
              icon={<BarChart3 className="h-4 w-4" />}
              title="Not enough data yet"
              description="Analytics appear once NEXORA has discovered leads, sent outreach and accepted proposals. Run Scout discovery to begin."
              action={
                <Link href="/leads?new=1">
                  <Button size="sm">Add your first lead</Button>
                </Link>
              }
            />
          </Card>
        </PageBody>
      </>
    );
  }

  const sourceData = a.leadSources.map((s) => ({
    label: s.source.replace(/_/g, " ").toLowerCase(),
    leads: s.leads,
    qualified: s.qualified,
    won: s.won,
    revenue: s.revenue,
  }));

  const industryData = a.industries.map((i) => ({
    label: i.industry,
    value: i.leads,
    note: i.avgScore === null ? "not scored" : `avg score ${Math.round(i.avgScore)} · ${i.won} won`,
  }));

  const channelData = a.outreachResults.byChannel.map((c) => ({
    label: c.channel.toLowerCase(),
    sent: c.sent,
    replied: c.replied,
  }));

  const funnelData = a.conversionFunnel.map((f) => ({
    label: f.stage,
    count: f.count,
    rate: f.rate === null ? 0 : Math.round(f.rate * 1000) / 10,
  }));

  const agentData = a.agentPerformance.map((p) => ({
    label: p.agent,
    runs: p.runs,
    success: Math.round(p.successRate * 100),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Insight"
        title="Analytics"
        description="Conversion, outreach, revenue and delivery performance — every figure computed from real rows in this workspace."
        actions={
          <Button variant="outline" size="sm" asChild={<Link href="/activity" />}>
            <Download className="h-3.5 w-3.5" />
            Export activity
          </Button>
        }
      />
      <PageBody>
        {/* ------------------------------------------------- headline KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Lead → won conversion"
            value={a.conversionFunnel[0]?.rate === null || a.conversionFunnel[0]?.rate === undefined ? "—" : percent(a.conversionFunnel[0].rate * 100)}
            hint={`${num(a.funnel[a.funnel.length - 1]?.count ?? 0)} won of ${num(a.funnel[0]?.count ?? 0)} found`}
          />
          <Kpi
            label="Reply rate"
            value={a.outreachResults.replyRate === null ? "—" : percent(a.outreachResults.replyRate * 100)}
            hint={`${num(a.outreachResults.replied)} replies of ${num(a.outreachResults.sent)} sent`}
          />
          <Kpi
            label="Proposal acceptance"
            value={a.proposalAcceptance.rate === null ? "—" : percent(a.proposalAcceptance.rate * 100)}
            hint={
              a.proposalAcceptance.avgValue === null
                ? `${num(a.proposalAcceptance.total)} proposals`
                : `avg ${compactMoney(a.proposalAcceptance.avgValue)}`
            }
          />
          <Kpi
            label="Average client value"
            value={a.clientLifetimeValue.avg === null ? "—" : compactMoney(a.clientLifetimeValue.avg)}
            hint={`${num(a.clientLifetimeValue.clients)} clients`}
          />
        </div>

        {/* -------------------------------------------------------- funnel */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Conversion funnel" subtitle="Stage-to-stage conversion rates" />
            <CardBody>
              <LinesChart
                height={240}
                data={funnelData}
                lines={[
                  { key: "count", color: "#6366f1", label: "Leads" },
                  { key: "rate", color: "#22d3ee", label: "Stage conversion %" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Stage counts" subtitle="Absolute numbers at each stage" />
            <CardBody>
              <HorizontalBars data={a.funnel.map((f) => ({ label: f.stage, value: f.count }))} />
            </CardBody>
          </Card>
        </div>

        {/* ------------------------------------------------------ revenue */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Revenue by month"
              subtitle={`${compactMoney(a.monthlyRevenue.reduce((s, m) => s + m.revenue, 0))} collected overall`}
            />
            <CardBody>
              {a.monthlyRevenue.length === 0 ? (
                <EmptyState icon={<TrendingUp className="h-4 w-4" />} title="No revenue recorded yet" />
              ) : (
                <RevenueChart data={a.monthlyRevenue} />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Revenue by project" subtitle={`${num(a.projectRevenue.length)} projects`} />
            <CardBody>
              {a.projectRevenue.length === 0 ? (
                <EmptyState icon={<BarChart3 className="h-4 w-4" />} title="No projects billed" />
              ) : (
                <HorizontalBars
                  color="#10b981"
                  data={a.projectRevenue.map((p) => ({ label: p.project, value: p.value, note: p.stage }))}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ------------------------------------------------------ sources */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Lead sources" subtitle="Discovery volume, qualification and wins" />
            <CardBody>
              {sourceData.length === 0 ? (
                <EmptyState icon={<BarChart3 className="h-4 w-4" />} title="No leads discovered" />
              ) : (
                <StackedBarsChart
                  height={240}
                  data={sourceData}
                  keys={[
                    { key: "leads", color: "#6366f1", label: "Leads" },
                    { key: "qualified", color: "#22d3ee", label: "Qualified" },
                    { key: "won", color: "#10b981", label: "Won" },
                  ]}
                />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Industries" subtitle="Where the volume is coming from" />
            <CardBody>
              {industryData.length === 0 ? (
                <EmptyState icon={<BarChart3 className="h-4 w-4" />} title="No industry data" />
              ) : (
                <HorizontalBars data={industryData} />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ----------------------------------------------------- outreach */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader title="Outreach results" subtitle="Delivery and engagement" />
            <CardBody>
              <dl className="space-y-0">
                {[
                  ["Sent", num(a.outreachResults.sent)],
                  ["Delivered", num(a.outreachResults.delivered)],
                  ["Opened", num(a.outreachResults.opened)],
                  ["Replied", num(a.outreachResults.replied)],
                  ["Failed", num(a.outreachResults.failed)],
                  [
                    "Open rate",
                    a.outreachResults.openRate === null ? "—" : percent(a.outreachResults.openRate * 100),
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 border-b border-line/40 py-2 last:border-0">
                    <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{k}</dt>
                    <dd className="tnum text-[13px] font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="By channel" subtitle="Sends versus replies" />
            <CardBody>
              {channelData.length === 0 ? (
                <EmptyState icon={<BarChart3 className="h-4 w-4" />} title="No outreach yet" />
              ) : (
                <BarsChart height={200} data={channelData} dataKey="sent" color="#6366f1" format="count" />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Proposal outcomes" subtitle="Decisions taken" />
            <CardBody>
              <DonutChart
                height={200}
                data={[
                  { label: "Accepted", value: a.proposalAcceptance.accepted, color: "#10b981" },
                  { label: "Rejected", value: a.proposalAcceptance.rejected, color: "#ef4444" },
                  { label: "Pending", value: a.proposalAcceptance.pending, color: "#f59e0b" },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        {/* ------------------------------------------------------- agents */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Agent performance" subtitle="Runs and success rate per agent" />
            <CardBody>
              {agentData.length === 0 ? (
                <EmptyState icon={<BarChart3 className="h-4 w-4" />} title="No agent runs yet" />
              ) : (
                <StackedBarsChart
                  height={240}
                  data={agentData}
                  keys={[
                    { key: "runs", color: "#6366f1", label: "Runs" },
                    { key: "success", color: "#10b981", label: "Success %" },
                  ]}
                />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Website production time" subtitle="Onboarding to live" />
            <CardBody>
              <dl className="space-y-0">
                <div className="flex items-center justify-between gap-3 border-b border-line/40 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-ink-faint">Average</dt>
                  <dd className="tnum text-[13px] font-semibold text-ink">
                    {a.websiteProductionTime.avgDays === null ? "—" : `${a.websiteProductionTime.avgDays.toFixed(1)} days`}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-line/40 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-ink-faint">Samples</dt>
                  <dd className="tnum text-[13px] font-semibold text-ink">{num(a.websiteProductionTime.samples)}</dd>
                </div>
              </dl>
              {a.websiteProductionTime.byProject.length > 0 && (
                <div className="mt-3">
                  <SectionTitle title="Per project" />
                  <div className="mt-2">
                    <HorizontalBars
                      color="#22d3ee"
                      data={a.websiteProductionTime.byProject.map((p) => ({
                        label: p.project,
                        value: Math.round(p.days),
                        note: "days",
                      }))}
                    />
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---------------------------------------------------------- LTV */}
        <Card>
          <CardHeader
            title="Client lifetime value"
            subtitle={`${compactMoney(a.clientLifetimeValue.total)} across ${num(a.clientLifetimeValue.clients)} clients`}
            action={
              <Link href="/clients" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                Clients →
              </Link>
            }
          />
          <CardBody>
            {a.clientLifetimeValue.topClients.length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-4 w-4" />} title="No clients yet" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {a.clientLifetimeValue.topClients.map((c) => (
                  <div key={c.name} className="rounded-lg border border-line/60 p-3">
                    <p className="truncate text-[12.5px] font-medium text-ink">{c.name}</p>
                    <p className="tnum mt-1 text-[16px] font-semibold text-emerald-300">{money(c.ltv)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center gap-2 px-1">
          <Badge tone="neutral">{num(agents.length)} agents contributing</Badge>
          <span className="text-[11px] text-ink-faint">
            Every metric is derived from stored rows — nothing on this page is a mock figure.
          </span>
        </div>
      </PageBody>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="panel p-3.5">
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="tnum mt-2 text-[21px] font-semibold leading-none text-ink-strong">{value}</p>
      {hint && <p className="mt-2 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}

