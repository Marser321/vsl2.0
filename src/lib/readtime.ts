/**
 * Análisis de duración y retención de un guion en Markdown.
 * Heurístico y local — sin llamadas a IA.
 */

export type Section = {
  title: string;
  text: string;
  words: number;
  /** segundos desde el inicio del video */
  startSec: number;
  durationSec: number;
  /** señales heurísticas de posible fuga de retención */
  leakFlags: string[];
};

export type ReadtimeAnalysis = {
  sections: Section[];
  totalWords: number;
  totalSec: number;
  wpm: number;
};

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function analyzeScript(markdown: string, wpm = 150): ReadtimeAnalysis {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentTitle = "Apertura";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer
      .join("\n")
      // sacar acotaciones visuales y formato antes de contar palabras
      .replace(/^>\s?\[.*?\]\s*$/gm, "")
      .replace(/[#*_`]/g, "")
      .trim();
    if (text || sections.length === 0) {
      sections.push({
        title: currentTitle,
        text,
        words: countWords(text),
        startSec: 0,
        durationSec: 0,
        leakFlags: [],
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const h = line.match(/^#{1,2}\s+(.*)$/);
    if (h) {
      if (buffer.length) flush();
      currentTitle = h[1].replace(/\(.*?\)\s*$/, "").trim() || "Sección";
      continue;
    }
    buffer.push(line);
  }
  flush();

  const nonEmpty = sections.filter((s) => s.words > 0);
  let cursor = 0;
  for (const s of nonEmpty) {
    s.startSec = cursor;
    s.durationSec = Math.round((s.words / wpm) * 60);
    cursor += s.durationSec;

    // Heurísticas de fuga
    if (s.durationSec > 120)
      s.leakFlags.push("Sección larga (>2 min) — considerá partirla o sumar un re-enganche");
    const paragraphs = s.text.split(/\n\n+/).filter(Boolean);
    if (paragraphs.some((p) => countWords(p) > 90))
      s.leakFlags.push("Párrafo denso (>90 palabras) sin pausa — riesgo de monotonía");
    const hasEngagement = /[¿?]|vos|tú|usted|imaginá|imagina|mirá|mira|escuchá|escucha|pensá|piensa/i.test(
      s.text
    );
    if (s.words > 60 && !hasEngagement)
      s.leakFlags.push("Sin apelación directa al espectador — sumá una pregunta o un “vos/tú”");
  }

  const totalWords = nonEmpty.reduce((a, s) => a + s.words, 0);
  return {
    sections: nonEmpty,
    totalWords,
    totalSec: Math.round((totalWords / wpm) * 60),
    wpm,
  };
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
