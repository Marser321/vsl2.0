import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes nativos / con workers propios que el bundler no debe procesar
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth"],
};

export default nextConfig;
