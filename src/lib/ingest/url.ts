import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;

function isPrivateIp(address: string) {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      parts[0] >= 224;
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Solo se permiten URLs HTTP o HTTPS.");
  if (url.username || url.password) throw new Error("La URL no puede incluir credenciales.");
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("La URL apunta a una red privada o no resoluble.");
  return url;
}

export async function fetchLimited(raw: string, redirect = 0): Promise<{ response: Response; bytes: Uint8Array; finalUrl: string }> {
  const url = await assertPublicUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "VSL-Studio-ContextBot/1.0", Accept: "text/html,text/plain,application/json,application/pdf;q=0.8" },
    });
  } finally {
    clearTimeout(timer);
  }
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirect >= MAX_REDIRECTS) throw new Error("Demasiadas redirecciones.");
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirección sin destino.");
    return fetchLimited(new URL(location, url).toString(), redirect + 1);
  }
  if (!response.ok) throw new Error(`La fuente respondió ${response.status}.`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new Error("La página supera el límite de 2 MB para extracción web.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("La fuente no entregó contenido.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("La página supera el límite de 2 MB para extracción web.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { response, bytes, finalUrl: url.toString() };
}

function readJsonArrayAfter(source: string, marker: string): unknown[] | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = source.indexOf("[", markerIndex + marker.length);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(source.slice(start, index + 1));
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function captionText(bytes: Uint8Array, contentType: string) {
  const raw = new TextDecoder().decode(bytes);
  if (contentType === "application/json" || raw.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> };
      return (parsed.events ?? []).flatMap((event) => event.segs ?? []).map((segment) => segment.utf8 ?? "").join(" ").replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }
  const $ = load(raw, { xmlMode: true });
  return $("text, p").map((_, element) => $(element).text()).get().join(" ").replace(/\s+/g, " ").trim();
}

async function extractVideoTranscript(rawHtml: string, host: string) {
  const marker = host.includes("youtube") || host === "youtu.be" ? '"captionTracks":' : '"text_tracks":';
  const tracks = readJsonArrayAfter(rawHtml, marker) as Array<Record<string, unknown>> | null;
  if (!tracks?.length) return null;
  const preferred = tracks.find((track) => track.languageCode === "es" || track.lang === "es") ?? tracks[0];
  const rawUrl = preferred.baseUrl ?? preferred.url;
  if (typeof rawUrl !== "string") return null;
  const { response, bytes } = await fetchLimited(rawUrl.replace(/\\u0026/g, "&"));
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "text/xml";
  const text = captionText(bytes, contentType);
  if (!text) return null;
  return {
    text: text.slice(0, 200_000),
    language: String(preferred.languageCode ?? preferred.lang ?? "desconocido"),
    trackKind: String(preferred.kind ?? "public"),
  };
}

export async function extractPublicUrl(raw: string) {
  const { response, bytes, finalUrl } = await fetchLimited(raw);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";
  if (contentType === "application/pdf") return { title: new URL(finalUrl).hostname, text: "", finalUrl, contentType, needsInput: true, metadata: { reason: "PDF remoto: adjuntalo como archivo para extraerlo." } };
  if (!contentType.startsWith("text/") && contentType !== "application/json") throw new Error(`Tipo de contenido no compatible: ${contentType}`);
  const rawText = new TextDecoder().decode(bytes);
  if (contentType === "text/plain" || contentType === "application/json") return { title: new URL(finalUrl).hostname, text: rawText.slice(0, 200_000), finalUrl, contentType, needsInput: false, metadata: {} };
  const $ = load(rawText);
  $("script,style,noscript,svg,nav,footer,form").remove();
  const title = $("meta[property='og:title']").attr("content") || $("title").text().trim() || new URL(finalUrl).hostname;
  const description = $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "";
  const body = ($("main").text() || $("article").text() || $("body").text()).replace(/\s+/g, " ").trim();
  const host = new URL(finalUrl).hostname.replace(/^www\./, "");
  const isVideo = host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com") || host === "vimeo.com" || host.endsWith(".vimeo.com");
  if (isVideo) {
    const transcript = await extractVideoTranscript(rawText, host);
    const text = [`Título: ${title}`, description && `Descripción: ${description}`, transcript?.text && `Transcript: ${transcript.text}`].filter(Boolean).join("\n\n");
    return {
      title,
      text,
      finalUrl,
      contentType,
      needsInput: !transcript,
      metadata: { video: true, transcript: transcript ? "public_track" : "unavailable", language: transcript?.language, trackKind: transcript?.trackKind },
    };
  }
  const text = [`Título: ${title}`, description && `Descripción: ${description}`, body && `Contenido: ${body.slice(0, 180_000)}`].filter(Boolean).join("\n\n");
  return {
    title,
    text,
    finalUrl,
    contentType,
    needsInput: false,
    metadata: {},
  };
}
