"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <AlertTriangle className="mx-auto text-warn" size={40} strokeWidth={1.5} />
      <h1 className="mt-4 text-xl font-bold text-brand-navy">No pudimos cargar esta pantalla</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Puede ser un problema temporal. Probá de nuevo en unos segundos.</p>
      <Button className="mt-6" onClick={reset}>Reintentar</Button>
    </Card>
  );
}
