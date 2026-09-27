"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  FileText,
  FolderKanban,
  Gauge,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { CopilotDrawer } from "./copilot";
import {
  ConfirmAutonomy,
  NotificationPanel,
  SystemStatusPanel,
  ToastStack,
  Topbar,
  type HealthItem,
} from "./topbar";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  userName: string;
  userEmail: string;
  userRole: string;
  isDemo: boolean;
  organizationId: string;
  autonomyPaused: boolean;
  counts: {
    approvals: number;
    conversations: number;
    projects: number;
    support: number;
    notifications: number;
  };
  health: HealthItem[];
  initialNotifications: Array<{
    id: string;
    title: string;
    body: string;
    severity: string;
    href: string | null;
    createdAt: string;
    read: boolean;
  }>;
  children: React.ReactNode;
}

export function AppShell(props: AppShellProps) {
  const {
    userName,
    userEmail,
    userRole,
    isDemo,
    organizationId,
    autonomyPaused,
    counts: initialCounts,
    health,
    initialNotifications,
    children,
  } = props;

  const [counts, setCounts] = useState<AppShellProps["counts"]>(initialCounts);

  const router = useRouter();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmAutonomy, setConfirmAutonomy] = useState(false);
  const [paused, setPaused] = useState(autonomyPaused);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [toasts, setToasts] = useState<
    Array<{ id: string; title: string; body?: string; tone: "success" | "error" | "info" }>
  >([]);

  const pushToast = useCallback(
    (title: string, body?: string, tone: "success" | "error" | "info" = "info") => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((t) => [...t, { id, title, body, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
    },
    [],
  );

  /* ------------------------------------------------------- keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setNotifOpen(false);
        setStatusOpen(false);
        setMobileNavOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------------------- live polling */
  useEffect(() => {
    const controller = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch("/api/live", { signal: controller.signal });
        if (!res.ok) return;
        const json = (await res.json()) as {
          notifications?: typeof notifications;
          unread?: number;
          autonomyPaused?: boolean;
          pendingApprovals?: number;
        };
        if (json.notifications) setNotifications(json.notifications);
        if (typeof json.autonomyPaused === "boolean") setPaused(json.autonomyPaused);
        if (json.pendingApprovals !== undefined) {
          setCounts((c) => ({ ...c, approvals: json.pendingApprovals! }));
        }
      } catch {
        /* polling is best-effort */
      }
    };
    const timer = setInterval(poll, 12_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const toggleAutonomy = async () => {
    const next = !paused;
    setPaused(next);
    setConfirmAutonomy(false);
    try {
      const res = await fetch("/api/autonomy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      pushToast(
        next ? "Autonomy paused" : "Autonomy resumed",
        json.message ?? "",
        json.ok ? (next ? "info" : "success") : "error",
      );
      router.refresh();
    } catch {
      pushToast("Could not change autonomy", "The request failed.", "error");
    }
  };

  const markAllRead = async () => {
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-30 hidden w-[218px] border-r border-line bg-surface/70 backdrop-blur-xl lg:block">
        <Sidebar counts={counts} autonomyPaused={paused} />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/70" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-surface animate-slide-left">
            <Sidebar counts={counts} autonomyPaused={paused} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[218px]">
        <div className="relative">
          <Topbar
            userName={userName}
            userEmail={userEmail}
            userRole={userRole}
            isDemo={isDemo}
            autonomyPaused={paused}
            notificationCount={unread}
            pendingApprovals={counts.approvals}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onOpenCopilot={() => setCopilotOpen(true)}
            onOpenNotifications={() => {
              setNotifOpen((v) => !v);
              setStatusOpen(false);
            }}
            onToggleAutonomy={() => setConfirmAutonomy(true)}
            onSearch={() => setPaletteOpen(true)}
          />

          {/* Panels */}
          {(notifOpen || statusOpen) && (
            <>
              <button className="fixed inset-0 z-30" onClick={() => { setNotifOpen(false); setStatusOpen(false); }} aria-label="Close panel" />
              <div className="absolute right-3 top-full z-40 mt-1 sm:right-4">
                {notifOpen && (
                  <NotificationPanel
                    notifications={notifications}
                    onClose={() => setNotifOpen(false)}
                    onMarkAllRead={markAllRead}
                  />
                )}
                {statusOpen && (
                  <SystemStatusPanel items={health} autonomyPaused={paused} onToggleAutonomy={() => setConfirmAutonomy(true)} />
                )}
              </div>
            </>
          )}
        </div>

        <main className="min-w-0 flex-1 pb-20 lg:pb-6">
          <div key={pathname} className="animate-fade">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-base/95 backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <MobileLink href="/dashboard" label="Home" icon={LayoutDashboard} />
        <MobileLink href="/leads" label="Leads" icon={Users} badge={counts.approvals ? undefined : undefined} />
        <MobileLink href="/activity" label="Activity" icon={Activity} />
        <MobileLink href="/approvals" label="Approvals" icon={ShieldCheck} badge={counts.approvals} />
        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-2.5 text-ink-faint transition-colors active:text-ink"
        >
          <Gauge className="h-[18px] w-[18px]" />
          <span className="text-[9.5px] font-medium">More</span>
        </button>
      </nav>

      {/* Floating system status (desktop) */}
      <button
        onClick={() => {
          setStatusOpen((v) => !v);
          setNotifOpen(false);
        }}
        className="fixed bottom-4 right-4 z-30 hidden items-center gap-2 rounded-full border border-line bg-surface/90 px-3 py-2 text-[11px] font-medium text-ink-muted backdrop-blur-xl transition-colors hover:text-ink lg:flex"
      >
        <span className={cn("h-2 w-2 rounded-full", paused ? "bg-danger" : "animate-pulse-soft bg-success")} />
        {paused ? "Autonomy paused" : "System status"}
      </button>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        organizationId={organizationId}
        autonomyPaused={paused}
        onToggleAutonomy={() => setConfirmAutonomy(true)}
        onToast={pushToast}
      />

      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} onToast={pushToast} />

      <ConfirmAutonomy
        open={confirmAutonomy}
        paused={paused}
        onConfirm={toggleAutonomy}
        onCancel={() => setConfirmAutonomy(false)}
      />

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <button
      onClick={() => router.push(href)}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 py-2.5 transition-colors",
        active ? "text-brand-300" : "text-ink-faint",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="text-[9.5px] font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-1/2 top-1.5 h-1.5 w-1.5 translate-x-3 rounded-full bg-brand-400" />
      )}
    </button>
  );
}

export { BarChart3, Bot, Building2, FileText, FolderKanban, Globe2, LifeBuoy, MessagesSquare, Settings, Users };
