export function sanitizeAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "La operación de IA falló");
  return raw
    .replace(/\bsk-[A-Za-z0-9_*.-]{8,}/g, "[clave redactada]")
    .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[redactado]")
    .slice(0, 4_000);
}

/**
 * Traduce el error crudo del proveedor a un mensaje accionable en español.
 * Los mensajes que ya escribimos nosotros (empiezan en español) pasan tal cual.
 */
export function describeAiError(error: unknown): string {
  const detail = sanitizeAiError(error);
  const status = (error as { status?: number })?.status;

  if (status === 429 || /\b429\b|rate.?limit|too many requests|quota exceeded/i.test(detail)) {
    return `El proveedor de IA está saturado en este momento. Esperá un minuto y reintentá, o cambiá el proveedor por defecto en Configuración. (Detalle: ${detail})`;
  }
  if (status === 401 || status === 403 || /\b40[13]\b|invalid.*api key|unauthorized/i.test(detail)) {
    return `El proveedor de IA rechazó la clave configurada. Revisá las claves de API en la configuración del entorno. (Detalle: ${detail})`;
  }
  if (/timeout|timed out|aborted|fetch failed|econnreset|econnrefused|socket/i.test(detail)) {
    return `No se pudo contactar al proveedor de IA. Revisá la conexión y reintentá. (Detalle: ${detail})`;
  }
  if ((status && status >= 500) || /\b50[0-4]\b|overloaded|internal server error/i.test(detail)) {
    return `El proveedor de IA tuvo un error interno. Reintentá en unos minutos. (Detalle: ${detail})`;
  }
  return detail;
}
