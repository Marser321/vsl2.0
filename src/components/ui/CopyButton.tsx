"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { Button } from "./Button";

export function CopyButton({
  className = "",
  copiedLabel = "Copiado",
  label = "Copiar",
  text,
  variant = "secondary",
}: {
  className?: string;
  copiedLabel?: string;
  label?: string;
  text: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function copy() {
    try {
      await copyText(text);
      setCopied(true);
      toast.success(copiedLabel);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo manualmente.");
    }
  }

  return (
    <Button
      className={className}
      variant={variant}
      size="sm"
      icon={copied ? <Check size={14} /> : <Copy size={14} />}
      onClick={copy}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
