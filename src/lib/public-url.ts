type PublicUrlEnv = Pick<NodeJS.ProcessEnv,
  "NEXT_PUBLIC_APP_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "VERCEL_ENV" | "NODE_ENV"
>;

function normalizeCandidate(raw: string | undefined) {
  if (!raw?.trim()) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url;
}

function isLocalHost(hostname: string) {
  const value = hostname.toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1" || value.endsWith(".local");
}

export function resolvePublicAppUrl(args: {
  requestOrigin?: string;
  env?: PublicUrlEnv;
} = {}) {
  const env = args.env ?? process.env;
  const isProduction = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const configured = normalizeCandidate(env.NEXT_PUBLIC_APP_URL);
  const vercelProduction = normalizeCandidate(env.VERCEL_PROJECT_PRODUCTION_URL);
  const requestOrigin = normalizeCandidate(args.requestOrigin);
  const url = configured ?? vercelProduction ?? (!isProduction ? requestOrigin : null);

  if (!url) {
    throw new Error("Falta configurar NEXT_PUBLIC_APP_URL con el dominio público de producción.");
  }
  if (isProduction && (url.protocol !== "https:" || isLocalHost(url.hostname))) {
    throw new Error("NEXT_PUBLIC_APP_URL debe ser un dominio público HTTPS, no localhost.");
  }
  if (isProduction && env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
    throw new Error("Los relevamientos públicos solo pueden crearse desde el despliegue de producción.");
  }
  return url.origin;
}

export function publicUrlReadiness(requestOrigin?: string) {
  try {
    return { available: true as const, url: resolvePublicAppUrl({ requestOrigin }), error: null };
  } catch (error) {
    return { available: false as const, url: null, error: (error as Error).message };
  }
}
