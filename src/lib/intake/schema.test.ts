import { describe, expect, it } from "vitest";
import { completionScore, missingHighValueFields, validateForSubmission, validateSection, type IntakeAnswers } from "./schema";

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
  it("bloquea entrega sin consentimiento", () => {
    const answers = structuredClone(minimum);
    answers.contact!.consent = false as true;
    expect(validateForSubmission(answers)).toContain("Autorización");
  });
});
