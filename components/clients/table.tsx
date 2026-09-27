"use client";

import Link from "next/link";
import { Building2, Mail, Phone } from "lucide-react";
import { Badge, Progress } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { compactMoney, money, num, relative } from "@/lib/utils";

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  lifetimeValue: number;
  monthlyRecurring: number;
  contractValue: number;
  onboardingProgress: number;
  projects: number;
  openTickets: number;
  proposals: number;
  email: string;
  phone: string;
  city: string;
  category: string;
  createdAt: string;
};

const TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  ONBOARDING: "warning",
  ACTIVE: "success",
  PAUSED: "warning",
  CHURNED: "neutral",
};

export function ClientTable({ rows }: { rows: ClientRow[] }) {
  const columns: Column<ClientRow>[] = [
    {
      key: "name",
      header: "Client",
      sortable: true,
      sortValue: (c) => c.name,
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-[10px] font-bold uppercase text-brand-300">
            {c.name.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <Link href={`/clients/${c.id}`} className="block truncate font-medium text-ink hover:text-brand-200">
              {c.name}
            </Link>
            <p className="truncate text-[10.5px] text-ink-faint">
              {c.category || "—"}
              {c.city ? ` · ${c.city}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (c) => c.status,
      render: (c) => <Badge tone={TONE[c.status] ?? "neutral"}>{c.status.toLowerCase()}</Badge>,
    },
    {
      key: "onboarding",
      header: "Onboarding",
      sortable: true,
      sortValue: (c) => c.onboardingProgress,
      hideBelow: "md",
      render: (c) => (
        <div className="w-28">
          <div className="flex items-center justify-between gap-2">
            <span className="tnum text-[11px] text-ink-muted">{c.onboardingProgress}%</span>
            {c.onboardingProgress >= 100 && <span className="text-[10px] text-emerald-400">complete</span>}
          </div>
          <Progress value={c.onboardingProgress} className="mt-1" tone={c.onboardingProgress >= 100 ? "success" : "warning"} />
        </div>
      ),
    },
    {
      key: "ltv",
      header: "Lifetime value",
      align: "right",
      sortable: true,
      sortValue: (c) => c.lifetimeValue,
      render: (c) => <span className="tnum font-semibold text-ink">{money(c.lifetimeValue)}</span>,
    },
    {
      key: "mrr",
      header: "Recurring",
      align: "right",
      sortable: true,
      sortValue: (c) => c.monthlyRecurring,
      hideBelow: "lg",
      render: (c) =>
        c.monthlyRecurring > 0 ? (
          <span className="tnum text-emerald-300">{compactMoney(c.monthlyRecurring)}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "projects",
      header: "Projects",
      align: "center",
      sortable: true,
      sortValue: (c) => c.projects,
      hideBelow: "sm",
      render: (c) => (
        <Link href="/projects" className="tnum text-ink-muted hover:text-brand-200">
          {num(c.projects)}
        </Link>
      ),
    },
    {
      key: "tickets",
      header: "Tickets",
      align: "center",
      sortable: true,
      sortValue: (c) => c.openTickets,
      hideBelow: "lg",
      render: (c) =>
        c.openTickets > 0 ? (
          <Link href="/support" className="tnum rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
            {c.openTickets}
          </Link>
        ) : (
          <span className="tnum text-ink-faint">0</span>
        ),
    },
    {
      key: "contact",
      header: "Contact",
      hideBelow: "xl",
      render: (c) => (
        <div className="space-y-0.5">
          {c.email && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Mail className="h-2.5 w-2.5 text-ink-faint" />
              {c.email}
            </span>
          )}
          {c.phone && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Phone className="h-2.5 w-2.5 text-ink-faint" />
              {c.phone}
            </span>
          )}
          {!c.email && !c.phone && <span className="text-[11px] text-ink-faint">No contact details</span>}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Since",
      align: "right",
      sortable: true,
      sortValue: (c) => c.createdAt,
      hideBelow: "md",
      render: (c) => <span className="text-[11px] text-ink-faint">{relative(c.createdAt)}</span>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      pageSize={20}
      initialSort={{ key: "ltv", dir: "desc" }}
      searchPlaceholder="Search client, city, category…"
      empty={<p className="py-8 text-center text-[12.5px] text-ink-faint">No clients match.</p>}
    />
  );
}

export { Building2 };
