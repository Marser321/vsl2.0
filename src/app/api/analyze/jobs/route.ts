import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { analysisJobs } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";

const STALE_MS = 90_000;

/**
 * Últimos trabajos del analizador con su estado efectivo. Un trabajo
 * "processing" cuyo heartbeat quedó viejo se reporta como "interrupted":
 * el proceso murió sin poder marcarse como fallido.
 */
export async function GET(req: NextRequest) {
  const guard = await guardAdminRequest(req, false);
  if (guard) return guard;

  const rows = await getDb()
    .select({
      id: analysisJobs.id,
      title: analysisJobs.title,
      sourceUrl: analysisJobs.sourceUrl,
      status: analysisJobs.status,
      stage: analysisJobs.stage,
      documentId: analysisJobs.documentId,
      error: analysisJobs.error,
      heartbeatAt: analysisJobs.heartbeatAt,
      createdAt: analysisJobs.createdAt,
    })
    .from(analysisJobs)
    .orderBy(desc(analysisJobs.createdAt))
    .limit(10);

  const now = Date.now();
  const jobs = rows.map((row) => ({
    ...row,
    status:
      row.status === "processing" && now - new Date(row.heartbeatAt).getTime() > STALE_MS
        ? ("interrupted" as const)
        : row.status,
  }));

  return NextResponse.json(jobs);
}
