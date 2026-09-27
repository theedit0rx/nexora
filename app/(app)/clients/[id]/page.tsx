import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Clock, Mail, Phone, Rocket } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageBody } from "@/components/shared/page-header";
import { Badge, Button, Card, CardBody, CardHeader, Progress } from "@/components/ui";
import { ClientOnboarding } from "@/components/clients/onboarding";
import { DataRow } from "@/components/dashboard/lead-detail-drawer";
import { compactMoney, dateTime, money, num, percent, relative } from "@/lib/utils";
import { ONBOARDING_FIELD_LIST } from "@/lib/onboarding-fields";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const client = await db.byId("clients", id);
  if (!client || client.organizationId !== orgId) notFound();

  const [lead, business, onboarding, projects, tickets, proposals, revenue, conversations] = await Promise.all([
    client.leadId ? db.byId("leads", client.leadId) : Promise.resolve(null),
    client.businessId ? db.byId("businesses", client.businessId) : Promise.resolve(null),
    db.findOne("onboarding_submissions", { clientId: client.id }),
    db.find("projects", { organizationId: orgId, clientId: client.id }),
    db.find("support_tickets", { organizationId: orgId, clientId: client.id }),
    db.find("proposals", { organizationId: orgId, clientId: client.id }),
    db.find("revenue_events", { organizationId: orgId, clientId: client.id }),
    db.find("conversations", { organizationId: orgId, clientId: client.id }),
  ]);

  const paid = revenue.filter((r) => r.status === "PAID").reduce((a, r) => a + r.amount, 0);
  const outstanding = revenue.filter((r) => r.status === "INVOICED" || r.status === "PENDING").reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <Link
          href="/clients"
          className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All clients
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-[13px] font-bold uppercase text-brand-300">
              {client.name.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[19px] font-semibold tracking-tight text-ink-strong">{client.name}</h1>
                <Badge tone={client.status === "ACTIVE" ? "success" : client.status === "ONBOARDING" ? "warning" : "neutral"}>
                  {client.status.toLowerCase()}
                </Badge>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Client since {dateTime(client.createdAt)}
                {business?.category ? ` · ${business.category}` : ""}
                {business?.city ? ` · ${business.city}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {client.primaryEmail && (
                  <a href={`mailto:${client.primaryEmail}`}>
                    <Badge tone="neutral">
                      <Mail className="h-2.5 w-2.5" />
                      {client.primaryEmail}
                    </Badge>
                  </a>
                )}
                {client.primaryPhone && (
                  <a href={`tel:${client.primaryPhone}`}>
                    <Badge tone="neutral">
                      <Phone className="h-2.5 w-2.5" />
                      {client.primaryPhone}
                    </Badge>
                  </a>
                )}
                {lead && (
                  <Link href={`/leads/${lead.id}`}>
                    <Badge tone="brand">from lead</Badge>
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2">
            {[
              ["Collected", money(paid), "text-emerald-300"],
              ["Outstanding", compactMoney(outstanding), "text-amber-300"],
              ["Contract", compactMoney(client.contractValue), "text-brand-300"],
            ].map(([label, value, tone]) => (
              <div key={label} className="panel px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
                <p className={`tnum mt-1 text-[14px] font-semibold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PageBody>
        <div className="grid gap-4 xl:grid-cols-3">
          {/* ------------------------------------------------ onboarding */}
          <Card className="xl:col-span-2">
            <CardHeader
              title="Onboarding checklist"
              subtitle={
                onboarding
                  ? `${percent(onboarding.completion)} complete · ${num(onboarding.missing.length)} fields outstanding`
                  : "No onboarding submission"
              }
              action={
                onboarding && (
                  <span className="tnum text-[11px] text-ink-faint">
                    {onboarding.status === "COMPLETE" ? "submitted" : "in progress"}
                  </span>
                )
              }
            />
            <CardBody>
              {!onboarding ? (
                <p className="text-[12.5px] text-ink-muted">
                  This client has no onboarding submission. Accepting a proposal creates one automatically.
                </p>
              ) : (
                <>
                  <Progress value={onboarding.completion} tone={onboarding.completion >= 100 ? "success" : "warning"} className="mb-3" />
                  <ClientOnboarding
                    clientId={client.id}
                    submissionId={onboarding.id}
                    initialData={(onboarding.data ?? {}) as Record<string, unknown>}
                    missing={onboarding.missing}
                    locked={onboarding.status === "COMPLETE"}
                  />
                  <details className="mt-4">
                    <summary className="cursor-pointer text-[11.5px] text-ink-muted hover:text-ink">
                      All {num(ONBOARDING_FIELD_LIST.length)} onboarding fields
                    </summary>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {ONBOARDING_FIELD_LIST.map((f) => {
                        const value = (onboarding.data as Record<string, unknown>)[f.key];
                        const done =
                          value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);
                        return (
                          <li key={f.key} className="flex items-start gap-1.5 text-[11.5px]">
                            {done ? (
                              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                            ) : (
                              <Circle className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
                            )}
                            <span className={done ? "text-ink-muted" : "text-ink"}>{f.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </>
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ projects */}
          <Card>
            <CardHeader
              title="Projects"
              subtitle={`${num(projects.length)} in delivery`}
              action={
                <Link href="/projects" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                  Open →
                </Link>
              }
            />
            <CardBody className="space-y-2">
              {projects.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No projects yet.</p>
              ) : (
                projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="block rounded-lg border border-line/60 px-2.5 py-2 transition-colors hover:border-brand-500/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-medium text-ink">{p.name}</p>
                      <Badge tone="neutral">{p.stage}</Badge>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-ink-faint">
                      {p.progress}% · {p.dueDate ? `due ${relative(p.dueDate)}` : "no due date"}
                    </p>
                    <Progress value={p.progress} className="mt-1.5" />
                  </Link>
                ))
              )}
              <Button variant="outline" size="sm" className="w-full" asChild={<Link href="/projects" />}>
                <Rocket className="h-3.5 w-3.5" />
                Delivery board
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* ------------------------------------------------ proposals */}
          <Card>
            <CardHeader title="Proposals" subtitle={`${num(proposals.length)} total`} />
            <CardBody className="space-y-1.5">
              {proposals.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No proposals.</p>
              ) : (
                proposals.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-ink">{p.number}</p>
                      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{p.status}</p>
                    </div>
                    <span className="tnum shrink-0 text-[12px] font-semibold text-ink">{compactMoney(p.total, p.currency)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ revenue */}
          <Card>
            <CardHeader title="Revenue events" subtitle={`${num(revenue.length)} recorded`} />
            <CardBody className="space-y-1.5">
              {revenue.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No revenue events.</p>
              ) : (
                revenue.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-ink">{r.kind.replace(/_/g, " ").toLowerCase()}</p>
                      <p className="truncate text-[10px] text-ink-faint">{r.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-[12px] font-semibold text-ink">{compactMoney(r.amount, r.currency)}</p>
                      <p
                        className={
                          r.status === "PAID"
                            ? "text-[10px] uppercase text-emerald-400"
                            : "text-[10px] uppercase text-amber-400"
                        }
                      >
                        {r.status.toLowerCase()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ support + profile */}
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Support"
                subtitle={`${num(tickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length)} open`}
                action={
                  <Link href="/support" className="text-[11px] font-medium text-brand-300 hover:text-brand-200">
                    Open →
                  </Link>
                }
              />
              <CardBody className="space-y-1.5">
                {tickets.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted">No tickets raised.</p>
                ) : (
                  tickets.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-ink">{t.subject}</p>
                        <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                          {t.category.replace(/_/g, " ").toLowerCase()}
                        </p>
                      </div>
                      <Badge tone={t.status === "RESOLVED" ? "success" : t.priority === "URGENT" ? "danger" : "warning"}>
                        {t.status.toLowerCase()}
                      </Badge>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Account" />
              <CardBody>
                <DataRow label="Slug">{client.slug}</DataRow>
                <DataRow label="Recurring">{compactMoney(client.monthlyRecurring)} / month</DataRow>
                <DataRow label="Lifetime value">{money(client.lifetimeValue)}</DataRow>
                <DataRow label="Conversations">
                  <Link href="/conversations" className="text-brand-300 hover:text-brand-200">
                    {num(conversations.length)}
                  </Link>
                </DataRow>
                <DataRow label="Onboarding">{percent(client.onboardingProgress)}</DataRow>
              </CardBody>
            </Card>
          </div>
        </div>

        <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-faint">
          <Clock className="h-3 w-3" />
          Last updated {relative(client.updatedAt)}
        </p>
      </PageBody>
    </>
  );
}
