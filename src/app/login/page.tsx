"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from") || "/";

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Não foi possível entrar.");
        return;
      }
      router.replace(from.startsWith("/") ? from : "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex items-center justify-end gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-500">Tema</span>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
              PDV
            </div>
            <div>
              <h1 className="text-lg font-semibold">Entrar</h1>
              <p className="text-xs text-zinc-500">PDV Comércio</p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Usuário (opcional)</label>
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Se configurado no servidor"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Sua senha"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <p className="text-center text-xs text-zinc-500">
              Em desenvolvimento, a senha padrão é <span className="font-mono font-semibold">admin</span> se{" "}
              <span className="font-mono">PDV_LOGIN_PASSWORD</span> não estiver no .env.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-zinc-50 text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          Carregando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
