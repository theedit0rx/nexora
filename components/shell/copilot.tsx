"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ kind: string; label: string; href?: string; payload?: Record<string, unknown> }>;
  pending?: boolean;
}

const SUGGESTIONS = [
  "Find restaurants with poor websites",
  "Show leads waiting for outreach",
  "Show pending approvals",
  "Which industries have the highest conversion?",
  "How many clients do we have?",
];

export function CopilotDrawer({
  open,
  onClose,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  onToast: (title: string, body?: string, tone?: "success" | "error" | "info") => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setInput("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
    setThinking(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const json = (await res.json()) as {
        reply: string;
        actions?: CopilotMessage["actions"];
      };
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: json.reply,
          actions: json.actions ?? [],
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", content: "I couldn't reach the NEXORA copilot service." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const runAction = async (action: NonNullable<CopilotMessage["actions"]>[number]) => {
    if (action.kind === "navigate" && action.href) {
      router.push(action.href);
      onClose();
      return;
    }
    if (action.kind === "confirm_action" && action.payload) {
      setThinking(true);
      try {
        const res = await fetch("/api/copilot/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action.payload),
        });
        const json = (await res.json()) as { ok: boolean; message?: string };
        onToast(json.ok ? "Action completed" : "Action failed", json.message ?? "", json.ok ? "success" : "error");
        if (json.ok) router.refresh();
      } finally {
        setThinking(false);
      }
    }
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-90 flex w-full max-w-[420px] flex-col border-l border-line bg-surface/95 backdrop-blur-xl animate-slide-left"
      aria-label="NEXORA Copilot"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink-strong">NEXORA Copilot</p>
            <p className="text-[10px] text-ink-faint">Reads live workspace data · confirms before acting</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close copilot">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="panel p-3.5">
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                I answer from your real NEXORA data — leads, audits, scores, proposals, deployments and agents.
                When something would change state, I ask you to confirm it first.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Try</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="block w-full rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-left text-[12px] text-ink-muted transition-colors hover:border-brand-500/40 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                m.role === "user"
                  ? "bg-brand-600/90 text-white"
                  : "border border-line bg-surface-2/70 text-ink whitespace-pre-wrap",
              )}
            >
              {m.content}
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {m.actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => void runAction(a)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        a.kind === "confirm_action"
                          ? "border-brand-500/50 bg-brand-500/15 text-brand-200 hover:bg-brand-500/25"
                          : "border-line bg-surface-3 text-ink-muted hover:text-ink",
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-3.5 py-2.5 text-[12px] text-ink-faint">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400" />
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400 [animation-delay:200ms]" />
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400 [animation-delay:400ms]" />
              </span>
              Working…
            </div>
          </div>
        )}
      </div>

      <form
        className="shrink-0 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ask NEXORA anything…"
            aria-label="Copilot input"
            className="max-h-28 min-h-[38px] flex-1 resize-none rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
          <Button type="submit" variant="primary" size="icon" disabled={thinking || !input.trim()} aria-label="Send">
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </aside>
  );
}
