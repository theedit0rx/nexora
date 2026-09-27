"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Command,
  Pause,
  Play,
  Search,
  ShieldAlert,
  Signal,
  X,
} from "lucide-react";
import { Button, Badge, Modal, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface TopbarProps {
  userName: string;
  userEmail: string;
  userRole: string;
  isDemo: boolean;
  autonomyPaused: boolean;
  notificationCount: number;
  pendingApprovals: number;
  onOpenCommandPalette: () => void;
  onOpenCopilot: () => void;
  onOpenNotifications: () => void;
  onToggleAutonomy: () => void;
  onSearch: (q: string) => void;
}

export function Topbar({
  userName,
  userEmail,
  userRole,
  isDemo,
  autonomyPaused,
  notificationCount,
  pendingApprovals,
  onOpenCommandPalette,
  onOpenCopilot,
  onOpenNotifications,
  onToggleAutonomy,
  onSearch,
}: TopbarProps) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-base/85 px-3 backdrop-blur-xl sm:px-4">
      {/* Search */}
      <form
        className="relative hidden min-w-0 flex-1 max-w-md sm:block"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) router.push(`/activity?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch(e.target.value);
          }}
          placeholder="Search leads, clients, projects, proposals…"
          aria-label="Global search"
          className="h-8 w-full rounded-lg border border-line bg-surface-2/60 pl-8 pr-16 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
        />
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded border border-line bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:text-ink"
        >
          <Command className="h-2.5 w-2.5" />K
        </button>
      </form>

      <div className="flex flex-1 items-center gap-1.5 sm:flex-none">
        {isDemo && (
          <Badge tone="warning" className="hidden md:inline-flex">
            Demo Mode
          </Badge>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="sm:hidden"
          onClick={onOpenCommandPalette}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>

        <Button size="sm" variant="ghost" onClick={onOpenCopilot} className="hidden lg:inline-flex">
          <Signal className="h-3.5 w-3.5 text-accent-300" />
          Copilot
        </Button>

        {/* Kill switch */}
        <Button
          size="sm"
          variant={autonomyPaused ? "success" : "danger"}
          onClick={onToggleAutonomy}
          title={autonomyPaused ? "Resume autonomy" : "Pause all automation"}
          className={cn("font-semibold", autonomyPaused && "animate-pulse-soft")}
        >
          {autonomyPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{autonomyPaused ? "Resume" : "Pause autonomy"}</span>
        </Button>

        <button
          onClick={onOpenNotifications}
          className="relative grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
          aria-label={`Notifications (${notificationCount} unread)`}
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/5"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] font-bold text-white">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden min-w-0 flex-col items-start leading-none md:flex">
              <span className="max-w-[120px] truncate text-[12px] font-semibold text-ink">{userName}</span>
              <span className="text-[10px] text-ink-faint">{userRole}</span>
            </span>
          </button>
          {menuOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} />
              <div
                role="menu"
                className="panel absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden p-1"
              >
                <div className="border-b border-line px-3 py-2.5">
                  <p className="text-[12.5px] font-semibold text-ink-strong">{userName}</p>
                  <p className="truncate text-[11px] text-ink-faint">{userEmail}</p>
                  {isDemo && <Badge tone="warning" className="mt-1.5">Demo workspace</Badge>}
                </div>
                <MenuLink href="/settings?section=general" label="General settings" onNavigate={() => setMenuOpen(false)} />
                <MenuLink href="/settings?section=security" label="Security & audit" onNavigate={() => setMenuOpen(false)} />
                <MenuLink href="/approvals" label={`Approvals${pendingApprovals ? ` (${pendingApprovals})` : ""}`} onNavigate={() => setMenuOpen(false)} />
                <form action="/api/auth/logout" method="post" className="mt-0.5">
                  <button
                    type="submit"
                    className="w-full rounded-md px-3 py-2 text-left text-[12.5px] text-red-300 transition-colors hover:bg-danger/10"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  const router = useRouter();
  return (
    <button
      role="menuitem"
      onClick={() => {
        onNavigate();
        router.push(href);
      }}
      className="w-full rounded-md px-3 py-2 text-left text-[12.5px] text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------- system status ---- */

export interface HealthItem {
  key: string;
  name: string;
  status: "CONNECTED" | "NOT_CONNECTED" | "WARNING" | "ERROR";
  detail: string;
}

export function SystemStatusPanel({
  items,
  autonomyPaused,
  onToggleAutonomy,
}: {
  items: HealthItem[];
  autonomyPaused: boolean;
  onToggleAutonomy: () => void;
}) {
  const connected = items.filter((i) => i.status === "CONNECTED").length;
  return (
    <div className="panel w-[300px] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-ink-strong">System status</p>
        <Badge tone={connected === items.length ? "success" : "warning"}>
          {connected}/{items.length} connected
        </Badge>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-white/3">
            <StatusDot status={item.status} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-ink">{item.name}</p>
              <p className="truncate text-[10.5px] text-ink-faint" title={item.detail}>
                {item.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-line pt-2">
        <Button
          size="sm"
          variant={autonomyPaused ? "success" : "danger"}
          className="w-full"
          onClick={onToggleAutonomy}
        >
          {autonomyPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {autonomyPaused ? "Resume autonomy" : "PAUSE AUTONOMY"}
        </Button>
      </div>
    </div>
  );
}

export function StatusDot({ status }: { status: HealthItem["status"] }) {
  const map = {
    CONNECTED: "bg-success",
    NOT_CONNECTED: "bg-ink-faint",
    WARNING: "bg-warning",
    ERROR: "bg-danger",
  };
  return <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", map[status])} aria-hidden />;
}

/* ------------------------------------------------------------- notifications */

export function NotificationPanel({
  notifications,
  onClose,
  onMarkAllRead,
}: {
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    severity: string;
    href: string | null;
    createdAt: string;
    read: boolean;
  }>;
  onClose: () => void;
  onMarkAllRead: () => void;
}) {
  const router = useRouter();
  return (
    <div className="panel w-[340px] max-w-[calc(100vw-24px)] p-0">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[12.5px] font-semibold text-ink-strong">Notifications</p>
        <div className="flex items-center gap-1">
          <Button size="xs" variant="ghost" onClick={onMarkAllRead}>
            Mark all read
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <ul className="max-h-[380px] overflow-y-auto">
        {notifications.length === 0 && (
          <li className="px-4 py-8 text-center text-[12px] text-ink-faint">Nothing new right now.</li>
        )}
        {notifications.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => {
                if (n.href) router.push(n.href);
                onClose();
              }}
              className={cn(
                "flex w-full gap-2.5 border-b border-line/50 px-4 py-3 text-left transition-colors hover:bg-white/3",
                !n.read && "bg-brand-500/[0.06]",
              )}
            >
              <StatusDot status={severityToStatus(n.severity)} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-ink">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-faint">{n.body}</p>}
                <p className="mt-1 text-[10px] text-ink-faint">{n.createdAt}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function severityToStatus(severity: string): HealthItem["status"] {
  if (severity === "DANGER") return "ERROR";
  if (severity === "WARNING") return "WARNING";
  if (severity === "SUCCESS") return "CONNECTED";
  return "NOT_CONNECTED";
}

/* --------------------------------------------------------- confirm dialog -- */

export function ConfirmAutonomy({
  open,
  paused,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  paused: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={paused ? "Resume autonomous operation" : "Pause all automation"}
      description={
        paused
          ? "NEXORA will resume running enabled GREEN and YELLOW actions automatically."
          : "NEXORA stops starting any new automated external action. Data, tasks and in-flight safe internal work are preserved."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={paused ? "success" : "danger"} onClick={onConfirm}>
            {paused ? "Resume autonomy" : "Pause autonomy"}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2/50 p-3">
        <ShieldAlert className={cn("mt-0.5 h-4 w-4 shrink-0", paused ? "text-success" : "text-warning")} />
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          {paused
            ? "Automatic outreach, replies, follow-ups and deployments will resume according to your automation settings."
            : "You can resume at any time. Individual agents can also be paused separately from the Agents page, and outreach can be paused on its own from Settings → Outreach."}
        </p>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- toasts ---- */

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Array<{ id: string; title: string; body?: string; tone: "success" | "error" | "info" }>;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-100 flex w-[320px] max-w-[calc(100vw-32px)] flex-col gap-2 lg:bottom-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "panel pointer-events-auto flex items-start gap-2.5 p-3 animate-slide-left",
            t.tone === "success" && "border-success/30",
            t.tone === "error" && "border-danger/30",
          )}
        >
          <StatusDot
            status={t.tone === "success" ? "CONNECTED" : t.tone === "error" ? "ERROR" : "NOT_CONNECTED"}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-ink-strong">{t.title}</p>
            {t.body && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{t.body}</p>}
          </div>
          <button onClick={() => onDismiss(t.id)} className="text-ink-faint hover:text-ink" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export { Textarea };
