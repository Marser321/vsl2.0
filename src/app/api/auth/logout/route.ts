import { NextResponse } from "next/server";
import { assertSameOrigin, clearAdminSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  assertSameOrigin(req);
  await clearAdminSession();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
