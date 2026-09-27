import { publicHandler } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const POST = publicHandler(async () => {
  await clearSessionCookie();
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
});
