import mammoth from "mammoth";

export type ExtractResult = {
  text: string;
  warning: string | null;
};

/** Extrae texto plano de PDF/DOCX/TXT/MD. */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractResult> {
  const lower = filename.toLowerCase();

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = normalize(result.text);
      if (!text) {
        return {
          text: "",
          warning:
            "El PDF no contiene texto extraíble (posiblemente escaneado). Pegá el texto manualmente o subí otra versión.",
        };
      }
      return { text, warning: null };
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalize(result.value), warning: null };
  }

  // TXT / MD / cualquier texto plano
  return { text: normalize(buffer.toString("utf-8")), warning: null };
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
