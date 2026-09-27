"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  FileText,
  FolderKanban,
  Gauge,
  Globe2,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const NAV_ITEMS: Omit<NavItem, "badge">[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pipeline", href: "/pipeline", icon: Gauge },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Websites", href: "/websites", icon: Globe2 },
  { label: "Conversations", href: "/conversations", icon: MessagesSquare },
  { label: "Proposals", href: "/proposals", icon: FileText },
  { label: "Support", href: "/support", icon: LifeBuoy },
  { label: "Approvals", href: "/approvals", icon: ShieldCheck },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Portal", href: "/portal", icon: Inbox },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({
  counts,
  onNavigate,
  autonomyPaused,
}: {
  counts: { approvals?: number; conversations?: number; projects?: number; support?: number };
  onNavigate?: () => void;
  autonomyPaused?: boolean;
}) {
  const pathname = usePathname();

  const badges: Record<string, number | undefined> = {
    "/approvals": counts.approvals,
    "/conversations": counts.conversations,
    "/projects": counts.projects,
    "/support": counts.support,
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="currentColor">
              <path d="M4 18 12 4l8 14h-4.6L12 10.8 8.6 18z" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-ink-strong">NEXORA</span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-ink-faint">
              Agency OS
            </span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const badge = badges[item.href];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                    active
                      ? "bg-brand-500/12 text-ink-strong"
                      : "text-ink-muted hover:bg-white/4 hover:text-ink",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-400" />
                  )}
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-brand-300" : "text-ink-faint group-hover:text-ink-muted",
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="tnum rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-200">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Autonomy status */}
      <div className="shrink-0 border-t border-line p-2">
        <div
          className={cn(
            "mb-2 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold",
            autonomyPaused
              ? "border-danger/30 bg-danger/10 text-red-300"
              : "border-success/25 bg-success/10 text-emerald-300",
          )}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-70",
                autonomyPaused ? "bg-danger" : "animate-pulse-soft bg-success",
              )}
            />
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", autonomyPaused ? "bg-danger" : "bg-success")} />
          </span>
          {autonomyPaused ? "AUTONOMY PAUSED" : "AUTONOMY LIVE"}
        </div>

        <Link
          href="/settings?section=ai"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-ink-muted transition-colors hover:bg-white/4 hover:text-ink"
        >
          <Sparkles className="h-4 w-4 text-ink-faint" />
          Copilot
          <kbd className="ml-auto rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
            ⌘K
          </kbd>
        </Link>
        <Link
          href="/settings?section=notifications"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-ink-muted transition-colors hover:bg-white/4 hover:text-ink"
        >
          <Bell className="h-4 w-4 text-ink-faint" />
          Notifications
        </Link>
        <Link
          href="/settings?section=security"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-ink-muted transition-colors hover:bg-white/4 hover:text-ink"
        >
          <Inbox className="h-4 w-4 text-ink-faint" />
          Owner profile
        </Link>
      </div>
    </div>
  );
}
