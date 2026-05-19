"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: string; type: "success" | "error"; message: string };

type ToastContextValue = {
  push: (type: "success" | "error", message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** IDs para toasts: `randomUUID` só existe em contexto seguro (HTTPS ou localhost). */
function createToastId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  useEffect(() => {
    return () => {
      for (const t of timeoutsRef.current) clearTimeout(t);
      timeoutsRef.current = [];
    };
  }, []);

  const push = useCallback((type: "success" | "error", message: string) => {
    const id = createToastId();
    setItems((prev) => [...prev, { id, type, message }]);
    const tid = setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
      timeoutsRef.current = timeoutsRef.current.filter((x) => x !== tid);
    }, 4200);
    timeoutsRef.current.push(tid);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              t.type === "success"
                ? "pointer-events-auto rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-950/80 dark:text-emerald-100"
                : "pointer-events-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg dark:border-red-900/60 dark:bg-red-950/80 dark:text-red-100"
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
