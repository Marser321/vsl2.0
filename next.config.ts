import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes nativos / con workers propios que el bundler no debe procesar
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/analyze/import-social": [
      "./vendor/yt-dlp",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },
};

export default nextConfig;
