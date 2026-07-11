"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScriptMarkdown from "./ScriptMarkdown";
import { Card, btnPrimary, btnSecondary } from "./ui";
import { analyzeScript, fmtTime } from "@/lib/readtime";

type SavedVersion = {
  id: number;
  versionNumber: number;
  content: string;
  source: string;
};

type Props = {
  scriptId: number;
  version: { id: number; versionNumber: number; content: string };
  latestVersionNumber: number;
  wpm: number;
  pinnedSuggestions: string[];
  onDismissSuggestion: (index: number) => void;
  onSaved: (version: SavedVersion, coalesced: boolean) => void;
  onCancel: () => void;
};

const PLACEHOLDER_RE = /\{\{[A-ZÁÉÍÓÚÑ_]+\}\}/g;
const DRAFT_PREFIX = "vsl-draft-";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function draftKey(scriptId: number, versionId: number) {
  return `${DRAFT_PREFIX}${scriptId}-${versionId}`;
}

/** Purga borradores locales viejos (>7 días) para que localStorage no acumule. */
function purgeOldDrafts() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DRAFT_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      const savedAt = raw ? (JSON.parse(raw).savedAt as number | undefined) : undefined;
      if (!savedAt || Date.now() - savedAt > DRAFT_MAX_AGE_MS) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage corrupto o inaccesible: ignorar
  }
}

