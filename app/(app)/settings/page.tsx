import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { defaultSettings } from "@/lib/bootstrap";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { Badge, Card, CardBody } from "@/components/ui";
import { dateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireAuth();
  const orgId = ctx.session.organizationId;

  const settings = (await db.findOne("settings", { organizationId: orgId })) ?? (await defaultSettings(orgId));
  const integrations = await db.find("integrations", { organizationId: orgId });
  const auditLogs = await db.find("audit_logs", { organizationId: orgId });

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Automation boundaries, permission levels, lead sources, AI provider and notification routing for this workspace."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Updated {dateTime(settings.updatedAt)}</Badge>
          <Badge tone={settings.autonomy.paused ? "warning" : "success"}>
            autonomy {settings.autonomy.paused ? "paused" : "live"}
          </Badge>
          <Badge tone="neutral">{integrations.filter((i) => i.status === "CONNECTED").length} integrations connected</Badge>
        </div>

        <SettingsForm
          settings={settings as never}
          integrations={integrations.map((i) => ({
            id: i.id,
            name: i.name,
            status: i.status,
            category: i.category,
            description: (i as unknown as { description?: string }).description ?? "",
          }))}
        />

        {auditLogs.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="text-[13px] font-semibold text-ink-strong">Recent settings changes</h2>
              <ul className="mt-2.5 space-y-1.5">
                {auditLogs
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 10)
                  .map((log) => (
                    <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/40 pb-1.5 last:border-0">
                      <span className="text-[12px] text-ink">
                        {log.actorLabel} · {log.action}
                      </span>
                      <span className="text-[10.5px] text-ink-faint">{dateTime(log.createdAt)}</span>
                    </li>
                  ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </PageBody>
    </>
  );
}
