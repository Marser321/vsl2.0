"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

export function ConfirmDialog({
  children,
  confirmLabel = "Confirmar",
  destructive = false,
  message,
  onClose,
  onConfirm,
  open,
  title,
}: {
  children?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  message?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/40"
    >
      <div className="p-6">
        <h2 className="text-lg font-bold text-brand-navy">{title}</h2>
        {message && <div className="mt-2 text-sm leading-6 text-slate-600">{message}</div>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}
