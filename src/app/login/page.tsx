"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
        <div className="text-3xl font-black text-brand-navy mb-1">ad<span className="text-brand-blue">·</span></div>
        <h1 className="text-xl font-bold text-brand-navy">Acceso al estudio</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Ingresá la clave compartida del piloto.</p>
        <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1">Clave</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-blue" required />
        {error && <p className="mt-3 text-sm text-rose-600" aria-live="polite">{error}</p>}
        <button disabled={pending} className="mt-5 w-full rounded-lg bg-brand-blue px-4 py-2.5 font-semibold text-white disabled:opacity-50">{pending ? "Verificando…" : "Entrar"}</button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-brand-mist" />}><LoginForm /></Suspense>;
}
