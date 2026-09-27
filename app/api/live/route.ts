import { db } from "@/lib/db";
import { fail, handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handler(async (ctx) => {
  const [notifications, approvals, settings] = await Promise.all([
    db.find("notifications", { organizationId: ctx.session.organizationId }),
    db.find("approval_requests", { organizationId: ctx.session.organizationId }),
    db.findOne("settings", { organizationId: ctx.session.organizationId }),
  ]);
  const unread = notifications.filter((n) => !n.read).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json({
    notifications: unread.slice(0, 12).map((n) => ({
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
    })),
    unread: unread.length,
    autonomyPaused: settings?.autonomy.paused ?? false,
    pendingApprovals: approvals.filter((a) => a.status === "PENDING").length,
  });
});
