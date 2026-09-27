import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { computeSystemHealth } from "@/lib/metrics";
import { bootstrapPrimary } from "@/lib/bootstrap";
import { registerSupervisor } from "@/lib/workflows/pipeline";
import { NAV_ITEMS } from "@/components/shell/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch {
    redirect("/login");
  }

  const { session, user, organization } = ctx;
  const organizationId = session.organizationId;

  // First-run bootstrap for the primary workspace.
  if (!session.isDemo) {
    await bootstrapPrimary().catch((err) => console.error("[nexora] bootstrap failed", err));
  }

  // Wire the supervisor to workflow events (idempotent per process).
  const g = globalThis as unknown as { __nexoraSupervisor?: Set<string> };
  g.__nexoraSupervisor ??= new Set<string>();
  if (!g.__nexoraSupervisor.has(organizationId)) {
    g.__nexoraSupervisor.add(organizationId);
    registerSupervisor(organizationId);
  }

  const [
    approvals,
    conversations,
    projects,
    tickets,
    notifications,
    health,
    settings,
  ] = await Promise.all([
    db.find("approval_requests", { organizationId }),
    db.find("conversations", { organizationId }),
    db.find("projects", { organizationId }),
    db.find("support_tickets", { organizationId }),
    db.find("notifications", { organizationId }),
    computeSystemHealth(organizationId),
    db.findOne("settings", { organizationId }),
  ]);

  const unreadNotifications = notifications
    .filter((n) => !n.read)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const healthItems = [
    ...health.integrations.map((i) => ({ key: i.key, name: i.name, status: i.status, detail: i.detail })),
    {
      key: "automation",
      name: "Automation Engine",
      status: settings?.autonomy.paused ? ("WARNING" as const) : ("CONNECTED" as const),
      detail: settings?.autonomy.paused
        ? "Paused by owner — no new automated actions"
        : "Running enabled automation rules",
    },
    {
      key: "jobs",
      name: "Background Jobs",
      status: health.tasks.failed > 0 ? ("WARNING" as const) : ("CONNECTED" as const),
      detail: `${health.tasks.running} active · ${health.tasks.failed} failed`,
    },
  ];

  return (
    <AppShell
      userName={user.fullName}
      userEmail={user.email}
      userRole={user.role}
      isDemo={session.isDemo || organization.mode === "DEMO"}
      organizationId={organizationId}
      autonomyPaused={settings?.autonomy.paused ?? false}
      counts={{
        approvals: approvals.filter((a) => a.status === "PENDING").length,
        conversations: conversations.filter((c) => c.state === "OPEN").length,
        projects: projects.filter((p) => p.stage !== "Completed").length,
        support: tickets.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED").length,
        notifications: unreadNotifications.length,
      }}
      health={healthItems}
      initialNotifications={unreadNotifications.slice(0, 12).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        severity: n.severity,
        href: n.href,
        createdAt: new Date(n.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        read: n.read,
      }))}
    >
      {children}
    </AppShell>
  );
}

