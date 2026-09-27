"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui";

/** Pause/resume an individual agent. */
export function AgentControlButton({ agentKey, paused }: { agentKey: string; paused: boolean }) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(paused);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setMsg(null);
    const next = !state;
    try {
      const res = await fetch(`/api/agents/${agentKey}/pause`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setMsg(json.error ?? "Could not update the agent");
        return;
      }
      setState(next);
      setMsg(next ? "Paused" : "Resumed");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant={state ? "outline" : "secondary"}
        size="sm"
        loading={busy}
        onClick={toggle}
        aria-pressed={state}
        aria-label={state ? `Resume ${agentKey}` : `Pause ${agentKey}`}
      >
        {state ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        {state ? "Resume" : "Pause"}
      </Button>
      {msg && (
        <span className="text-[11px] text-ink-faint" role="status">
          {msg}
        </span>
      )}
    </div>
  );
}
