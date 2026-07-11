import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { scripts, clients } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { guardAdminRequest } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const clientId = req.nextUrl.searchParams.get("clientId");

  const db = getDb();
  const fields = {
    id: scripts.id,
    title: scripts.title,
    clientId: scripts.clientId,
    clientName: clients.name,
    status: scripts.status,
    outcome: scripts.outcome,
    format: scripts.format,
    provider: scripts.provider,
    model: scripts.model,
    createdAt: scripts.createdAt,
  };
  const rows = clientId
    ? await db
        .select(fields)
        .from(scripts)
        .leftJoin(clients, eq(scripts.clientId, clients.id))
        .where(eq(scripts.clientId, Number(clientId)))
        .orderBy(desc(scripts.createdAt))
    : await db
        .select(fields)
        .from(scripts)
        .leftJoin(clients, eq(scripts.clientId, clients.id))
        .orderBy(desc(scripts.createdAt));

  return NextResponse.json(rows);
}
