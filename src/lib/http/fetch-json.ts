export class FetchJsonError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "FetchJsonError";
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data?.error === "string" ? data.error : `La solicitud falló (${response.status})`;
      throw new FetchJsonError(message, response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof FetchJsonError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new FetchJsonError("La respuesta tardó demasiado. Revisá la conexión y reintentá.");
    }
    throw new FetchJsonError("No se pudo conectar con el servidor. Reintentá en unos segundos.");
  } finally {
    clearTimeout(timeout);
  }
}
