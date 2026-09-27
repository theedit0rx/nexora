"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  FileText,
  FolderKanban,
  Globe2,
  Pause,
  Play,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/search";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  run: () => void | Promise<void>;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  autonomyPaused: boolean;
  onToggleAutonomy: () => void;
  onToast: (title: string, body?: string, tone?: "success" | "error" | "info") => void;
}

export function CommandPalette({
  open,
  onClose,
  organizationId,
  autonomyPaused,
  onToggleAutonomy,
  onToast,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Live search
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const json = (await res.json()) as { results?: SearchResult[] };
        if (!cancelled) setResults(json.results ?? []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "find-lead",
        label: "Find lead",
        hint: "Search every lead by name, city or category",
        icon: Users,
        group: "Leads",
        keywords: "search lead crm",
        run: () => router.push("/leads"),
      },
      {
        id: "run-research",
        label: "Run research on the latest lead",
        hint: "GREEN action — no approval needed",
        icon: Sparkles,
        group: "Agents",
        keywords: "research analyse business",
        run: async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/agents/run", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "research_latest" }),
            });
            const json = (await res.json()) as { ok: boolean; message?: string };
            onToast(
              json.ok ? "Research complete" : "Research failed",
              json.message ?? "",
              json.ok ? "success" : "error",
            );
            if (json.ok) router.refresh();
          } finally {
            setBusy(false);
          }
        },
      },
      {
        id: "discover",
        label: "Discover businesses with Scout",
        hint: "Runs the multi-source discovery agent",
        icon: Radar,
        group: "Agents",
        keywords: "scout discover leads google places",
        run: () => router.push("/agents/scout"),
      },
      {
        id: "build-demo",
        label: "Build a demo website",
        hint: "Generate a real site from the component library",
        icon: Globe2,
        group: "Build",
        keywords: "demo website generate builder",
        run: () => router.push("/websites"),
      },
      {
        id: "create-proposal",
        label: "Create proposal",
        hint: "Pricing comes from your configured rules",
        icon: FileText,
        group: "Sales",
        keywords: "proposal quote pricing",
        run: () => router.push("/proposals"),
      },
      {
        id: "create-client",
        label: "Create client",
        hint: "Convert a won lead into a client",
        icon: Building2,
        group: "Sales",
        keywords: "client onboard new",
        run: () => router.push("/clients?new=1"),
      },
      {
        id: "open-approvals",
        label: "Open approvals",
        hint: "Review pending RED and YELLOW actions",
        icon: ShieldCheck,
        group: "Control",
        keywords: "approval pending approve reject",
        run: () => router.push("/approvals"),
      },
      {
        id: "pause-agent",
        label: autonomyPaused ? "Resume autonomy" : "Pause an agent",
        hint: autonomyPaused ? "Re-enable automated actions" : "Agent-level control lives on /agents",
        icon: autonomyPaused ? Play : Pause,
        group: "Control",
        keywords: "pause resume kill switch autonomy agent",
        run: autonomyPaused ? onToggleAutonomy : () => router.push("/agents"),
      },
      {
        id: "search-project",
        label: "Search projects",
        icon: FolderKanban,
        group: "Delivery",
        keywords: "project search build",
        run: () => router.push("/projects"),
      },
      {
        id: "agents",
        label: "Open agent control centre",
        icon: Bot,
        group: "Control",
        keywords: "agents supervisor monitor",
        run: () => router.push("/agents"),
      },
      {
        id: "settings",
        label: "Go to settings",
        icon: Search,
        group: "System",
        keywords: "settings configuration integrations",
        run: () => router.push("/settings"),
      },
    ],
    [router, autonomyPaused, onToggleAutonomy, onToast],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.keywords ?? "").includes(q),
    );
  }, [commands, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
  const total = flat.length + results.length;

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(total - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < flat.length) void flat[active]!.run();
      else {
        const result = results[active - flat.length];
        if (result) {
          router.push(result.href);
          onClose();
        }
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center p-4 pt-[10vh]">
      <button className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="panel relative z-10 w-full max-w-xl animate-rise overflow-hidden"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search anything…"
            aria-label="Command or search"
            className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />}
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-1.5">
          {groups.map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{group}</p>
              {items.map((cmd) => {
                const index = flat.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      void cmd.run();
                      onClose();
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                      active === index ? "bg-brand-500/12" : "hover:bg-white/4",
                    )}
                  >
                    <cmd.icon className={cn("h-4 w-4 shrink-0", active === index ? "text-brand-300" : "text-ink-faint")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{cmd.label}</span>
                      {cmd.hint && <span className="block truncate text-[11px] text-ink-faint">{cmd.hint}</span>}
                    </span>
                    {active === index && (
                      <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {results.length > 0 && (
            <div>
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Search results
              </p>
              {results.map((r, i) => {
                const index = flat.length + i;
                return (
                  <button
                    key={`${r.kind}-${r.id}`}
                    onClick={() => {
                      router.push(r.href);
                      onClose();
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                      active === index ? "bg-brand-500/12" : "hover:bg-white/4",
                    )}
                  >
                    <span className="w-14 shrink-0 rounded border border-line px-1 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-ink-faint">
                      {r.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{r.title}</span>
                      <span className="block truncate text-[11px] text-ink-faint">{r.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 && results.length === 0 && (
            <p className="px-4 py-8 text-center text-[12.5px] text-ink-faint">
              No commands or records match “{query}”.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[10.5px] text-ink-faint">
          <span>↑↓ to navigate · ↵ to run</span>
          <span>NEXORA command palette</span>
        </div>
      </div>
    </div>
  );
}
