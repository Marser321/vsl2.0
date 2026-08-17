import { createHash } from "node:crypto";
import { getDb } from "@/db";
import {
  clients,
  brands,
  offers,
  campaigns,
  documents,
  frameworks,
  industryLearnings,
  intakeRequests,
  intakeSubmissions,
  type Document,
  type Framework,
  type ScriptBrief,
  type ScriptFormat,
} from "@/db/schema";
import { and, asc, eq, isNull, inArray, or, sql } from "drizzle-orm";
import { industrySlug } from "@/lib/industry";
import { scriptMetrics, scriptRatings, scriptVersions } from "@/db/schema";
import { getSetting } from "@/lib/settings";
import {
  compareSuggestedExemplars,
  formatPerformanceEvidence,
  isReliableMetric,
  pickBestMetric,
  type BestMetric,
} from "@/lib/scripts/quality";
import { parsePromotionTags } from "@/lib/scripts/promotions";
import type { ChatMessage, SystemBlock } from "./provider";
import {
  renderBriefMessage,
  renderClientDossier,
  renderDocument,
  renderFrameworks,
} from "./prompts";

export type BuiltContext = {
  systemBlocks: SystemBlock[];
  messages: ChatMessage[];
  totalDocTokens: number;
  includedDocumentIds: number[];
  snapshot: {
    contextHash: string;
    hierarchyHash: string;
    intakeRequestId?: string;
    intakeAnswersHash?: string;
    documentHashes: Array<{ id: number; hash: string }>;
  };
};

