import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { intakeRequests } from "@/db/schema";
import { createIntakeSession } from "@/lib/auth/session";
import { hashAccessToken } from "@/lib/intake/access";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token.length > 200) return NextResponse.redirect(new URL("/relevamiento/invalido", req.url));
  const [request] = await getDb().select().from(intakeRequests).where(eq(intakeRequests.tokenHash, hashAccessToken(token))).limit(1);
  if (!request || request.status === "revoked") return NextResponse.redirect(new URL("/relevamiento/invalido", req.url));
  if (request.expiresAt.getTime() <= Date.now()) {
    await getDb().update(intakeRequests).set({ status: "expired", updatedAt: new Date() }).where(eq(intakeRequests.id, request.id));
    return NextResponse.redirect(new URL("/relevamiento/vencido", req.url));
  }
  await createIntakeSession(request.id, request.publicId, request.expiresAt);
  return NextResponse.redirect(new URL(`/relevamiento/${request.publicId}`, req.url));
}
