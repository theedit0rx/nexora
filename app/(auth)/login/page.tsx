import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[-18%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-600/18 blur-[120px]" />
        <div className="absolute bottom-[-22%] right-[-8%] h-[420px] w-[520px] rounded-full bg-accent-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
              <path d="M4 18 12 4l8 14h-4.6L12 10.8 8.6 18z" />
            </svg>
          </span>
          <h1 className="mt-4 text-[26px] font-bold tracking-tight text-ink-strong">NEXORA</h1>
          <p className="mt-1 text-[12.5px] font-medium uppercase tracking-[0.2em] text-ink-faint">
            Autonomous Digital Agency OS
          </p>
          <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
            Find. Build. Sell. Deliver. Automatically.
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-faint">
          NEXORA runs entirely in Demo Mode without any API keys. Connect Supabase, an AI provider,
          lead sources, email, GitHub and Vercel from Settings when you&apos;re ready.
        </p>
      </div>
    </main>
  );
}
