import { z } from "zod";

const text = z.string().trim().max(20_000).default("");

// Los campos de URL son opcionales: no deben bloquear el envío por formato.
// Normalizamos lo que parezca una URL (agregando https:// si falta) y, si aun
// así no es válida, conservamos el texto tal cual en vez de rechazarlo.
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return z.url().safeParse(candidate).success ? candidate : trimmed;
}

const urlText = z
  .string()
  .trim()
  .max(4_000)
  .default("")
  .transform(normalizeUrl);

const urlList = z
  .array(z.string().trim().max(4_000))
  .max(12)
  .default([])
  .transform((links) => links.map(normalizeUrl).filter(Boolean));

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(160),
  role: text,
  email: z.email().max(320),
  phone: z.string().trim().max(80).default(""),
  consent: z.literal(true),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(200),
  website: urlText,
  socialLinks: urlList,
  country: text,
  market: text,
  language: z.string().trim().max(40).default("Español LATAM"),
  industry: z.string().trim().min(1).max(160),
  subindustry: text,
  story: text,
  purpose: text,
  values: text,
  personality: text,
  tone: text,
  preferredExpressions: text,
  forbiddenExpressions: text,
});

export const offerTypes = ["service", "course", "ecommerce", "saas", "local", "other"] as const;
export const offerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(offerTypes),
  description: z.string().trim().min(10).max(20_000),
  mechanism: text,
  benefits: text,
  differentiators: text,
  price: text,
  paymentOptions: text,
  bonuses: text,
  guarantee: text,
  delivery: text,
  availability: text,
  urgency: text,
  serviceProcess: text,
  courseModules: text,
  ecommerceSpecs: text,
  saasFeatures: text,
  localCoverage: text,
});

export const audienceSchema = z.object({
  primaryAvatar: z.string().trim().min(10).max(20_000),
  secondaryAvatar: text,
  awareness: text,
  pains: z.string().trim().min(10).max(20_000),
  desires: text,
  previousAttempts: text,
  objections: text,
  triggers: text,
  ownLanguage: text,
  alternatives: text,
  competitors: text,
});

export const proofSchema = z.object({
  founderStory: text,
  experience: text,
  metrics: text,
  cases: text,
  testimonials: text,
  claimSources: text,
  certifications: text,
  legalRestrictions: text,
});

export const campaignSchema = z.object({
  title: z.string().trim().min(1).max(240),
  objective: z.string().trim().min(5).max(20_000),
  trafficSource: text,
  funnelStage: text,
  durationMinutes: z.number().int().min(1).max(60).default(10),
  cta: z.string().trim().min(2).max(2_000),
  angle: text,
  format: text,
  deadline: text,
  mustInclude: text,
  mustAvoid: text,
});

export const notesSchema = z.object({
  additionalContext: text,
});

export const sectionSchemas = {
  contact: contactSchema,
  brand: brandSchema,
  offer: offerSchema,
  audience: audienceSchema,
  proof: proofSchema,
  campaign: campaignSchema,
  notes: notesSchema,
} as const;

export type IntakeSection = keyof typeof sectionSchemas;
export type IntakeAnswers = {
  [K in IntakeSection]?: z.infer<(typeof sectionSchemas)[K]>;
};

export function validateSection(section: IntakeSection, value: unknown) {
  void section;
  return z.record(
    z.string().max(100),
    z.union([
      z.string().max(20_000),
      z.number().finite(),
      z.boolean(),
      z.array(z.string().max(4_000)).max(20),
      z.null(),
    ])
  ).safeParse(value);
}

// Chequea únicamente que los datos provistos tengan un formato/tamaño sano
// (mismo criterio que el autosave), sin exigir presencia ni longitud mínima.
// La completitud —qué campos son obligatorios— la resuelve validateForSubmission
// con mensajes claros, para que un relevamiento con poca información igual se envíe.
export function validateAnswerFormats(answers: IntakeAnswers): string[] {
  return (Object.keys(sectionSchemas) as IntakeSection[]).flatMap((section) => {
    const value = answers[section];
    if (value === undefined) return [];
    const parsed = validateSection(section, value);
    return parsed.success ? [] : [`Datos inválidos en ${section}: ${parsed.error.issues[0].message}`];
  });
}

const IMPORTANT_PATHS: Array<[IntakeSection, string]> = [
  ["contact", "name"], ["contact", "email"], ["contact", "consent"],
  ["brand", "name"], ["brand", "industry"], ["brand", "story"], ["brand", "tone"],
  ["offer", "name"], ["offer", "description"], ["offer", "mechanism"], ["offer", "benefits"],
  ["offer", "differentiators"], ["offer", "price"], ["offer", "guarantee"],
  ["audience", "primaryAvatar"], ["audience", "pains"], ["audience", "desires"],
  ["audience", "objections"], ["audience", "ownLanguage"],
  ["proof", "metrics"], ["proof", "cases"], ["proof", "testimonials"],
  ["campaign", "title"], ["campaign", "objective"], ["campaign", "cta"],
  ["campaign", "trafficSource"], ["campaign", "angle"],
];

export function completionScore(answers: IntakeAnswers): number {
  const completed = IMPORTANT_PATHS.filter(([section, field]) => {
    const value = (answers[section] as Record<string, unknown> | undefined)?.[field];
    return value === true || (typeof value === "number" && value > 0) || (typeof value === "string" && value.trim().length > 0);
  }).length;
  return Math.round((completed / IMPORTANT_PATHS.length) * 100);
}

export function missingHighValueFields(answers: IntakeAnswers): string[] {
  const labels: Record<string, string> = {
    "brand.story": "Historia de la marca",
    "brand.tone": "Tono de comunicación",
    "offer.mechanism": "Mecanismo diferencial",
    "offer.differentiators": "Diferenciadores",
    "offer.price": "Precio y condiciones",
    "offer.guarantee": "Garantía",
    "audience.desires": "Deseos de la audiencia",
    "audience.objections": "Objeciones",
    "audience.ownLanguage": "Frases reales de clientes",
    "proof.metrics": "Métricas o resultados",
    "proof.cases": "Casos de éxito",
    "proof.testimonials": "Testimonios",
    "campaign.angle": "Ángulo sugerido",
  };
  return Object.entries(labels).flatMap(([path, label]) => {
    const [section, field] = path.split(".") as [IntakeSection, string];
    const value = (answers[section] as Record<string, unknown> | undefined)?.[field];
    return typeof value === "string" && value.trim() ? [] : [label];
  });
}

export function validateForSubmission(answers: IntakeAnswers): string[] {
  const required: Array<[IntakeSection, string, string]> = [
    ["contact", "name", "Nombre de contacto"], ["contact", "email", "Email"],
    ["contact", "consent", "Autorización"], ["brand", "name", "Nombre de marca"],
    ["brand", "industry", "Rubro"], ["offer", "name", "Nombre de oferta"],
    ["offer", "description", "Descripción de la oferta"],
    ["audience", "primaryAvatar", "Avatar principal"], ["audience", "pains", "Dolores"],
    ["campaign", "title", "Nombre de campaña"], ["campaign", "objective", "Objetivo"],
    ["campaign", "cta", "Llamado a la acción"],
  ];
  return required.flatMap(([section, field, label]) => {
    const value = (answers[section] as Record<string, unknown> | undefined)?.[field];
    return value === true || (typeof value === "string" && value.trim().length > 0) ? [] : [label];
  });
}
