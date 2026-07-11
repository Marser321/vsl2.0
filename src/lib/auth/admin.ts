import argon2 from "argon2";
import { and, count, eq, gte } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export function loginFingerprint(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const agent = req.headers.get("user-agent") ?? "unknown";
  const salt = process.env.AUTH_RATE_LIMIT_SALT ?? process.env.SESSION_SECRET ?? "vsl";
  return createHash("sha256").update(`${salt}:${ip}:${agent}`).digest("hex");
}

export async function assertLoginAllowed(fingerprint: string) {
  const [row] = await getDb()
    .select({ total: count() })
    .from(loginAttempts)
    .where(and(
      eq(loginAttempts.fingerprint, fingerprint),
      eq(loginAttempts.success, false),
      gte(loginAttempts.attemptedAt, new Date(Date.now() - WINDOW_MS))
    ));
  if (Number(row?.total ?? 0) >= MAX_FAILURES) throw new Error("RATE_LIMITED");
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return argon2.verify(hash, password);
  if (process.env.NODE_ENV !== "production" && process.env.ADMIN_PASSWORD) {
    return password === process.env.ADMIN_PASSWORD;
  }
  throw new Error("Falta ADMIN_PASSWORD_HASH.");
}

export async function recordLogin(fingerprint: string, success: boolean) {
  await getDb().insert(loginAttempts).values({ fingerprint, success });
}
