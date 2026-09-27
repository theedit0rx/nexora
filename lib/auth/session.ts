import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../db";
import { hashPassword, verifyPassword } from "../bootstrap";
import type { Organization, User } from "../db/schema";

/* ==========================================================================
   NEXORA — Authentication & session
   --------------------------------------------------------------------------
   Two modes:
     • Local  — NEXORA's own user table + signed httpOnly JWT cookie.
     • Supabase — Supabase Auth (email/password) when configured.
   Server-side permission checks are always authoritative; the browser is
   never trusted for role decisions.
   ========================================================================== */

const COOKIE = "nexora_session";
const secret = () => {
  const value = process.env.NEXORA_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("NEXORA_SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
};

export interface Session {
  userId: string;
  organizationId: string;
  email: string;
  role: User["role"];
  isDemo: boolean;
}

export async function createSession(user: User): Promise<string> {
  return new SignJWT({
    sub: user.id,
    org: user.organizationId,
    email: user.email,
    role: user.role,
    demo: user.isDemo,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.sub),
      organizationId: String(payload.org),
      email: String(payload.email),
      role: (payload.role as User["role"]) ?? "MEMBER",
      isDemo: Boolean(payload.demo),
    };
  } catch {
    return null;
  }
}

/** Issue a cookie directly from an existing Session (used after login). */
export async function createSessionFrom(session: Session): Promise<string> {
  return new SignJWT({
    sub: session.userId,
    org: session.organizationId,
    email: session.email,
    role: session.role,
    demo: session.isDemo,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value;
}

/** Current session, or null. */
export async function getSession(): Promise<Session | null> {
  return readSession(await getSessionToken());
}

export interface AuthContext {
  session: Session;
  user: User;
  organization: Organization;
}

/** Resolve the authenticated context. Throws when unauthenticated. */
export async function requireAuth(): Promise<AuthContext> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  const user = await db.byId("users", session.userId);
  if (!user) throw new Error("UNAUTHENTICATED");
  const organization = await db.byId("organizations", session.organizationId);
  if (!organization) throw new Error("UNAUTHENTICATED");
  const member = await db.findOne("organization_members", { userId: user.id, organizationId: organization.id });
  if (user.organizationId !== organization.id || !member || member.role !== user.role) {
    throw new Error("UNAUTHENTICATED");
  }
  return { session: { ...session, role: member.role, isDemo: user.isDemo }, user, organization };
}

export type LoginResult =
  | { ok: true; session: Session }
  | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return { ok: false, error: "Email and password are required." };

  // Supabase Auth path
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const { createSupabaseBrowser } = await import("../db/supabase-adapter");
      const client = createSupabaseBrowser();
      if (client) {
        const { data, error } = await client.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (error || !data.user) {
          return { ok: false, error: error?.message ?? "Invalid credentials." };
        }
        const localUser = await db.findOne("users", { email: normalized });
        if (localUser) {
          const session = await readSession(
            await createSession(localUser),
          );
          if (session) return { ok: true, session };
        }
      }
    } catch (err) {
      console.error("[nexora:auth] supabase login failed", err);
    }
    return { ok: false, error: "Authentication provider unavailable or account not provisioned." };
  }

  const user = await db.findOne("users", { email: normalized });
  if (!user || !user.passwordHash) {
    return { ok: false, error: "No account found for that email address." };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, error: "Incorrect password. Please try again." };

  await db.update("users", user.id, { lastLoginAt: new Date().toISOString() });
  return {
    ok: true,
    session: {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
      isDemo: user.isDemo,
    },
  };
}

/** Sign in to the demo workspace. */
export async function loginDemo(): Promise<LoginResult> {
  const { ensureDemoOrganization, seedDemoData } = await import("../bootstrap");
  const org = await ensureDemoOrganization();
  const existing = await db.count("leads", { organizationId: org.id });
  if (existing === 0) {
    await seedDemoData(org.id);
  }
  const user = await db.findOne("users", { email: "owner@nexora.demo" });
  if (!user) return { ok: false, error: "Demo workspace could not be created." };
  await db.update("users", user.id, { lastLoginAt: new Date().toISOString() });
  return {
    ok: true,
    session: {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      role: "OWNER",
      isDemo: true,
    },
  };
}

export async function signup(input: {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
}): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!input.fullName.trim()) return { ok: false, error: "Enter your name." };

  const existing = await db.findOne("users", { email });
  if (existing) return { ok: false, error: "An account already exists for that email." };

  if (!input.organizationName.trim()) return { ok: false, error: "Enter your agency name." };
  const { newId, slugify } = await import("../db");
  const { nowIso } = await import("../db/schema");
  const org = await db.insert("organizations", {
    id: newId("org"), name: input.organizationName.trim(),
    slug: `${slugify(input.organizationName)}-${crypto.randomUUID().slice(0, 8)}`,
    ownerName: input.fullName.trim(), ownerEmail: email,
    logoUrl: null, brandColor: "#6366f1", accentColor: "#22d3ee",
    tagline: "Find. Build. Sell. Deliver. Automatically.",
    currency: "INR", timezone: "Asia/Kolkata", mode: "LIVE",
    createdAt: nowIso(), updatedAt: nowIso(),
  });
  const user = await db.insert("users", {
    id: `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    organizationId: org.id,
    email,
    fullName: input.fullName.trim(),
    role: "OWNER",
    avatarUrl: null,
    passwordHash: await hashPassword(input.password),
    isDemo: false,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  await db.insert("organization_members", {
    id: `om_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    organizationId: org.id,
    userId: user.id,
    role: "OWNER",
    createdAt: new Date().toISOString(),
  });
  const { defaultSettings, ensureServicesAndPricing, ensureIntegrations } = await import("../bootstrap");
  const { ensureAgentRegistry } = await import("../agents/registry");
  await defaultSettings(org.id);
  await ensureServicesAndPricing(org.id);
  await ensureIntegrations(org.id);
  await ensureAgentRegistry(org.id);
  return {
    ok: true,
    session: {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      role: user.role,
      isDemo: false,
    },
  };
}

/** Owner-only guard used by every mutating API route. */
export function assertOwner(ctx: AuthContext) {
  if (ctx.session.role !== "OWNER" && ctx.session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

export { hashPassword };
