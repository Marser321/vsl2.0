"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Brandmark from "@/components/Brandmark";
import { Button, Field, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) return setError(data.error ?? "No se pudo iniciar sesión");
    router.replace(search.get("next") || "/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-brand-mist grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-7">
        <Brandmark size={34} lockup="horizontal" />
        <h1 className="text-xl font-bold text-brand-navy">Acceso al estudio</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Ingresá la clave compartida del piloto.</p>
        <Field label="Clave" error={error || undefined}>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" loading={pending} className="mt-5 w-full">Entrar</Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-brand-mist" />}><LoginForm /></Suspense>;
}
