import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { extractPublicUrl } from "./url";
import { transcribeAudioChunks, transcriptionErrorMessage } from "./transcription";
import { getSupabaseAdmin, ANALYSIS_BUCKET } from "@/lib/supabase";

const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_DURATION_SECONDS = 7 * 60;
const PROCESS_TIMEOUT_MS = 4 * 60 * 1000;
const YT_DLP_PATH = process.env.YT_DLP_PATH || path.join(process.cwd(), "vendor", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

export type SocialPlatform = "youtube" | "instagram" | "tiktok";
export type SocialStage = "validando" | "obteniendo_subtitulos" | "descargando_audio" | "transcribiendo";
export type SocialProgress = (stage: SocialStage, detail?: string) => void;

export function classifySocialUrl(raw: string): { url: URL; platform: SocialPlatform } {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("La URL social debe usar HTTP o HTTPS y no incluir credenciales.");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const platform = host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")
    ? "youtube"
    : host === "instagram.com" || host.endsWith(".instagram.com")
      ? "instagram"
      : host === "tiktok.com" || host.endsWith(".tiktok.com")
        ? "tiktok"
        : null;
  if (!platform) throw new Error("Solo se admiten URLs públicas de YouTube, Instagram o TikTok.");
  return { url, platform };
}

export function buildYtDlpArgs(url: string, outputTemplate: string) {
  const args = [
    url,
    "--ignore-config",
    "--js-runtimes", "node",
    "--no-playlist",
    "--no-progress",
    "--no-warnings",
    "--no-part",
    "--socket-timeout", "20",
    "--retries", "2",
    "--max-filesize", "100M",
    "--match-filter", `duration <= ${MAX_DURATION_SECONDS} & !is_live`,
    "--format", "bestaudio/best",
    "--output", outputTemplate,
    "--print-json",
  ];
  if (ffmpegPath) args.push("--ffmpeg-location", ffmpegPath);
  return args;
}

export function buildYtDlpSubtitleArgs(url: string, outputTemplate: string) {
  return [
    url,
    "--ignore-config",
    "--js-runtimes", "node",
    "--no-playlist",
    "--no-progress",
    "--no-warnings",
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs", "es.*,es,en.*,en",
    "--sub-format", "vtt",
    "--socket-timeout", "20",
    "--retries", "2",
    "--match-filter", `duration <= ${MAX_DURATION_SECONDS} & !is_live`,
    "--output", outputTemplate,
    "--print-json",
  ];
}

function runProcess(binary: string, args: string[], timeoutMs = PROCESS_TIMEOUT_MS) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("La descarga o conversión superó el tiempo permitido."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += String(chunk).slice(0, 1_000_000); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 100_000); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(safeProcessError(stderr, code)));
    });
  });
}

function safeProcessError(stderr: string, code: number | null) {
  const lower = stderr.toLowerCase();
  if (lower.includes("login") || lower.includes("cookies")) {
    return "La plataforma exige iniciar sesión. Subí el video o audio para continuar.";
  }
  if (lower.includes("private") || lower.includes("unavailable")) {
    return "El video no es público o no está disponible. Subí el archivo para continuar.";
  }
  if (lower.includes("larger than max-filesize") || lower.includes("duration")) {
    return "El video supera el límite de 7 minutos o 100 MB.";
  }
  return `No se pudo descargar el audio social (código ${code ?? "desconocido"}). Subí el archivo para continuar.`;
}

async function segmentAudio(input: string, directory: string) {
  if (!ffmpegPath) throw new Error("FFmpeg no está incluido en este despliegue. Subí un transcript manualmente.");
  const output = path.join(directory, "chunk-%03d.mp3");
  await runProcess(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-vn", "-ac", "1", "-b:a", "64k",
    "-f", "segment", "-segment_time", "180", "-reset_timestamps", "1", output,
  ]);
  return (await readdir(directory))
    .filter((name) => /^chunk-\d+\.mp3$/.test(name))
    .sort()
    .map((name) => path.join(directory, name));
}

export function parseFfmpegProgressDuration(raw: string) {
  const matches = [...raw.matchAll(/^out_time_us=(\d+)$/gm)];
  const microseconds = Number(matches.at(-1)?.[1] || 0);
  return Number.isFinite(microseconds) ? microseconds / 1_000_000 : 0;
}

async function assertAudioDuration(input: string) {
  if (!ffmpegPath) throw new Error("FFmpeg no está incluido en este despliegue. Subí un transcript manualmente.");
  const result = await runProcess(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-i", input,
    "-map", "0:a:0", "-c", "copy", "-f", "null", "-",
    "-progress", "pipe:1", "-nostats",
  ], 30_000);
  const duration = parseFfmpegProgressDuration(result.stdout);
  if (duration > MAX_DURATION_SECONDS + 1) throw new Error("El video o audio supera el límite de 7 minutos.");
}

