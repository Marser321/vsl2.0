import type { ScriptStatus } from "@/db/schema";

export const GENERATION_STALE_MS = 90_000;

export function effectiveScriptStatus(
  status: ScriptStatus,
  heartbeat: Date | string | null,
  now = Date.now()
): ScriptStatus {
  if (status !== "generating") return status;
  const heartbeatMs = heartbeat ? new Date(heartbeat).getTime() : 0;
  return heartbeatMs && now - heartbeatMs <= GENERATION_STALE_MS ? status : "interrupted";
}
