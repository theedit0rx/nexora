import { isDemoMode } from "../db";

/* ==========================================================================
   NEXORA — Messaging / Deployment / Repository / Payment provider adapters
   --------------------------------------------------------------------------
   Every external service is behind a small interface. When credentials are
   missing the adapter reports `available: false` and the UI shows an honest
   "not connected" state instead of pretending an action happened.
   ========================================================================== */

/* ------------------------------------------------------------------ EMAIL -- */

export interface EmailMessage {
  to: string;
  subject: string;
  html?: string;
  text: string;
  replyTo?: string;
  inReplyToMessageId?: string;
  threadId?: string;
}

export interface EmailSendResult {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
  simulated?: boolean;
}

export interface EmailProvider {
  key: "resend" | "smtp" | "gmail" | "simulated" | "none";
  label: string;
  available: boolean;
  requiredEnv: string[];
  capabilities: string[];
  send(message: EmailMessage): Promise<EmailSendResult>;
  reply?(message: EmailMessage): Promise<EmailSendResult>;
}

class ResendProvider implements EmailProvider {
  key = "resend" as const;
  label = "Resend";
  available = Boolean(process.env.RESEND_API_KEY);
  requiredEnv = ["RESEND_API_KEY"];
  capabilities = ["send", "reply", "thread", "draft", "status", "suppression"];
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, provider: this.key, error: "RESEND_API_KEY not configured" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "NEXORA <onboarding@resend.dev>",
          to: [message.to],
          subject: message.subject,
          html: message.html ?? `<pre>${escapeHtml(message.text)}</pre>`,
          text: message.text,
          reply_to: message.replyTo,
          headers: message.inReplyToMessageId
            ? { "In-Reply-To": message.inReplyToMessageId }
            : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, provider: this.key, error: json.message ?? `HTTP ${res.status}` };
      return { ok: true, provider: this.key, providerMessageId: json.id };
    } catch (err) {
      return { ok: false, provider: this.key, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class SmtpProvider implements EmailProvider {
  key = "smtp" as const;
  label = "SMTP (fallback)";
  available = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  requiredEnv = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];
  capabilities = ["send"];
  async send(): Promise<EmailSendResult> {
    return {
      ok: false,
      provider: this.key,
      error:
        "SMTP sending is not wired in this build. Connect Resend or Gmail, or use the draft/copy workflow.",
      simulated: true,
    };
  }
}

class GmailProvider implements EmailProvider {
  key = "gmail" as const;
  label = "Gmail API";
  available = Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN);
  requiredEnv = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"];
  capabilities = ["send", "reply", "thread", "draft", "status"];
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
      return { ok: false, provider: this.key, error: "Gmail credentials not configured" };
    }
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return { ok: false, provider: this.key, error: "Could not obtain Gmail access token" };
      }
      const raw = [
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        message.inReplyToMessageId ? `In-Reply-To: ${message.inReplyToMessageId}` : "",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        message.text,
      ]
        .filter(Boolean)
        .join("\r\n");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          authorization: `Bearer ${tokenJson.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ raw: base64Url(raw) }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
      if (!res.ok) {
        return { ok: false, provider: this.key, error: json.error?.message ?? `HTTP ${res.status}` };
      }
      return { ok: true, provider: this.key, providerMessageId: json.id };
    } catch (err) {
      return { ok: false, provider: this.key, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

function base64Url(input: string) {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Demo-only adapter. Used when no real email credentials are configured and the
 * workspace is running in Demo Mode. It records the send locally instead of
 * talking to a live SMTP/API endpoint, and every result carries
 * `simulated: true` so the UI can label it honestly rather than implying mail
 * actually left the building.
 */
class SimulatedEmailProvider implements EmailProvider {
  key = "simulated" as const;
  label = "Simulated (Demo Mode)";
  available = true;
  requiredEnv: string[] = [];
  capabilities = ["send", "draft"];
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const id = `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    console.info(`[nexora:email:simulated] to=${message.to} subject="${message.subject}" id=${id}`);
    return { ok: true, provider: this.key, providerMessageId: id, simulated: true };
  }
}

export function getEmailProvider(): EmailProvider {
  const preferred = process.env.EMAIL_PROVIDER ?? "resend";
  const order: EmailProvider[] = [new ResendProvider(), new GmailProvider(), new SmtpProvider()];
  const chosen = order.find((p) => p.key === preferred) ?? order[0];
  if (chosen.available) return chosen;
  const real = order.find((p) => p.available);
  if (real) return real;
  // No credentials anywhere. In Demo Mode fall back to the simulated adapter so
  // the outreach -> reply -> proposal flow stays explorable; in Live Mode stay
  // unavailable and let the caller surface the honest error.
  return isDemoMode() ? new SimulatedEmailProvider() : chosen;
}

