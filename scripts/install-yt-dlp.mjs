import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const assets = {
  darwin: "yt-dlp_macos",
  linux: "yt-dlp_linux",
  win32: "yt-dlp.exe",
};
const asset = assets[process.platform];
if (!asset) {
  console.warn(`[yt-dlp] Plataforma no soportada: ${process.platform}`);
  process.exit(0);
}

const directory = path.join(process.cwd(), "vendor");
const target = path.join(directory, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
const temp = `${target}.download`;
const minimumBytes = 5 * 1024 * 1024;

try {
  const header = await readFile(target).then((buffer) => buffer.subarray(0, 4));
  const matchesPlatform = process.platform === "linux"
    ? header.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) // ELF
    : process.platform === "win32"
      ? header.subarray(0, 2).equals(Buffer.from("MZ"))
      : [0xcafebabe, 0xbebafeca, 0xfeedfacf, 0xcffaedfe].includes(header.readUInt32BE(0));
  if (matchesPlatform && (await stat(target)).size >= minimumBytes) {
    await chmod(target, 0o755).catch(() => undefined);
    process.exit(0);
  }
} catch {
  // Todavía no está instalado.
}

await mkdir(directory, { recursive: true });
const version = process.env.YT_DLP_VERSION?.trim() || "latest";
const base = version === "latest"
  ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download"
  : `https://github.com/yt-dlp/yt-dlp/releases/download/${encodeURIComponent(version)}`;
const response = await fetch(`${base}/${asset}`, { redirect: "follow" });
if (!response.ok) throw new Error(`[yt-dlp] No se pudo descargar ${asset} (${response.status}).`);
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes.byteLength < minimumBytes) throw new Error("[yt-dlp] La descarga no parece un binario autónomo válido.");
await writeFile(temp, bytes);
await chmod(temp, 0o755);
await rm(target, { force: true });
await rename(temp, target);
console.log(`[yt-dlp] Binario ${asset} instalado (${Math.round(bytes.byteLength / 1024 / 1024)} MB).`);
