import { describe, expect, it } from "vitest";
import { isIntakeEditable, transitionIntake } from "./workflow";

describe("intake workflow", () => {
  it("respeta revisión humana", () => {
    expect(transitionIntake("submitted", "start_review")).toBe("in_review");
    expect(transitionIntake("in_review", "approve")).toBe("approved");
    expect(transitionIntake("draft", "approve")).toBeNull();
  });
  it("solo permite editar borradores o cambios solicitados", () => {
    expect(isIntakeEditable("draft")).toBe(true);
    expect(isIntakeEditable("changes_requested")).toBe(true);
    expect(isIntakeEditable("in_review")).toBe(false);
  });
});
