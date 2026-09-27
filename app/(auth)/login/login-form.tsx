"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("owner@nexora.app");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"signin" | "signup" | "demo" | null>(null);

  const submit = async (kind: "signin" | "signup" | "demo") => {
    setError(null);
    setBusy(kind);
    try {
      const endpoint =
        kind === "demo" ? "/api/auth/demo" : kind === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          kind === "demo" ? {} : { email, password, fullName, organizationName },
        ),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; next?: string };
      if (!json.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(json.next ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel overflow-hidden p-5">
      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-surface-2/60 p-1">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              mode === m ? "bg-brand-600 text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(mode === "signup" ? "signup" : "signin");
        }}
      >
        {mode === "signup" && (
          <>
            <div>
              <Label htmlFor="fullName">Your name</Label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sajid Raza"
                  className="pl-8"
                  autoComplete="name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="org">Organisation name</Label>
              <div className="relative mt-1.5">
                <Sparkles className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                <Input
                  id="org"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Your agency"
                  className="pl-8"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              className="pl-8"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-8 pr-9"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint transition-colors hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {mode === "signup" && (
            <p className="mt-1.5 text-[11px] text-ink-faint">At least 8 characters.</p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] leading-relaxed text-red-300"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={busy === (mode === "signup" ? "signup" : "signin")}
        >
          {mode === "signup" ? "Create workspace" : "Sign in"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        loading={busy === "demo"}
        onClick={() => void submit("demo")}
      >
        <Sparkles className="h-4 w-4 text-accent-300" />
        Explore Demo Mode
      </Button>

      <div className="mt-4 rounded-lg border border-line bg-surface-2/40 p-3">
        <p className="text-[11px] font-semibold text-ink">First-run workspace</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          Sign in with <code className="rounded bg-surface-3 px-1 font-mono text-[10.5px] text-brand-200">owner@nexora.app</code> and
          password <code className="rounded bg-surface-3 px-1 font-mono text-[10.5px] text-brand-200">nexora</code>, or jump
          straight into a fully populated demo agency.
        </p>
      </div>
    </div>
  );
}

