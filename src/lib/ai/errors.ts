export function sanitizeAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "La operación de IA falló");
  return raw
    .replace(/\bsk-[A-Za-z0-9_*.-]{8,}/g, "[clave redactada]")
    .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[redactado]")
    .slice(0, 4_000);
}
