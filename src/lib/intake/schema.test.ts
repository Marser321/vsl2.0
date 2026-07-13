import { describe, expect, it } from "vitest";
import { completionScore, missingHighValueFields, validateAnswerFormats, validateForSubmission, validateSection, type IntakeAnswers } from "./schema";

const minimum: IntakeAnswers = {
  contact: { name: "Ana Pérez", role: "CMO", email: "ana@example.com", phone: "", consent: true },
  brand: { name: "Marca", website: "", socialLinks: [], country: "", market: "", language: "Español LATAM", industry: "Educación", subindustry: "", story: "", purpose: "", values: "", personality: "", tone: "", preferredExpressions: "", forbiddenExpressions: "" },
  offer: { name: "Programa", type: "course", description: "Programa para lograr un resultado concreto", mechanism: "", benefits: "", differentiators: "", price: "", paymentOptions: "", bonuses: "", guarantee: "", delivery: "", availability: "", urgency: "", serviceProcess: "", courseModules: "", ecommerceSpecs: "", saasFeatures: "", localCoverage: "" },
  audience: { primaryAvatar: "Profesionales que buscan crecer", secondaryAvatar: "", awareness: "", pains: "No consiguen resultados sostenidos", desires: "", previousAttempts: "", objections: "", triggers: "", ownLanguage: "", alternatives: "", competitors: "" },
  proof: { founderStory: "", experience: "", metrics: "", cases: "", testimonials: "", claimSources: "", certifications: "", legalRestrictions: "" },
  campaign: { title: "Campaña uno", objective: "Conseguir llamadas calificadas", trafficSource: "", funnelStage: "", durationMinutes: 10, cta: "Agendá una llamada", angle: "", format: "", deadline: "", mustInclude: "", mustAvoid: "" },
  notes: { additionalContext: "" },
};

describe("intake schema", () => {
  it("permite autosave parcial", () => {
    expect(validateSection("brand", { name: "Marca" }).success).toBe(true);
  });
  it("acepta el mínimo de entrega y reporta mejoras opcionales", () => {
    expect(validateForSubmission(minimum)).toEqual([]);
    expect(missingHighValueFields(minimum)).toContain("Mecanismo diferencial");
    expect(completionScore(minimum)).toBeGreaterThan(30);
  });
  it("no bloquea el envío por URLs incompletas en la marca", () => {
    const answers = structuredClone(minimum);
    answers.brand!.website = "instagram.com/marca";
    answers.brand!.socialLinks = ["tiktok.com/@marca", "no es una url"];
    expect(validateAnswerFormats(answers)).toEqual([]);
  });
  it("no arroja errores de formato por campos ausentes o breves", () => {
    // Simula lo que envía el wizard con una sección casi vacía: solo el
    // formato importa aquí, la completitud la reporta validateForSubmission.
    const answers: IntakeAnswers = { audience: { primaryAvatar: "corto" } as IntakeAnswers["audience"] };
    expect(validateAnswerFormats(answers)).toEqual([]);
    expect(validateForSubmission(answers)).toContain("Dolores");
  });
  it("bloquea entrega sin consentimiento", () => {
    const answers = structuredClone(minimum);
    answers.contact!.consent = false as true;
    expect(validateForSubmission(answers)).toContain("Autorización");
  });
});
