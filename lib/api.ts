import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "./auth/session";

/* ==========================================================================
   NEXORA — API helpers
   ========================================================================== */

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Wrap a route handler with auth + error handling. */
export function handler<T extends Record<string, string> = Record<string, string>>(
  fn: (ctx: AuthContext, req: Request, params: T) => Promise<NextResponse>,
  opts: { ownerOnly?: boolean } = {},
) {
  // The second argument must stay non-optional and structurally identical to
  // Next's `RouteContext`, otherwise the build-time route type check rejects it.
  return async (req: Request, segment: { params: Promise<T> }) => {
    try {
      const ctx = await requireAuth();
      if ((opts.ownerOnly || req.method !== "GET") && ctx.session.role !== "OWNER" && ctx.session.role !== "ADMIN") {
        return fail("Only the workspace owner or an admin can perform this action.", 403);
      }
      const params = ((await segment?.params) ?? {}) as T;
      return await fn(ctx, req, params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "UNAUTHENTICATED") return fail("Not authenticated", 401);
      if (message === "FORBIDDEN") return fail("Forbidden", 403);
      console.error("[nexora:api]", message);
      return fail(message, 500);
    }
  };
}

export async function readBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
