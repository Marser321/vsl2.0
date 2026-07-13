import { z } from "zod";

const requiredText = (message: string) => z.string().trim().min(1, message);

export const generationInputSchema = z
  .object({
    clientId: z.number().int().positive("Elegí un cliente"),
    brandId: z.number().int().positive().nullable().optional(),
    offerId: z.number().int().positive().nullable().optional(),
    campaignId: z.number().int().positive().nullable().optional(),
    frameworkId: z.number().int().positive().nullable(),
    documentIds: z.array(z.number().int().positive()),
    title: requiredText("Escribí un título interno"),
    format: z.enum(["vsl", "reel"]).default("vsl"),
    provider: z.enum(["anthropic", "openrouter"]),
    model: requiredText("No hay un modelo configurado para este proveedor"),
    openrouterConfirmed: z.boolean().optional(),
    brief: z.object({
      producto: requiredText("Describí el producto o servicio"),
      audiencia: requiredText("Describí la audiencia o avatar"),
      oferta: requiredText("Detallá la oferta"),
      dolores: requiredText("Indicá los dolores principales"),
      objeciones: z.string().default(""),
      duracionMin: z.number().min(1, "La duración mínima es 1 minuto").max(60, "La duración máxima es 60 minutos"),
      duracionSeg: z.number().int().min(15).max(90).optional(),
      plataforma: z.enum(["tiktok", "reels", "shorts"]).or(z.literal("")).optional(),
      tono: z.string().default(""),
      cta: requiredText("Escribí el llamado a la acción"),
      instruccionesExtra: z.string().default(""),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.format === "reel" && data.brief.duracionSeg === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Indicá la duración del reel en segundos (15–90)",
        path: ["brief", "duracionSeg"],
      });
    }
    if (data.provider === "openrouter" && data.openrouterConfirmed !== true) {
      ctx.addIssue({
        code: "custom",
        message: "Confirmá el uso de 6 llamadas de OpenRouter antes de generar",
        path: ["openrouterConfirmed"],
      });
    }
  });

export type GenerationInput = z.infer<typeof generationInputSchema>;

export const GENERATION_FIELD_NAMES: Record<string, string> = {
  "title": "title",
  "brief.producto": "producto",
  "brief.audiencia": "audiencia",
  "brief.oferta": "oferta",
  "brief.dolores": "dolores",
  "brief.duracionMin": "duracionMin",
  "brief.duracionSeg": "duracionSeg",
  "brief.cta": "cta",
  "openrouterConfirmed": "openrouterConfirmed",
};

export function generationFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const name = GENERATION_FIELD_NAMES[issue.path.join(".")];
    if (name && !result[name]) result[name] = issue.message;
  }
  return result;
}
