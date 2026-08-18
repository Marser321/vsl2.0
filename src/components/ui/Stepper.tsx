"use client";

/**
 * Indicador de pasos compartido por los dos wizards del producto.
 *
 * Antes había dos implementaciones divergentes: la de /generar no era clicable
 * ni decía en qué paso ibas, y la del relevamiento sí. Misma pieza, dos
 * comportamientos distintos en el mismo producto.
 */
export function Stepper({
  steps,
  current,
  onGo,
  label = "Progreso",
}: {
  steps: string[];
  /** Índice del paso actual, base 0. */
  current: number;
  /** Si viene, se puede volver a los pasos ya recorridos. */
  onGo?: (index: number) => void;
  label?: string;
}) {
  return (
    <div className="mb-8">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((titulo, i) => {
          // Solo se puede volver atrás: saltear hacia adelante deja el wizard
          // en un estado que el paso siguiente no sabe interpretar.
          const alcanzable = onGo !== undefined && i < current;
          const contenido = (
            <>
              <span
                className={`block h-1.5 rounded-full ${i <= current ? "bg-brand-blue" : "bg-slate-200"}`}
              />
              <span
                className={`mt-1.5 block text-xs ${
                  i === current ? "font-semibold text-brand-navy" : "text-slate-400"
                }`}
              >
                {i + 1}. {titulo}
              </span>
            </>
          );

          return alcanzable ? (
            <button
              key={titulo}
              type="button"
              onClick={() => onGo(i)}
              className="rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/70"
              aria-label={`Volver a ${titulo}`}
            >
              {contenido}
            </button>
          ) : (
            <div key={titulo} aria-current={i === current ? "step" : undefined}>
              {contenido}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {label}: paso {current + 1} de {steps.length}
      </p>
    </div>
  );
}
