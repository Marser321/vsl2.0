export type PromotionScope = "client" | "global";

const VERSION_PREFIX = "source-version-";
const SCOPE_PREFIX = "scope-";

export function promotionVersionTag(versionId: number) {
  return `${VERSION_PREFIX}${versionId}`;
}

export function promotionScopeTag(scope: PromotionScope) {
  return `${SCOPE_PREFIX}${scope}`;
}

export function parsePromotionTags(
  tags: string[],
  visibility: string
): { versionId: number | null; scope: PromotionScope; legacy: boolean } {
  const versionTag = tags.find((tag) => tag.startsWith(VERSION_PREFIX));
  const rawVersionId = versionTag ? Number(versionTag.slice(VERSION_PREFIX.length)) : NaN;
  const versionId = Number.isInteger(rawVersionId) && rawVersionId > 0 ? rawVersionId : null;
  const taggedScope = tags.find((tag) => tag.startsWith(SCOPE_PREFIX))?.slice(SCOPE_PREFIX.length);
  const scope: PromotionScope = taggedScope === "global" || visibility === "global" ? "global" : "client";
  return { versionId, scope, legacy: versionId === null };
}
