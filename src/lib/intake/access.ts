import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { intakeRequests, intakeSubmissions } from "@/db/schema";
import { getIntakeSession } from "@/lib/auth/session";

export function createAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashAccessToken(token) };
}

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requirePublicIntake(publicId: string) {
  const session = await getIntakeSession(publicId);
  if (!session) throw new Error("UNAUTHORIZED");
  const [request] = await getDb()
    .select()
    .from(intakeRequests)
    .where(and(eq(intakeRequests.id, session.requestId), eq(intakeRequests.publicId, publicId)))
    .limit(1);
  if (!request) throw new Error("NOT_FOUND");
  if (request.expiresAt.getTime() <= Date.now() && request.status !== "approved") {
    await getDb().update(intakeRequests).set({ status: "expired", updatedAt: new Date() }).where(eq(intakeRequests.id, request.id));
    throw new Error("EXPIRED");
  }
  if (["expired", "revoked"].includes(request.status)) throw new Error(request.status.toUpperCase());
  return request;
}

export async function getSubmission(requestId: string) {
  const [submission] = await getDb()
    .select()
    .from(intakeSubmissions)
    .where(eq(intakeSubmissions.requestId, requestId))
    .limit(1);
  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
  return submission;
}

export function publicIntakeError(error: unknown) {
  const message = (error as Error).message;
  if (message === "UNAUTHORIZED") return Response.json({ error: "El enlace debe validarse nuevamente." }, { status: 401 });
  if (message === "NOT_FOUND" || message === "SUBMISSION_NOT_FOUND") return Response.json({ error: "Relevamiento no encontrado." }, { status: 404 });
  if (message === "EXPIRED") return Response.json({ error: "El enlace venció." }, { status: 410 });
  if (message === "REVOKED") return Response.json({ error: "El enlace fue revocado." }, { status: 403 });
  if (message === "INVALID_ORIGIN") return Response.json({ error: "Origen inválido." }, { status: 403 });
  return Response.json({ error: "No se pudo acceder al relevamiento." }, { status: 500 });
}
