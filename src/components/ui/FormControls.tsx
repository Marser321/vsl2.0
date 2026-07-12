import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { inputCls } from "./styles";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputCls} ${className}`} {...props} />;
}

export function Field({
  children,
  className = "",
  error,
  hint,
  label,
}: {
  children: ReactNode;
  className?: string;
  error?: string;
  hint?: string;
  label: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger" role="alert">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs leading-5 text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}