export function parseVttTranscript(raw: string) {
  const parts: string[] = [];
  let previous = "";
  for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "WEBVTT" || trimmed.startsWith("NOTE") || trimmed.includes("-->")) continue;
    if (/^\d+$/.test(trimmed) || /^(Kind|Language):/i.test(trimmed)) continue;
    const clean = trimmed
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    if (!clean || clean === previous) continue;
    parts.push(clean);
    previous = clean;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function downloadedCaptions(directory: string, rawUrl: string) {
  const outputTemplate = path.join(directory, "captions.%(ext)s");
  let result: { stdout: string; stderr: string };
  try {
    result = await runProcess(YT_DLP_PATH, buildYtDlpSubtitleArgs(rawUrl, outputTemplate), 60_000);
  } catch {
    return null;
  }
  const captions = (await readdir(directory))
    .filter((name) => name.startsWith("captions.") && name.endsWith(".vtt"))
    .sort((left, right) => Number(!left.includes(".es")) - Number(!right.includes(".es")));
  for (const caption of captions) {
    const text = parseVttTranscript(await readFile(path.join(directory, caption), "utf8"));
    if (text.length >= 100) {
      const lines = result.stdout.trim().split("\n").filter(Boolean);
      let metadata: Record<string, unknown> = {};
      try {
        metadata = JSON.parse(lines.at(-1) || "{}") as Record<string, unknown>;
      } catch {
        metadata = {};
      }
      return { text, metadata };
    }
  }
  return null;
}

async function downloadedInput(directory: string, rawUrl: string) {
  const outputTemplate = path.join(directory, "source.%(ext)s");
  let result: { stdout: string; stderr: string };
  try {
    result = await runProcess(YT_DLP_PATH, buildYtDlpArgs(rawUrl, outputTemplate));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("yt-dlp no está incluido en este despliegue. Subí el video o audio para continuar.");
    }
    throw error;
  }
  const files = (await readdir(directory)).filter((name) => name.startsWith("source."));
  if (files.length !== 1) throw new Error("La descarga no produjo un archivo de audio utilizable.");
  const input = path.join(directory, files[0]);
  if ((await stat(input)).size > MAX_SOURCE_BYTES) throw new Error("El video supera el límite de 100 MB.");
  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const metadata = JSON.parse(lines.at(-1) || "{}") as Record<string, unknown>;
  return { input, metadata };
}

async function storageInput(directory: string, storagePath: string) {
  if (!/^analysis\/[a-f0-9-]+\/[\w.-]+$/i.test(storagePath)) throw new Error("Ruta de upload inválida.");
  const { data, error } = await getSupabaseAdmin().storage.from(ANALYSIS_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message || "No se pudo descargar el upload privado.");
  if (data.size > MAX_SOURCE_BYTES) throw new Error("El archivo supera el límite de 100 MB.");
  const input = path.join(directory, "source-upload");
  await writeFile(input, Buffer.from(await data.arrayBuffer()));
  return input;
}

export async function extractSocialTranscript(input: {
  url?: string;
  storagePath?: string;
  onProgress?: SocialProgress;
}) {
  input.onProgress?.("validando");
  let platform: SocialPlatform | "upload";
  let sourceUrl: string | null = null;
  let title = "Referencia subida";
  let metadata: Record<string, unknown> = {};
  let cleanupStoragePath: string | null = null;

  if (input.url) {
    const classified = classifySocialUrl(input.url);
    platform = classified.platform;
    sourceUrl = classified.url.toString();
    if (platform === "youtube") {
      input.onProgress?.("obteniendo_subtitulos");
      const publicResult = await extractPublicUrl(sourceUrl).catch(() => null);
      const transcript = publicResult?.text.match(/(?:^|\n\n)Transcript:\s*([\s\S]+)/)?.[1]?.trim();
      if (transcript && transcript.length >= 100) {
        return {
          title: publicResult?.title || title,
          text: transcript,
          platform,
          sourceUrl,
          metadata: { ...publicResult?.metadata, method: "public_captions" },
          transcriptionModel: null,
          transcriptionProvider: "public_captions",
        };
      }
    }
  } else if (input.storagePath) {
    platform = "upload";
    cleanupStoragePath = input.storagePath;
  } else {
    throw new Error("Ingresá una URL social o subí un archivo.");
  }

  const directory = await mkdtemp(path.join(tmpdir(), "vsl-social-"));
  try {
    if (sourceUrl && platform === "youtube") {
      const captions = await downloadedCaptions(directory, sourceUrl);
      if (captions) {
        return {
          title: String(captions.metadata.title || title),
          text: captions.text,
          platform,
          sourceUrl,
          metadata: { ...captions.metadata, method: "yt_dlp_captions" },
          transcriptionModel: null,
          transcriptionProvider: "public_captions",
        };
      }
    }
    let mediaInput: string;
    if (sourceUrl) {
      input.onProgress?.("descargando_audio");
      const downloaded = await downloadedInput(directory, sourceUrl);
      mediaInput = downloaded.input;
      metadata = downloaded.metadata;
      title = String(metadata.title || title);
    } else {
      mediaInput = await storageInput(directory, input.storagePath!);
    }
    await assertAudioDuration(mediaInput);
    input.onProgress?.("transcribiendo");
    const chunks = await segmentAudio(mediaInput, directory);
    if (!chunks.length) throw new Error("No se pudo extraer audio del video.");
    const transcript = await transcribeAudioChunks(chunks);
    return {
      title,
      text: transcript.text,
      platform,
      sourceUrl,
      metadata: { ...metadata, method: "audio_transcription", chunks: transcript.chunks },
      transcriptionModel: transcript.model,
      transcriptionProvider: transcript.provider,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
    if (cleanupStoragePath) {
      await getSupabaseAdmin().storage.from(ANALYSIS_BUCKET).remove([cleanupStoragePath]).catch(() => undefined);
    }
  }
}

export const SOCIAL_LIMITS = { maxSourceBytes: MAX_SOURCE_BYTES, maxDurationSeconds: MAX_DURATION_SECONDS };

export function socialImportErrorMessage(error: unknown) {
  return transcriptionErrorMessage(error);
}
