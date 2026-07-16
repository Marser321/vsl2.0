/** Estimación local de tokens (~4 chars/token) para documents.tokenCount. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
