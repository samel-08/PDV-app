"use client";

import { useEffect, useRef } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  panelClassName,
  headerClassName,
  titleClassName,
  closeButtonClassName,
  bodyClassName,
  footerClassName,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  panelClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  closeButtonClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={
          panelClassName ??
          "relative max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-card dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
        }
      >
        <div className={headerClassName ?? "flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800"}>
          <h2 className={titleClassName ?? "text-base font-semibold"}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={closeButtonClassName ?? "inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"}
            aria-label="Fechar dialogo"
          >
            x
          </button>
        </div>
        <div className={bodyClassName ?? "max-h-[calc(92dvh-8rem)] overflow-y-auto p-4"}>{children}</div>
        {footer ? (
          <div className={footerClassName ?? "flex flex-col-reverse gap-2 border-t border-zinc-200 p-4 sm:flex-row sm:justify-end dark:border-zinc-800"}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
