import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes nativos / con workers propios que el bundler no debe procesar.
  // "postgres" (postgres.js) NO está en la lista externa por defecto de Next
  // (solo "pg"): bundleado por Turbopack, su pool corrompía los sockets bajo
  // concurrencia (write CONNECTION_DESTROYED, queries encoladas para siempre).
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth", "ffmpeg-static", "postgres"],
  outputFileTracingIncludes: {
    "/api/analyze/import-social": [
      "./vendor/yt-dlp",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
    // Las Geist se leen del filesystem al generar el PDF; sin declararlas acá
    // el file tracing de Next no las ve (la ruta se arma en runtime) y en
    // Vercel el archivo no existiría.
    "/api/scripts/[id]/pdf": ["./src/lib/pdf/fonts/*.ttf"],
  },
};

export default nextConfig;
