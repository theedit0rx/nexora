"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProjectStage } from "@/lib/db/schema";

/** Stage selector for a project. */
export function ProjectStageControl({ projectId, current }: { projectId: string; current: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function change(next: string) {
    if (next === current) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/stage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setMessage(json.error ?? "Could not change the stage");
        return;
      }
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="sr-only" htmlFor="project-stage">
        Project stage
      </label>
      <div className="relative">
        <select
          id="project-stage"
          value={current}
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          className="h-9 w-full min-w-[170px] appearance-none rounded-lg border border-line bg-surface-2/60 pl-3 pr-8 text-[13px] text-ink focus:border-brand-500/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          {ProjectStage.options.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
      </div>
      {message && <p className="mt-1 text-[11px] text-red-300">{message}</p>}
    </div>
  );
}
