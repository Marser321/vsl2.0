/**
 * Análisis de duración y retención de un guion en Markdown.
 * Heurístico y local — sin llamadas a IA.
 *
 * El troceo y el filtrado de acotaciones viven en `src/lib/guion.ts`: acá solo
 * se cuenta y se estima. Antes esta función tenía su propia limpieza a medias
 * (filtraba un único patrón de acotación), lo que inflaba el conteo de palabras
 * y hacía que el teleprompter mostrara acotaciones como si fueran locución.
 */
import { separarGuion } from "./guion";

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
  const sections: Section[] = separarGuion(markdown).map((bloque) => {
    const text = bloque.locucion.join("\n\n");
    return {
      title: bloque.titulo,
      text,
      words: countWords(text),
      startSec: 0,
      durationSec: 0,
      leakFlags: [],
    };
  });

  const nonEmpty = sections.filter((s) => s.words > 0);
  const totalSecEstimate = Math.round(
    (nonEmpty.reduce((a, s) => a + s.words, 0) / wpm) * 60
  );
  let cursor = 0;
  for (const s of nonEmpty) {
    s.startSec = cursor;
    s.durationSec = Math.round((s.words / wpm) * 60);
    cursor += s.durationSec;

    // Heurísticas de fuga (la de sección larga no aplica a formatos cortos tipo reel).
    // Corren sobre la locución: antes una acotación como "[VISUAL: mira a cámara]"
    // contaba como apelación al espectador y tapaba la fuga real.
    if (s.durationSec > 120 && totalSecEstimate >= 120)
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
