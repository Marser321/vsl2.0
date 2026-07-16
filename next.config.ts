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
  },
};

export default nextConfig;
