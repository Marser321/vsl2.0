import { describe, expect, it } from "vitest";
import { parsePromotionTags, promotionScopeTag, promotionVersionTag } from "./promotions";

describe("promotion tags", () => {
  it("serializa y recupera versión y alcance", () => {
    const tags = ["promovido", promotionVersionTag(12), promotionScopeTag("global")];
    expect(parsePromotionTags(tags, "global")).toEqual({ versionId: 12, scope: "global", legacy: false });
  });

  it("mantiene compatibilidad con promociones anteriores", () => {
    expect(parsePromotionTags(["promovido"], "private")).toEqual({
      versionId: null,
      scope: "client",
      legacy: true,
    });
  });
});