function contentHash(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

async function loadQualitySignals(db: ReturnType<typeof getDb>, sourceIds: number[]) {
  const avgByScript = new Map<number, number>();
  const bestMetricByScript = new Map<number, BestMetric>();
  const metricsByScript = new Map<number, BestMetric[]>();
  if (!sourceIds.length) return { avgByScript, bestMetricByScript, metricsByScript };

  const [ratingRows, metricRows] = await Promise.all([
    db
      .select({
        scriptId: scriptVersions.scriptId,
        avg: sql<number>`avg(${scriptRatings.score})`,
      })
      .from(scriptRatings)
      .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
      .where(inArray(scriptVersions.scriptId, sourceIds))
      .groupBy(scriptVersions.scriptId),
    db
      .select({
        scriptId: scriptVersions.scriptId,
        scriptVersionId: scriptVersions.id,
        versionNumber: scriptVersions.versionNumber,
        platform: scriptMetrics.platform,
        hookRate: scriptMetrics.hookRate,
        ctr: scriptMetrics.ctr,
        cpa: scriptMetrics.cpa,
        impressions: scriptMetrics.impressions,
      })
      .from(scriptMetrics)
      .innerJoin(scriptVersions, eq(scriptMetrics.scriptVersionId, scriptVersions.id))
      .where(inArray(scriptVersions.scriptId, sourceIds)),
  ]);

  for (const row of ratingRows) avgByScript.set(row.scriptId, Number(row.avg));
  for (const scriptId of sourceIds) {
    const metrics = metricRows
      .filter((row) => row.scriptId === scriptId)
      .filter(isReliableMetric)
      .map(({ scriptId: _scriptId, ...metric }) => metric);
    metricsByScript.set(scriptId, metrics);
    const best = pickBestMetric(metrics);
    if (best) bestMetricByScript.set(scriptId, best);
  }
  return { avgByScript, bestMetricByScript, metricsByScript };
}

/**
 * Documentos agnósticos de formato (`format` en null) sirven para cualquier
 * guion; los que declaran formato solo entran cuando coincide. Sin este filtro
 * un reel de 20 segundos arrastra toda la doctrina de VSL largo.
 */
function formatFilter(format: ScriptFormat) {
  return or(isNull(documents.format), eq(documents.format, format));
}

/**
 * Ensambla el prompt en orden estable→volátil para maximizar cache hits:
 *  Bloque 1 (caché, compartido entre TODOS los clientes): prompt maestro +
 *    frameworks + docs globales de tipo framework/learning.
 *  Bloque 1.5 (caché, compartido por rubro): biblioteca del vertical — la
 *    doctrina destilada de los guiones de esa industria. Va acá y no en el
 *    Bloque 1 porque el prefijo estable se comparte entre todos los clientes
 *    del mismo rubro, pero no entre rubros distintos.
 *  Bloque 2 (caché, compartido por cliente): dossier con briefs, transcripts
 *    y guiones ganadores completos.
 *  Messages (volátil): brief del wizard + historial de refinamiento.
 */
export async function buildContext(args: {
  clientId: number;
  brandId?: number | null;
  offerId?: number | null;
  campaignId?: number | null;
  frameworkId: number | null;
  documentIds: number[];
  brief: ScriptBrief;
  format?: ScriptFormat;
  history?: ChatMessage[];
}): Promise<BuiltContext> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, args.clientId))
    .limit(1);
  if (!client) throw new Error(`Cliente ${args.clientId} no encontrado`);

  const [brand, offer, campaign] = await Promise.all([
    args.brandId
      ? db.select().from(brands).where(and(eq(brands.id, args.brandId), eq(brands.clientId, args.clientId))).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    args.offerId
      ? db.select().from(offers).where(eq(offers.id, args.offerId)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    args.campaignId
      ? db.select().from(campaigns).where(eq(campaigns.id, args.campaignId)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);
  if (offer && brand && offer.brandId !== brand.id) throw new Error("La oferta no pertenece a la marca seleccionada.");
  if (campaign && offer && campaign.offerId !== offer.id) throw new Error("La campaña no pertenece a la oferta seleccionada.");

  const framework: Framework | null = args.frameworkId
    ? ((await db
        .select()
        .from(frameworks)
        .where(eq(frameworks.id, args.frameworkId))
        .limit(1))[0] ?? null)
    : null;

  const allFrameworks = await db
    .select()
    .from(frameworks)
    .orderBy(asc(frameworks.id));

  const format = args.format ?? "vsl";
  // El vertical se resuelve por la marca y cae al rubro del cliente. Es la
  // llave que une la biblioteca de industria con los aprendizajes del rubro.
  const verticalSlug = industrySlug(brand?.industry ?? client.industry);

  // Docs globales estables (frameworks/learnings) — siempre incluidos, orden determinista.
  const globalStableDocs = await db
    .select()
    .from(documents)
    .where(
      and(
        isNull(documents.clientId),
        eq(documents.visibility, "global"),
        eq(documents.isActive, true),
        inArray(documents.kind, ["framework", "learning"]),
        formatFilter(format)
      )
    )
    .orderBy(asc(documents.id));

  // Biblioteca del vertical: doctrina destilada del rubro (Bloque 1.5).
  const industryStableDocs = verticalSlug
    ? await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.visibility, "industry"),
            eq(documents.industrySlug, verticalSlug),
            eq(documents.isActive, true),
            inArray(documents.kind, ["framework", "learning"]),
            formatFilter(format)
          )
        )
        .orderBy(asc(documents.id))
    : [];

  // Docs elegidos en el wizard (del cliente y/o globales tipo winning_script, etc.)
  const selectedCandidates: Document[] = args.documentIds.length
    ? await db
        .select()
        .from(documents)
        .where(
          and(
            inArray(documents.id, args.documentIds),
            eq(documents.isActive, true)
          )
        )
        .orderBy(asc(documents.id))
    : [];
  // Aislamiento: un doc privado de otro cliente nunca entra, aunque su id venga
  // en documentIds. Los del vertical solo si son del mismo rubro que la marca.
  const selectedDocs = selectedCandidates.filter(
    (doc) =>
      doc.visibility === "global" ||
      doc.clientId === args.clientId ||
      (doc.visibility === "industry" && verticalSlug !== null && doc.industrySlug === verticalSlug)
  );

  // Match por slug normalizado: "Reparación de crédito" y "reparacion de
  // credito" son el mismo rubro. `subindustrySlug` afina sin excluir — los
  // aprendizajes generales del rubro siguen entrando.
  const subSlug = industrySlug(brand?.subindustry);
  const scopedLearnings = verticalSlug
    ? await db
        .select()
        .from(industryLearnings)
        .where(
          and(
            eq(industryLearnings.industrySlug, verticalSlug),
            eq(industryLearnings.isActive, true),
            subSlug
              ? or(isNull(industryLearnings.subindustrySlug), eq(industryLearnings.subindustrySlug, subSlug))
              : undefined
          )
        )
        .orderBy(asc(industryLearnings.id))
    : [];

  const [approvedIntake] = campaign
    ? await db.select().from(intakeRequests).where(and(eq(intakeRequests.campaignId, campaign.id), eq(intakeRequests.status, "approved"))).limit(1)
    : [];
  const [approvedSubmission] = approvedIntake
    ? await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.requestId, approvedIntake.id)).limit(1)
    : [];
  const latestSubmittedSnapshot = approvedSubmission?.submittedSnapshots.at(-1);

  // Evitar duplicados entre los bloques estables (global + vertical) y la selección.
  const stableIds = new Set([...globalStableDocs, ...industryStableDocs].map((d) => d.id));
  const dossierDocs = selectedDocs.filter((d) => !stableIds.has(d.id));
  const selectedSourceIds = [
    ...new Set(
      dossierDocs
        .filter((doc) => doc.kind === "winning_script")
        .map((doc) => doc.sourceScriptId)
        .filter((scriptId): scriptId is number => scriptId !== null)
    ),
  ];
  const selectedSignals = await loadQualitySignals(db, selectedSourceIds);
  const performanceEvidence = new Map<number, string>();
  for (const doc of dossierDocs) {
    if (doc.kind !== "winning_script" || doc.sourceScriptId === null) continue;
    const promotedVersionId = parsePromotionTags(doc.tags, doc.visibility).versionId;
    if (promotedVersionId === null) continue;
    const metric = pickBestMetric(
      (selectedSignals.metricsByScript.get(doc.sourceScriptId) ?? []).filter(
        (item) => item.scriptVersionId === promotedVersionId
      )
    );
    if (!metric) continue;
    performanceEvidence.set(
      doc.id,
      formatPerformanceEvidence({
        metric,
        avgRating: selectedSignals.avgByScript.get(doc.sourceScriptId) ?? null,
      })
    );
  }

  const block1 = [
    await getSetting("system_prompt"),
    renderFrameworks(allFrameworks),
    globalStableDocs.length
      ? `## Biblioteca global de la agencia\n\n${globalStableDocs.map((doc) => renderDocument(doc)).join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const blockVertical = industryStableDocs.length
    ? `## Doctrina del rubro: ${brand?.industry ?? client.industry}\n\n${industryStableDocs.map((doc) => renderDocument(doc)).join("\n\n")}`
    : "";

  const hierarchy = [
    brand ? `## Marca seleccionada: ${brand.name}\nRubro: ${brand.industry ?? "—"}${brand.subindustry ? ` / ${brand.subindustry}` : ""}\n${JSON.stringify(brand.profile)}` : "",
    offer ? `## Oferta seleccionada: ${offer.name}\nTipo: ${offer.type}\n${JSON.stringify(offer.profile)}` : "",
    campaign ? `## Campaña actual: ${campaign.title}\nObjetivo: ${campaign.objective ?? "—"}\n${JSON.stringify(campaign.brief)}` : "",
    scopedLearnings.length ? `## Aprendizajes anonimizados del rubro\n${scopedLearnings.map((item) => `- ${item.content}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const block2 = `${renderClientDossier(client, dossierDocs, performanceEvidence)}\n\n${hierarchy}`.trim();

  const systemBlocks: SystemBlock[] = [
    { text: block1, cache: true },
    ...(blockVertical ? [{ text: blockVertical, cache: true }] : []),
    { text: block2, cache: true },
  ];

  const messages: ChatMessage[] = [
    ...(args.history ?? []),
    ...(args.history?.length
      ? [] // en refinamiento, la instrucción ya viene en history
      : [{ role: "user" as const, content: renderBriefMessage({ brief: args.brief, framework, format: args.format }) }]),
  ];

  const included = [...globalStableDocs, ...industryStableDocs, ...dossierDocs];
  const documentHashes = included.map((document) => ({ id: document.id, hash: contentHash(document.extractedText) }));
  return {
    systemBlocks,
    messages,
    totalDocTokens: included.reduce((s, d) => s + d.tokenCount, 0),
    includedDocumentIds: included.map((d) => d.id),
    snapshot: {
      contextHash: contentHash({ systemBlocks, messages }),
      hierarchyHash: contentHash({ brand: brand?.profile, offer: offer?.profile, campaign: campaign?.brief }),
      intakeRequestId: approvedIntake?.id,
      intakeAnswersHash: latestSubmittedSnapshot ? contentHash(latestSubmittedSnapshot) : undefined,
      documentHashes,
    },
  };
}

export type SuggestedDocument = Document & {
  /** Promedio de puntuación del equipo sobre el guion de origen (si existe). */
  avgRating: number | null;
  /** Mejor hook rate real entre las versiones del guion de origen. */
  bestHookRate: number | null;
  /** Snapshot de mercado más fuerte con muestra suficiente. */
  bestMetric: BestMetric | null;
  /** Señales internas y de mercado apuntan en direcciones distintas. */
  qualityConflict: boolean;
  /** Si el wizard debe dejarlo tildado por defecto (los mal puntuados no). */
  preselect: boolean;
};

/**
 * Docs sugeridos para pre-seleccionar en el wizard: los del cliente +
 * winning_scripts globales, rankeados por la puntuación del equipo sobre el
 * guion de origen (feedback loop). Sin puntuaciones → comportamiento clásico.
 */
export async function suggestedDocuments(clientId: number): Promise<SuggestedDocument[]> {
  const db = getDb();
  const clientDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.clientId, clientId), eq(documents.isActive, true)))
    .orderBy(asc(documents.id));

  const globalWinners = await db
    .select()
    .from(documents)
    .where(
      and(
        isNull(documents.clientId),
        eq(documents.visibility, "global"),
        eq(documents.isActive, true),
        inArray(documents.kind, ["winning_script", "transcript", "reference"])
      )
    )
    .orderBy(asc(documents.id));

  // Ejemplares del rubro del cliente: el vertical se resuelve por sus marcas y
  // cae al rubro del propio cliente.
  const [client] = await db.select({ industry: clients.industry }).from(clients).where(eq(clients.id, clientId)).limit(1);
  const clientBrands = await db.select({ industry: brands.industry }).from(brands).where(eq(brands.clientId, clientId));
  const verticalSlugs = [
    ...new Set(
      [...clientBrands.map((b) => b.industry), client?.industry]
        .map(industrySlug)
        .filter((slug): slug is string => slug !== null)
    ),
  ];
  const industryDocs = verticalSlugs.length
    ? await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.visibility, "industry"),
            inArray(documents.industrySlug, verticalSlugs),
            eq(documents.isActive, true),
            inArray(documents.kind, ["winning_script", "transcript", "reference"])
          )
        )
        .orderBy(asc(documents.id))
    : [];

  const all = [...clientDocs, ...globalWinners, ...industryDocs];
  const sourceIds = [
    ...new Set(all.map((d) => d.sourceScriptId).filter((x): x is number => x !== null)),
  ];
  const signals = await loadQualitySignals(db, sourceIds);
  const enriched = all.map((document) => {
    const avgRating = document.sourceScriptId !== null
      ? (signals.avgByScript.get(document.sourceScriptId) ?? null)
      : null;
    const promotedVersionId = parsePromotionTags(document.tags, document.visibility).versionId;
    const scriptMetrics = document.sourceScriptId !== null
      ? (signals.metricsByScript.get(document.sourceScriptId) ?? [])
      : [];
    const bestMetric = promotedVersionId !== null
      ? pickBestMetric(scriptMetrics.filter((metric) => metric.scriptVersionId === promotedVersionId))
      : document.sourceScriptId !== null
        ? (signals.bestMetricByScript.get(document.sourceScriptId) ?? null)
        : null;
    const preselect = avgRating === null || avgRating >= 3;
    return {
      ...document,
      avgRating,
      bestHookRate: bestMetric?.hookRate ?? null,
      bestMetric,
      qualityConflict: avgRating !== null && avgRating < 3 && bestMetric !== null,
      preselect,
    };
  });
  const regularDocs = enriched.filter((document) => document.kind !== "winning_script");
  const exemplars = enriched
    .filter((document) => document.kind === "winning_script")
    .sort(compareSuggestedExemplars);
  return [...regularDocs, ...exemplars];
}
