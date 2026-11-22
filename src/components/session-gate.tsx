"use client";
import { newRequestKey } from "@/lib/client-key";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { TenantContext } from "@/lib/tenant-context";
export function notifySessionChange() {
  try {
    localStorage.setItem("pdv-session-change", newRequestKey());
  } catch {
    /* Armazenamento pode estar indisponível. */
  }
}
const SessionContext = createContext<TenantContext | null>(null);
export function useSession() {
  return useContext(SessionContext);
}
export function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const login = pathname === "/login";
  const client = useQueryClient();
  const [session, setSession] = useState<TenantContext | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (login) return;
    let cancelled = false;
    let restore: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const original = window.fetch;
    const nativeFetch = original.bind(window);
    function leave() {
      client.clear();
      setSession(null);
      window.location.replace("/login");
    }
    const changed = (event: StorageEvent) => {
      if (event.key === "pdv-session-change") leave();
    };
    window.addEventListener("storage", changed);
    (async () => {
      const response = await nativeFetch("/api/auth/me", { cache: "no-store" });
      if (cancelled) return;
      if (response.status === 401) {
        leave();
        return;
      }
      if (!response.ok) {
        setError("Acesso indisponível. Entre com uma conta ativa.");
        return;
      }
      const identity: TenantContext = await response.json();
      if (cancelled) return;
      const securedFetch: typeof fetch = async (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
          location.origin,
        );
        const localApi =
          url.origin === location.origin && url.pathname.startsWith("/api/");
        const headers = new Headers(
          init?.headers ??
            (input instanceof Request ? input.headers : undefined),
        );
        if (localApi) headers.set("X-PDV-Session", identity.sessaoId);
        const result = await nativeFetch(
          input,
          localApi ? { ...init, headers, cache: "no-store" } : init,
        );
        if (!cancelled && localApi && result.status === 401) leave();
        if (!cancelled && localApi && result.status === 403) {
          const value = await result
            .clone()
            .json()
            .catch(() => null);
          if (value?.error === "Acesso bloqueado.") {
            client.clear();
            setSession(null);
            setError("Seu acesso foi bloqueado. Contate o administrador.");
          }
        }
        return result;
      };
      window.fetch = securedFetch;
      restore = () => {
        if (window.fetch === securedFetch) window.fetch = original;
      };
      setSession(identity);
      timer = setInterval(async () => {
        const r = await securedFetch("/api/auth/me").catch(() => null);
        if (r?.ok && !cancelled) {
          const next: TenantContext = await r.json();
          if (next.cargo !== identity.cargo) client.clear();
          setSession(next);
        }
      }, 60000);
    })().catch(() => {
      if (!cancelled)
        setError("Não foi possível carregar a sessão. Recarregue a página.");
    });
    return () => {
      window.removeEventListener("storage", changed);
      cancelled = true;
      if (timer) clearInterval(timer);
      restore?.();
    };
  }, [login, client]);
  const restricted =
    session?.cargo === "CAIXA" &&
    !(
      pathname === "/pdv" ||
      pathname === "/historico" ||
      pathname.startsWith("/print/")
    );
  const configDenied =
    session &&
    session.cargo !== "ADMINISTRADOR" &&
    pathname.startsWith("/configuracoes");
  useEffect(() => {
    if (session?.cargo === "CAIXA" && pathname === "/")
      window.location.replace("/pdv");
  }, [session, pathname]);
  if (login) return children;
  if (restricted && pathname === "/")
    return <p className="p-8">Abrindo o PDV...</p>;
  if (error || restricted || configDenied)
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <h1 className="text-xl font-semibold">Acesso indisponível</h1>
        <p>{error || "Seu cargo não permite abrir esta página."}</p>
        <a className="underline" href="/pdv">
          Voltar ao PDV
        </a>
        <br />
        <a className="underline" href="/login">
          Entrar com outra conta
        </a>
      </div>
    );
  if (!session) return <p className="p-8">Carregando sua empresa...</p>;
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
