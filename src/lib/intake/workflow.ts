import type { IntakeStatus } from "@/db/schema";

export type IntakeAction = "start_review" | "request_changes" | "approve" | "revoke";

const allowed: Record<IntakeAction, IntakeStatus[]> = {
  start_review: ["submitted"],
  request_changes: ["in_review"],
  approve: ["in_review"],
  revoke: ["draft", "submitted", "in_review", "changes_requested"],
};

const target: Record<IntakeAction, IntakeStatus> = {
  start_review: "in_review",
  request_changes: "changes_requested",
  approve: "approved",
  revoke: "revoked",
};

export function transitionIntake(current: IntakeStatus, action: IntakeAction): IntakeStatus | null {
  return allowed[action].includes(current) ? target[action] : null;
}

export function isIntakeEditable(status: IntakeStatus) {
  return status === "draft" || status === "changes_requested";
}
