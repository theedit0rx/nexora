import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "./auth/session";
import { assertSameOrigin, HttpError, readJson } from "./security/http";
import { ZodError } from "zod";

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
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const ctx = await requireAuth();
      if ((opts.ownerOnly || req.method !== "GET") && ctx.session.role !== "OWNER" && ctx.session.role !== "ADMIN") {
        return fail("Only the workspace owner or an admin can perform this action.", 403);
      }
      const params = ((await segment?.params) ?? {}) as T;
      return await fn(ctx, req, params);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status);
      if (err instanceof ZodError) return fail("Invalid request data", 400);
      const message = err instanceof Error ? err.message : String(err);
      if (message === "UNAUTHENTICATED") return fail("Not authenticated", 401);
      if (message === "FORBIDDEN") return fail("Forbidden", 403);
      console.error("[nexora:api]", message);
      return fail("Request failed. Check the server logs or try again.", 500);
    }
  };
}

export async function readBody<T>(req: Request): Promise<T> {
  return await readJson(req) as T;
}

export function publicHandler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try { assertSameOrigin(req); return await fn(req); }
    catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status);
      console.error("[nexora:auth] request failed", err instanceof Error ? err.message : "unknown");
      return fail("Authentication could not be completed. Check server configuration.", 500);
    }
  };
}