/* --------------------------------------------------------------- WHATSAPP -- */

export interface WhatsAppMessage {
  to: string;
  body: string;
}

export interface WhatsAppProvider {
  key: "cloud_api" | "unavailable";
  label: string;
  available: boolean;
  requiredEnv: string[];
  capabilities: string[];
  send(message: WhatsAppMessage): Promise<EmailSendResult>;
}

export class WhatsAppCloudProvider implements WhatsAppProvider {
  key = "cloud_api" as const;
  label = "WhatsApp Business Cloud API";
  available = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  requiredEnv = ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"];
  capabilities = ["send", "template", "status"];
  async send(message: WhatsAppMessage): Promise<EmailSendResult> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return { ok: false, provider: this.key, error: "WhatsApp Cloud API not configured" };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to.replace(/[^\d]/g, ""),
          type: "text",
          text: { preview_url: true, body: message.body },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
      if (!res.ok) {
        return { ok: false, provider: this.key, error: json.error?.message ?? `HTTP ${res.status}` };
      }
      return { ok: true, provider: this.key, providerMessageId: json.messages?.[0]?.id };
    } catch (err) {
      return { ok: false, provider: this.key, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class WhatsAppUnavailableProvider implements WhatsAppProvider {
  key = "unavailable" as const;
  label = "Not connected";
  available = false;
  requiredEnv = ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"];
  capabilities = ["copy message", "mark as sent", "log response"];
  async send(): Promise<EmailSendResult> {
    return {
      ok: false,
      provider: this.key,
      error:
        "WhatsApp is not connected. NEXORA never uses unofficial automation — connect the WhatsApp Business Cloud API to enable sending. Until then you can copy the message, mark it as sent and log the reply.",
      simulated: true,
    };
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const cloud = new WhatsAppCloudProvider();
  return cloud.available ? cloud : new WhatsAppUnavailableProvider();
}

/* ---------------------------------------------------------------- GITHUB -- */

export interface RepositoryProvider {
  key: "github" | "unavailable";
  label: string;
  available: boolean;
  requiredEnv: string[];
  capabilities: string[];
  createRepository(name: string, description: string, isPrivate: boolean): Promise<{
    ok: boolean;
    url?: string;
    error?: string;
  }>;
  pushFiles(
    repo: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<{ ok: boolean; commitSha?: string; error?: string }>;
}

class GitHubProvider implements RepositoryProvider {
  key = "github" as const;
  label = "GitHub";
  available = Boolean(process.env.GITHUB_TOKEN);
  requiredEnv = ["GITHUB_TOKEN"];
  capabilities = ["create repository", "push generated site", "branches", "commits", "project mapping"];

  private async api(path: string, init?: RequestInit) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw new Error(json.message ?? `GitHub API ${res.status}`);
    return json;
  }

  async createRepository(name: string, description: string, isPrivate: boolean) {
    if (!this.available) return { ok: false, error: "GITHUB_TOKEN not configured" };
    try {
      const org = process.env.GITHUB_ORG;
      const path = org ? `/orgs/${org}/repos` : "/user/repos";
      const json = await this.api(path, {
        method: "POST",
        body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
      });
      return { ok: true, url: String(json.html_url ?? "") };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async pushFiles(repo: string, files: Array<{ path: string; content: string }>, message: string) {
    if (!this.available) return { ok: false, error: "GITHUB_TOKEN not configured" };
    try {
      const owner = repo.split("/")[0];
      const name = repo.split("/")[1];
      const ref = (await this.api(`/repos/${owner}/${name}/git/ref/heads/main`)) as { object?: { sha?: string } };
      const baseSha = ref.object?.sha;
      const baseCommit = baseSha
        ? ((await this.api(`/repos/${owner}/${name}/git/commits/${baseSha}`)) as { tree?: { sha?: string } })
        : null;
      const tree = await this.api(`/repos/${owner}/${name}/git/trees`, {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseCommit?.tree?.sha,
          tree: files.map((f) => ({
            path: f.path,
            mode: "100644",
            type: "blob",
            content: f.content,
          })),
        }),
      });
      const commit = await this.api(`/repos/${owner}/${name}/git/commits`, {
        method: "POST",
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: baseSha ? [baseSha] : [],
        }),
      });
      await this.api(`/repos/${owner}/${name}/git/refs/heads/main`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      return { ok: true, commitSha: String(commit.sha ?? "") };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class RepositoryUnavailable implements RepositoryProvider {
  key = "unavailable" as const;
  label = "Not connected";
  available = false;
  requiredEnv = ["GITHUB_TOKEN"];
  capabilities = [];
  async createRepository() {
    return { ok: false, error: "GitHub is not connected. Add GITHUB_TOKEN to enable repository creation." };
  }
  async pushFiles() {
    return { ok: false, error: "GitHub is not connected. Add GITHUB_TOKEN to enable pushing generated sites." };
  }
}

export function getRepositoryProvider(): RepositoryProvider {
  const gh = new GitHubProvider();
  return gh.available ? gh : new RepositoryUnavailable();
}

/* --------------------------------------------------------------- VERCEL -- */

export interface DeploymentProvider {
  key: "vercel" | "local" | "unavailable";
  label: string;
  available: boolean;
  requiredEnv: string[];
  capabilities: string[];
  deploy(input: {
    name: string;
    kind: "PREVIEW" | "PRODUCTION";
    files: Array<{ path: string; content: string }>;
    branch?: string;
    target?: string | null;
  }): Promise<{ ok: boolean; url?: string; ref?: string; state?: string; error?: string }>;
}

class VercelProvider implements DeploymentProvider {
  key = "vercel" as const;
  label = "Vercel";
  available = Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
  requiredEnv = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"];
  capabilities = ["preview deployment", "production deployment", "deployment status", "project URL", "error logs"];

  async deploy(input: {
    name: string;
    kind: "PREVIEW" | "PRODUCTION";
    files: Array<{ path: string; content: string }>;
    target?: string | null;
  }) {
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!token || !projectId) {
      return { ok: false, error: "Vercel is not connected. Add VERCEL_TOKEN and VERCEL_PROJECT_ID." };
    }
    try {
      const teamId = process.env.VERCEL_TEAM_ID;
      const url = new URL("https://api.vercel.com/v13/deployments");
      if (teamId) url.searchParams.set("teamId", teamId);
      const res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          project: projectId,
          target: input.kind === "PRODUCTION" ? "production" : undefined,
          gitSource: undefined,
          files: input.files.map((f) => ({
            file: f.path,
            data: f.content,
            encoding: "utf-8",
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) {
        return { ok: false, error: json.error?.message ?? `Vercel API ${res.status}` };
      }
      return {
        ok: true,
        url: `https://${String(json.url ?? "")}`,
        ref: String(json.id ?? ""),
        state: String(json.readyState ?? "QUEUED"),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class LocalDeploymentProvider implements DeploymentProvider {
  key = "local" as const;
  label = "Local preview server";
  available = true;
  requiredEnv: string[] = [];
  capabilities = ["preview deployment", "deployment URL", "deployment history"];
  async deploy(input: { name: string; kind: "PREVIEW" | "PRODUCTION"; files: Array<{ path: string }> }) {
    if (input.kind === "PRODUCTION") return { ok: false, error: "Local previews cannot be production deployments." };
    return {
      ok: true,
      url: `/generated/${input.name}/index.html`,
      ref: `local_${Date.now().toString(36)}`,
      state: "READY",
    };
  }
}

class DeploymentUnavailable implements DeploymentProvider {
  key = "unavailable" as const;
  label = "Not connected";
  available = false;
  requiredEnv = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"];
  capabilities = [];
  async deploy() {
    return { ok: false, error: "Vercel is not connected. Add VERCEL_TOKEN and VERCEL_PROJECT_ID." };
  }
}

export function getDeploymentProvider(kind: "PREVIEW" | "PRODUCTION" = "PREVIEW"): DeploymentProvider {
  if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) return new VercelProvider();
  return kind === "PRODUCTION" ? new DeploymentUnavailable() : new LocalDeploymentProvider();
}

/* -------------------------------------------------------------- PAYMENTS -- */

export interface PaymentProvider {
  key: "stripe" | "unavailable";
  label: string;
  available: boolean;
  requiredEnv: string[];
  capabilities: string[];
}

export function getPaymentProvider(): PaymentProvider {
  const ok = Boolean(process.env.PAYMENT_PROVIDER_SECRET || process.env.STRIPE_SECRET_KEY);
  return {
    key: ok ? "stripe" : "unavailable",
    label: ok ? "Stripe" : "Not connected",
    available: ok,
    requiredEnv: ["PAYMENT_PROVIDER_SECRET", "STRIPE_SECRET_KEY"],
    capabilities: ["invoices", "payment events", "webhooks", "revenue tracking"],
  };
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
