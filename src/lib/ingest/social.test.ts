import { describe, expect, it } from "vitest";
import { buildYtDlpArgs, buildYtDlpSubtitleArgs, classifySocialUrl, parseFfmpegProgressDuration, parseVttTranscript, SOCIAL_LIMITS, socialImportErrorMessage } from "./social";

describe("ingesta social", () => {
  it.each([
    ["https://youtu.be/abc123", "youtube"],
    ["https://www.youtube.com/shorts/abc123", "youtube"],
    ["https://www.instagram.com/reel/abc/", "instagram"],
    ["https://www.tiktok.com/@cuenta/video/123", "tiktok"],
  ])("clasifica %s", (url, platform) => {
    expect(classifySocialUrl(url).platform).toBe(platform);
  });

  it("no expone fragmentos de una clave rechazada", () => {
    const message = socialImportErrorMessage(new Error("401 Incorrect API key provided: sk-proj-secret-tail"));
    expect(message).toContain("clave de OpenRouter");
    expect(message).not.toContain("sk-proj");
  });

  it("rechaza hosts ajenos y credenciales", () => {
    expect(() => classifySocialUrl("https://example.com/video")).toThrow("Solo se admiten");
    expect(() => classifySocialUrl("https://user:pass@youtube.com/watch?v=x")).toThrow("credenciales");
  });

  it("construye argumentos sin shell, playlists ni directos", () => {
    const args = buildYtDlpArgs("https://youtu.be/abc", "/tmp/source.%(ext)s");
    expect(args[0]).toBe("https://youtu.be/abc");
    expect(args).toContain("--no-playlist");
    expect(args).toContain("--ignore-config");
    expect(args).toContain("--max-filesize");
    expect(args).toContain(`duration <= ${SOCIAL_LIMITS.maxDurationSeconds} & !is_live`);
    expect(args.join(" ")).not.toContain("--exec");
    expect(SOCIAL_LIMITS.maxDurationSeconds).toBe(420);
  });

  it("prioriza subtítulos públicos y automáticos sin descargar el video", () => {
    const args = buildYtDlpSubtitleArgs("https://youtu.be/abc", "/tmp/captions.%(ext)s");
    expect(args).toContain("--skip-download");
    expect(args).toContain("--write-subs");
    expect(args).toContain("--write-auto-subs");
    expect(args).toContain("es.*,es,en.*,en");
  });

  it("limpia timestamps, etiquetas y cues repetidos de WebVTT", () => {
    const text = parseVttTranscript(`WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<c>Hola &amp; bienvenidos</c>\n\n00:00:02.000 --> 00:00:04.000\nHola &amp; bienvenidos\nEste es el guion`);
    expect(text).toBe("Hola & bienvenidos Este es el guion");
  });

  it("lee la duración final informada por FFmpeg", () => {
    expect(parseFfmpegProgressDuration("out_time_us=1000000\nprogress=continue\nout_time_us=419500000\nprogress=end\n")).toBe(419.5);
  });
});
