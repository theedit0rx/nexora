"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Globe2, Rocket, Send } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { VerdictBadge } from "@/components/dashboard/lead-detail-drawer";
import { relative } from "@/lib/utils";

export type WebsiteItem = {
  id: string;
  kind: "DEMO" | "BUILD";
  title: string;
  subtitle: string;
  href: string | null;
  leadId: string | null;
  clientId: string | null;
  projectId: string | null;
  status: string;
  tone: "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";
  previewUrl: string | null;
  productionUrl: string | null;
  pages: string[];
  buildTimeMs: number | null;
  screenshot: string | null;
  createdAt: string;
  qa: {
    id: string;
    verdict: string;
    score: number;
    checks: Array<{ code: string; label: string; passed: boolean; detail: string }>;
    createdAt: string;
  } | null;
  deployment: {
    id: string;
    status: string;
    kind: string;
    url: string | null;
    createdAt: string;
  } | null;
  businessName: string | null;
};

export function WebsiteGrid({ items }: { items: WebsiteItem[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openQa, setOpenQa] = useState<WebsiteItem | null>(null);

  async function act(item: WebsiteItem, kind: "PREVIEW" | "PRODUCTION") {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/websites/${item.id}/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        approvalRequired?: boolean;
        approvalId?: string;
        qa?: { verdict: string };
      };
      if (json.approvalRequired) {
        setFeedback("Production deployment queued for approval — see the approvals page.");
      } else if (!res.ok || json.error) {
        setFeedback(json.error ?? "Deployment failed");
      } else {
        setFeedback("Deployment started.");
      }
      window.location.reload();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {feedback && (
        <p className="mb-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink" role="status">
          {feedback}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="panel flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line p-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[13px] font-semibold text-ink-strong">
                    {item.href ? (
                      <Link href={item.href} className="hover:text-brand-200">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </h3>
                  <Badge tone={item.tone}>{item.status.toLowerCase()}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {item.subtitle} · {item.pages.length || 0} pages
                  {item.buildTimeMs ? ` · built in ${(item.buildTimeMs / 1000).toFixed(1)}s` : ""} ·{" "}
                  {relative(item.createdAt)}
                </p>
              </div>
              <Badge tone={item.kind === "DEMO" ? "accent" : "info"}>{item.kind.toLowerCase()}</Badge>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-3.5">
              {item.screenshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.screenshot}
                  alt={`${item.title} preview`}
                  className="h-32 w-full rounded-lg border border-line object-cover object-top"
                />
              ) : (
                <div className="grid h-32 place-items-center rounded-lg border border-dashed border-line text-ink-faint">
                  <Globe2 className="h-5 w-5" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-line/60 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-ink-faint">QA</p>
                  {item.qa ? (
                    <button type="button" onClick={() => setOpenQa(item)} className="mt-1 block">
                      <VerdictBadge verdict={item.qa.verdict} />
                    </button>
                  ) : (
                    <p className="mt-1 text-ink-faint">not run</p>
                  )}
                </div>
                <div className="rounded-lg border border-line/60 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-ink-faint">Deployment</p>
                  {item.deployment ? (
                    <div className="mt-1 flex flex-col gap-1">
                      <Badge tone={item.deployment.status === "LIVE" ? "success" : "warning"}>
                        {item.deployment.status.toLowerCase()}
                      </Badge>
                      {item.deployment.url && (
                        <a
                          href={item.deployment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-brand-300 hover:underline"
                        >
                          open
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-ink-faint">not deployed</p>
                  )}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                {item.previewUrl && (
                  <a href={item.previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </a>
                )}
                {item.productionUrl && (
                  <a href={item.productionUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="success">
                      <Rocket className="h-3.5 w-3.5" />
                      Live
                    </Button>
                  </a>
                )}
                {item.status !== "FAILED" && (
                  <>
                    <Button
                      size="sm"
                      loading={busyId === item.id}
                      onClick={() => act(item, "PREVIEW")}
                      disabled={item.status === "GENERATING" || item.status === "QUEUED"}
                    >
                      <Globe2 className="h-3.5 w-3.5" />
                      Deploy preview
                    </Button>
                    {item.kind === "DEMO" && (
                      <Button size="sm" variant="outline" loading={busyId === item.id} onClick={() => act(item, "PRODUCTION")}>
                        <Send className="h-3.5 w-3.5" />
                        Production
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={Boolean(openQa)}
        title={openQa ? `QA — ${openQa.title}` : "QA"}
        onClose={() => setOpenQa(null)}
      >
        {openQa?.qa && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <VerdictBadge verdict={openQa.qa.verdict} />
              <span className="tnum text-[12.5px] text-ink-muted">{openQa.qa.score}/100</span>
            </div>
            <ul className="space-y-1.5">
              {openQa.qa.checks.map((check, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  )}
                  <span className={check.passed ? "text-ink-muted" : "text-ink"}>
                    <span className="font-medium">{check.label}</span>
                    {check.detail && <span className="block text-[11px] text-ink-faint">{check.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-faint">Run {relative(openQa.qa.createdAt)}</p>
          </div>
        )}
      </Modal>
    </>
  );
}