export default function ScriptEditor({
  scriptId,
  version,
  latestVersionNumber,
  wpm,
  pinnedSuggestions,
  onDismissSuggestion,
  onSaved,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [draft, setDraft] = useState(version.content);
  const [baseline, setBaseline] = useState(version.content);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restorable, setRestorable] = useState<{ content: string; savedAt: number } | null>(null);
  const [stats, setStats] = useState<{ words: number; sec: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = draft !== baseline;
  const key = draftKey(scriptId, version.id);

  // Al cambiar la versión activa (p. ej. tras guardar como vN+1): re-basear sin pisar un borrador sucio.
  useEffect(() => {
    setBaseline(version.content);
    setDraft((prev) => (prev === version.content ? prev : version.content));
    setRestorable(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version.id]);

  // Al montar: purgar borradores viejos y ofrecer restaurar el de esta versión.
  useEffect(() => {
    purgeOldDrafts();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { content: string; savedAt: number };
        if (parsed.content && parsed.content !== version.content) setRestorable(parsed);
      }
    } catch {
      // borrador ilegible: ignorar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persistir borrador (debounce 1.5s) mientras haya cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ content: draft, savedAt: Date.now() }));
      } catch {
        // cuota llena: ignorar
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [draft, dirty, key]);

  // Estadísticas de duración (debounce 300ms).
  useEffect(() => {
    const t = setTimeout(() => {
      const a = analyzeScript(draft, wpm);
      setStats({ words: a.totalWords, sec: a.totalSec });
    }, 300);
    return () => clearTimeout(t);
  }, [draft, wpm]);

  const placeholders = useMemo(() => draft.match(PLACEHOLDER_RE) ?? [], [draft]);

  const save = useCallback(async () => {
    if (saving) return;
    if (!dirty) return;
    if (!draft.trim()) {
      setError("El guion no puede quedar vacío");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, baseVersionId: version.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar");
        return;
      }
      try {
        localStorage.removeItem(key);
      } catch {
        // sin acceso a localStorage: no es crítico
      }
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      onSaved(data.version as SavedVersion, Boolean(data.coalesced));
    } finally {
      setSaving(false);
    }
  }, [dirty, draft, key, onSaved, saving, scriptId, version.id]);

  const close = useCallback(() => {
    if (dirty && !confirm("¿Descartar los cambios sin guardar?")) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // sin acceso a localStorage: no es crítico
    }
    onCancel();
  }, [dirty, key, onCancel]);

  // Atajos: Cmd/Ctrl+S guarda, Esc cierra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [save, close]);

  // Aviso nativo al cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function jumpToNextPlaceholder() {
    const ta = textareaRef.current;
    if (!ta) return;
    setMode("edit");
    const from = ta.selectionEnd ?? 0;
    PLACEHOLDER_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let target: { start: number; end: number } | null = null;
    let first: { start: number; end: number } | null = null;
    while ((match = PLACEHOLDER_RE.exec(draft))) {
      const pos = { start: match.index, end: match.index + match[0].length };
      if (!first) first = pos;
      if (pos.start >= from && !target) target = pos;
    }
    const dest = target ?? first;
    if (!dest) return;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(dest.start, dest.end);
      const lineIndex = draft.slice(0, dest.start).split("\n").length - 1;
      ta.scrollTop = Math.max(0, lineIndex * 22 - ta.clientHeight / 3);
    });
  }

  const editingOldVersion = version.versionNumber !== latestVersionNumber;

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
          <button
            className={`px-3 py-1.5 ${mode === "edit" ? "bg-brand-blue text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setMode("edit")}
          >
            ✎ Editar
          </button>
          <button
            className={`px-3 py-1.5 ${mode === "preview" ? "bg-brand-blue text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setMode("preview")}
          >
            Vista previa
          </button>
        </div>
        <div className="flex gap-2">
          <button className={btnSecondary} onClick={close}>
            Cerrar
          </button>
          <button className={btnPrimary} onClick={save} disabled={!dirty || saving}>
            {saving ? "Guardando…" : "Guardar (⌘S)"}
          </button>
        </div>
      </div>

      {editingOldVersion && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800 mb-3">
          Estás editando la v{version.versionNumber}. Al guardar se creará la v
          {latestVersionNumber + 1} con este texto (la v{version.versionNumber} no se pierde).
        </div>
      )}

      {restorable && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-brand-navy mb-3 flex items-center justify-between gap-3">
          <span>
            Hay un borrador sin guardar de esta versión (
            {new Date(restorable.savedAt).toLocaleString("es")}).
          </span>
          <span className="flex gap-2 shrink-0">
            <button
              className="font-semibold text-brand-blue hover:underline"
              onClick={() => {
                setDraft(restorable.content);
                setRestorable(null);
              }}
            >
              Restaurar
            </button>
            <button
              className="text-slate-500 hover:underline"
              onClick={() => {
                try {
                  localStorage.removeItem(key);
                } catch {
                  // ignorar
                }
                setRestorable(null);
              }}
            >
              Descartar
            </button>
          </span>
        </div>
      )}

      {pinnedSuggestions.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-3">
          <div className="text-xs font-semibold text-amber-800 mb-2">
            Ediciones sugeridas por la crítica — aplicalas a mano y descartá cada una:
          </div>
          <ul className="space-y-1.5">
            {pinnedSuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
                <span className="flex-1">{s}</span>
                <button
                  className="shrink-0 text-amber-700 hover:underline"
                  onClick={() => navigator.clipboard.writeText(s)}
                >
                  Copiar
                </button>
                <button
                  className="shrink-0 text-amber-700 hover:text-amber-900"
                  onClick={() => onDismissSuggestion(i)}
                  title="Descartar sugerencia"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-800 mb-3">
          {error}
        </div>
      )}

      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="w-full h-[60vh] rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-slate-800 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100 resize-y"
        />
      ) : (
        <div className="h-[60vh] overflow-y-auto rounded-lg border border-slate-200 bg-brand-mist p-5">
          <ScriptMarkdown content={draft} />
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
        <span>
          {stats ? `${stats.words.toLocaleString("es")} palabras · ~${fmtTime(stats.sec)}` : "—"} ·{" "}
          {wpm} ppm
        </span>
        {placeholders.length > 0 && (
          <button
            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800 hover:bg-amber-100"
            onClick={jumpToNextPlaceholder}
          >
            {placeholders.length} marcador{placeholders.length > 1 ? "es" : ""} {"{{ }}"} pendiente
            {placeholders.length > 1 ? "s" : ""} — ir al siguiente
          </button>
        )}
        <span className="ml-auto">
          {saving
            ? "Guardando…"
            : justSaved
              ? "✓ Guardado"
              : dirty
                ? "● Sin guardar (borrador local activo)"
                : "Sin cambios"}
        </span>
      </div>
    </Card>
  );
}
