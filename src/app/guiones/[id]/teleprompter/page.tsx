"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { analyzeScript, fmtTime } from "@/lib/readtime";
import { AlertTriangle, ArrowLeft, Pause, Play } from "lucide-react";

type ScriptDetail = {
  id: number;
  title: string;
  versions: { versionNumber: number; content: string }[];
};

export default function TeleprompterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [script, setScript] = useState<ScriptDetail | null>(null);
  const [wpm, setWpm] = useState(150);
  const [playing, setPlaying] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [showMap, setShowMap] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/scripts/${id}`)
      .then((r) => r.json())
      .then(setScript);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setWpm(Number(s.wpm_es) || 150));
  }, [id]);

  const content =
    script?.versions[script.versions.length - 1]?.content ?? "";
  const analysis = useMemo(
    () => (content ? analyzeScript(content, wpm) : null),
    [content, wpm]
  );

  // Auto-scroll: velocidad proporcional a wpm y tamaño de fuente
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const el = scrollRef.current;
    if (!el || !analysis) return;

    // px por segundo = altura total de contenido / duración total estimada
    const pxPerSec = (el.scrollHeight - el.clientHeight) / analysis.totalSec;
    let last = performance.now();
    // acumular en variable: incrementos sub-píxel sobre scrollTop se redondean a 0
    let pos = el.scrollTop;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      pos += pxPerSec * dt;
      el.scrollTop = pos;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, analysis]);

  if (!script || !analysis)
    return (
      <div className="text-sm text-slate-400 p-8">Cargando teleprompter…</div>
    );

  return (
    <div className="fixed inset-0 bg-brand-ink text-white flex flex-col z-50">
      {/* Barra superior */}
      <div className="flex items-center gap-4 px-6 py-3 bg-black/30 text-sm">
        <Link
          href={`/guiones/${id}`}
          className="text-slate-300 hover:text-white"
        >
          <ArrowLeft className="mr-1 inline" size={16} strokeWidth={1.75} /> Salir
        </Link>
        <span className="font-semibold truncate">{script.title}</span>
        <span className="text-slate-400 text-xs">
          {analysis.totalWords.toLocaleString("es")} palabras ·{" "}
          {fmtTime(analysis.totalSec)} a {wpm} ppm
        </span>
        <div className="ml-auto flex items-center gap-3">
          <label className="text-xs text-slate-300">
            Velocidad
            <input
              type="range"
              min={100}
              max={220}
              value={wpm}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="ml-2 align-middle"
            />
            <span className="ml-1">{wpm}</span>
          </label>
          <label className="text-xs text-slate-300">
            Aa
            <input
              type="range"
              min={18}
              max={48}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="ml-2 align-middle"
            />
          </label>
          <button
            onClick={() => setShowMap(!showMap)}
            className="text-xs text-slate-300 hover:text-white"
          >
            {showMap ? "Ocultar mapa" : "Mostrar mapa"}
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="rounded-lg bg-brand-blue px-5 py-2 font-semibold hover:bg-blue-600"
          >
            {playing ? <><Pause size={17} strokeWidth={1.75} /> Pausa</> : <><Play size={17} strokeWidth={1.75} /> Reproducir</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Texto con auto-scroll */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-[15%] py-[40vh]"
          style={{ fontSize, lineHeight: 1.8 }}
        >
          {analysis.sections.map((s, i) => (
            <div key={i} className="mb-12">
              <div className="text-brand-sky text-sm font-bold uppercase tracking-widest mb-4 opacity-70">
                {s.title} · {fmtTime(s.startSec)}
              </div>
              {s.text.split(/\n\n+/).map((p, j) => (
                <p key={j} className="mb-6">
                  {p}
                </p>
              ))}
            </div>
          ))}
          <div className="text-center text-slate-500 text-lg py-20">■ FIN</div>
        </div>

        {/* Mapa de retención */}
        {showMap && (
          <div className="w-80 shrink-0 overflow-y-auto bg-black/30 p-4 text-xs">
            <div className="font-bold text-slate-300 uppercase tracking-wider mb-3">
              Mapa de retención
            </div>
            {analysis.sections.map((s, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 mb-2 border ${
                  s.leakFlags.length
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold truncate">{s.title}</span>
                  <span className="text-slate-400 shrink-0 ml-2">
                    {fmtTime(s.startSec)}–{fmtTime(s.startSec + s.durationSec)}
                  </span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  {s.words} palabras · {fmtTime(s.durationSec)}
                </div>
                {s.leakFlags.map((f, j) => (
                  <div key={j} className="mt-1.5 text-amber-300 flex gap-1.5">
                    <AlertTriangle className="shrink-0" size={15} strokeWidth={1.75} />
                    {f}
                  </div>
                ))}
              </div>
            ))}
            <p className="text-slate-500 mt-3 leading-relaxed">
              Los avisos son heurísticos: secciones largas, párrafos densos o
              bloques sin apelación directa al espectador — puntos típicos de
              fuga de retención. Ajustá antes de grabar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
