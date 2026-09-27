"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { Badge, Button, Textarea } from "@/components/ui";
import { cn, dateTime, percent, relative } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  direction: string;
  body: string;
  subject: string;
  createdAt: string;
  intent: string | null;
  intentConfidence: number | null;
  suggestedReply: string | null;
  isFromAgent: boolean;
  agentKey: string | null;
};

export type Thread = {
  id: string;
  subject: string;
  channel: string;
  state: string;
  stateTone: "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";
  lastIntent: string | null;
  unreadCount: number;
  counterparty: string;
  leadId: string | null;
  clientId: string | null;
  messages: ThreadMessage[];
};

export function ConversationList({ items }: { items: Thread[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const active = items.find((c) => c.id === activeId) ?? items[0];
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!active) return null;

  async function send() {
    if (!active || !reply.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/conversations/${active.id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setFeedback(json.error ?? "The reply could not be sent");
        return;
      }
      setReply("");
      setFeedback("Reply sent. The prospect's next inbound message will be classified automatically.");
      window.location.reload();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const lastSuggestion = [...active.messages].reverse().find((m) => m.suggestedReply)?.suggestedReply;

  return (
    <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
      {/* ------------------------------------------------------- thread list */}
      <ul className="max-h-[520px] overflow-y-auto border-b border-line lg:border-b-0 lg:border-r">
        {items.map((thread) => {
          const last = thread.messages[thread.messages.length - 1];
          const selected = thread.id === active.id;
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setActiveId(thread.id)}
                className={cn(
                  "w-full border-b border-line/40 px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-brand-500/10" : "hover:bg-white/[0.025]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12.5px] font-medium text-ink">{thread.counterparty}</p>
                  {thread.unreadCount > 0 && (
                    <span className="tnum grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9.5px] font-bold text-white">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-ink-muted">{thread.subject}</p>
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ink-faint">{last?.body ?? ""}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone={thread.stateTone}>{thread.state.replace(/_/g, " ").toLowerCase()}</Badge>
                  <span className="text-[10px] text-ink-faint">{relative(thread.messages.at(-1)?.createdAt ?? "")}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* ------------------------------------------------------------ thread */}
      <div className="flex min-h-[520px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{active.subject}</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {active.counterparty} · {active.channel.toLowerCase()}
              {active.leadId && (
                <>
                  {" · "}
                  <Link href={`/leads/${active.leadId}`} className="text-brand-300 hover:text-brand-200">
                    open lead
                  </Link>
                </>
              )}
              {active.clientId && (
                <>
                  {" · "}
                  <Link href={`/clients/${active.clientId}`} className="text-brand-300 hover:text-brand-200">
                    open client
                  </Link>
                </>
              )}
            </p>
          </div>
          <Badge tone={active.stateTone}>{active.state.replace(/_/g, " ").toLowerCase()}</Badge>
        </header>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
          {active.messages.length === 0 && (
            <p className="py-8 text-center text-[12px] text-ink-faint">No messages in this thread.</p>
          )}
          {active.messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2", m.direction === "OUTBOUND" && "flex-row-reverse")}>
              <span
                className={cn(
                  "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[9.5px] font-bold uppercase",
                  m.direction === "OUTBOUND"
                    ? "border-brand-500/30 bg-brand-500/10 text-brand-300"
                    : "border-line bg-surface-2 text-ink-muted",
                )}
              >
                {m.isFromAgent ? <Bot className="h-3 w-3" /> : m.direction === "OUTBOUND" ? <User className="h-3 w-3" /> : "P"}
              </span>
              <div
                className={cn(
                  "max-w-[78%] rounded-xl border px-3 py-2",
                  m.direction === "OUTBOUND" ? "border-brand-500/25 bg-brand-500/8" : "border-line bg-surface-2/50",
                )}
              >
                {m.subject && <p className="mb-0.5 text-[11px] font-medium text-ink-muted">{m.subject}</p>}
                <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink">{m.body}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-ink-faint" title={dateTime(m.createdAt)}>
                    {relative(m.createdAt)}
                  </span>
                  {m.intent && (
                    <Badge tone="info">
                      {m.intent.replace(/_/g, " ").toLowerCase()}
                      {m.intentConfidence !== null && ` · ${percent(m.intentConfidence * 100)}`}
                    </Badge>
                  )}
                  {m.isFromAgent && <Badge tone="brand">agent</Badge>}
                </div>
                {m.suggestedReply && (
                  <p className="mt-2 rounded-lg border border-line bg-surface-1/60 p-2 text-[11.5px] leading-relaxed text-ink-muted">
                    <Sparkles className="mr-1 inline h-3 w-3 text-accent-300" />
                    Suggested: {m.suggestedReply}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <footer className="border-t border-line p-3">
          {lastSuggestion && (
            <button
              type="button"
              onClick={() => setReply(lastSuggestion)}
              className="mb-2 flex w-full items-start gap-2 rounded-lg border border-accent-500/25 bg-accent-500/5 px-2.5 py-2 text-left transition-colors hover:border-accent-500/50"
            >
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent-300" />
              <span className="text-[11.5px] leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">Use the suggested reply:</span> {lastSuggestion.slice(0, 160)}
                {lastSuggestion.length > 160 ? "…" : ""}
              </span>
            </button>
          )}
          <Textarea
            label={`Reply to ${active.counterparty}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Write your reply…"
          />
          {feedback && (
            <p className="mt-1.5 text-[11.5px] text-ink-muted" role="status">
              {feedback}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <Button size="sm" loading={busy} disabled={!reply.trim()} onClick={send}>
              <Send className="h-3.5 w-3.5" />
              Send reply
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
