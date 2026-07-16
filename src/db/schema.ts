import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const DOCUMENT_KINDS = [
  "winning_script",
  "brief",
  "framework",
  "transcript",
  "reference",
  "learning",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const INTAKE_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "expired",
  "revoked",
] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const ASSET_STATUSES = [
  "queued",
  "processing",
  "ready",
  "needs_input",
  "failed",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const SCRIPT_FORMATS = ["vsl", "reel"] as const;
export type ScriptFormat = (typeof SCRIPT_FORMATS)[number];

export const SCRIPT_STATUSES = [
  "generating",
  "failed",
  "interrupted",
  "draft",
  "final",
  "archived",
] as const;
export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

export const VERSION_SOURCES = ["ai", "manual", "template"] as const;
export type VersionSource = (typeof VERSION_SOURCES)[number];

export const RATING_TAGS = [
  "gancho",
  "claridad",
  "prueba",
  "oferta",
  "cta",
  "flujoEmocional",
  "tono",
  "largo",
] as const;
export type RatingTag = (typeof RATING_TAGS)[number];

export const PLATFORMS = ["meta", "tiktok", "youtube", "otro"] as const;
export type MetricPlatform = (typeof PLATFORMS)[number];

export type JsonObject = Record<string, unknown>;

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brands = pgTable(
  "brands",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    industry: text("industry"),
    subindustry: text("subindustry"),
    profile: jsonb("profile").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("brands_client_idx").on(table.clientId)]
);

export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("service"),
    profile: jsonb("profile").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("offers_brand_idx").on(table.brandId)]
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    offerId: integer("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    objective: text("objective"),
    brief: jsonb("brief").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("campaigns_offer_idx").on(table.offerId)]
);

export const intakeRequests = pgTable(
  "intake_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: uuid("public_id").notNull().defaultRandom(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "set null" }),
    offerId: integer("offer_id").references(() => offers.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status").$type<IntakeStatus>().notNull().default("draft"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewStartedAt: timestamp("review_started_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("intake_requests_public_id_uq").on(table.publicId),
    uniqueIndex("intake_requests_token_hash_uq").on(table.tokenHash),
    index("intake_requests_status_idx").on(table.status),
    index("intake_requests_client_idx").on(table.clientId),
  ]
);

export const intakeSubmissions = pgTable(
  "intake_submissions",
  {
    id: serial("id").primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => intakeRequests.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    revision: integer("revision").notNull().default(0),
    answers: jsonb("answers").$type<JsonObject>().notNull().default({}),
    submittedSnapshots: jsonb("submitted_snapshots").$type<JsonObject[]>().notNull().default([]),
    completion: integer("completion").notNull().default(0),
    summary: jsonb("summary").$type<JsonObject>(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("intake_submissions_request_uq").on(table.requestId)]
);

export const sourceAssets = pgTable(
  "source_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    intakeRequestId: uuid("intake_request_id")
      .notNull()
      .references(() => intakeRequests.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url"),
    storagePath: text("storage_path"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    status: text("status").$type<AssetStatus>().notNull().default("queued"),
    extractedText: text("extracted_text").notNull().default(""),
    extractionMetadata: jsonb("extraction_metadata").$type<JsonObject>().notNull().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("source_assets_intake_idx").on(table.intakeRequestId)]
);

export const assetExtractions = pgTable(
  "asset_extractions",
  {
    id: serial("id").primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => sourceAssets.id, { onDelete: "cascade" }),
    provider: text("provider"),
    model: text("model"),
    status: text("status").$type<AssetStatus>().notNull(),
    text: text("text").notNull().default(""),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("asset_extractions_asset_idx").on(table.assetId)]
);

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "set null" }),
    offerId: integer("offer_id").references(() => offers.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    intakeRequestId: uuid("intake_request_id").references(() => intakeRequests.id, { onDelete: "set null" }),
    sourceAssetId: uuid("source_asset_id").references(() => sourceAssets.id, { onDelete: "set null" }),
    visibility: text("visibility").$type<"private" | "global" | "industry">().notNull().default("private"),
    industry: text("industry"),
    title: text("title").notNull(),
    kind: text("kind").$type<DocumentKind>().notNull(),
    filename: text("filename"),
    mimeType: text("mime_type"),
    filePath: text("file_path"),
    sourceUrl: text("source_url"),
    sourcePlatform: text("source_platform").$type<"youtube" | "instagram" | "tiktok" | "web" | "upload">(),
    sourceMetadata: jsonb("source_metadata").$type<JsonObject>().notNull().default({}),
    extractedText: text("extracted_text").notNull().default(""),
    tokenCount: integer("token_count").notNull().default(0),
    language: text("language").notNull().default("es"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    // Guion del que se promovió este documento (permite rankear ejemplares por puntuación).
    sourceScriptId: integer("source_script_id").references(() => scripts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("documents_client_idx").on(table.clientId),
    index("documents_brand_idx").on(table.brandId),
    index("documents_visibility_idx").on(table.visibility),
  ]
);

// Trabajos del analizador de referencias (extractor). Persisten desde el
// arranque para que el usuario pueda cerrar la pestaña y saber igual si el
// trabajo sigue vivo, terminó o falló.
export const ANALYSIS_JOB_STATUSES = ["processing", "ready", "failed"] as const;
export type AnalysisJobStatus = (typeof ANALYSIS_JOB_STATUSES)[number];

export const analysisJobs = pgTable(
  "analysis_jobs",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    sourceUrl: text("source_url"),
    storagePath: text("storage_path"),
    status: text("status").$type<AnalysisJobStatus>().notNull().default("processing"),
    stage: text("stage"),
    transcript: text("transcript").notNull().default(""),
    analysis: text("analysis").notNull().default(""),
    documentId: integer("document_id").references(() => documents.id, { onDelete: "set null" }),
    error: text("error"),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("analysis_jobs_status_idx").on(table.status)]
);

export const frameworks = pgTable("frameworks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  structureMd: text("structure_md").notNull(),
  format: text("format").$type<ScriptFormat>().notNull().default("vsl"),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable(
  "templates",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    format: text("format").$type<ScriptFormat>().notNull().default("vsl"),
    frameworkId: integer("framework_id").references(() => frameworks.id, { onDelete: "set null" }),
    description: text("description"),
    briefDefaults: jsonb("brief_defaults").$type<Partial<ScriptBrief>>().notNull().default({}),
    contentMd: text("content_md").notNull(),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("templates_format_idx").on(table.format)]
);

export const scripts = pgTable(
  "scripts",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "set null" }),
    offerId: integer("offer_id").references(() => offers.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    frameworkId: integer("framework_id").references(() => frameworks.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    brief: jsonb("brief").$type<ScriptBrief>().notNull(),
    format: text("format").$type<ScriptFormat>().notNull().default("vsl"),
    provider: text("provider").$type<ProviderName>().notNull().default("openrouter"),
    model: text("model").notNull(),
    status: text("status").$type<ScriptStatus>().notNull().default("draft"),
    generationError: text("generation_error"),
    generationStartedAt: timestamp("generation_started_at", { withTimezone: true }),
    generationHeartbeatAt: timestamp("generation_heartbeat_at", { withTimezone: true }),
    outcome: text("outcome").$type<"unknown" | "won" | "lost">().notNull().default("unknown"),
    outcomeNotes: text("outcome_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("scripts_client_idx").on(table.clientId)]
);

export const scriptVersions = pgTable(
  "script_versions",
  {
    id: serial("id").primaryKey(),
    scriptId: integer("script_id")
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: text("content").notNull(),
    generationParams: jsonb("generation_params").$type<GenerationParams>().notNull(),
    refinementInstruction: text("refinement_instruction"),
    source: text("source").$type<VersionSource>().notNull().default("ai"),
    usage: jsonb("usage").$type<UsageInfo | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Solo se setea cuando una edición manual coalesce sobre la misma versión.
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("script_versions_number_uq").on(table.scriptId, table.versionNumber)]
);

export const hookSets = pgTable("hook_sets", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id")
    .notNull()
    .references(() => scripts.id, { onDelete: "cascade" }),
  hooks: jsonb("hooks").$type<HookVariant[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const critiques = pgTable("critiques", {
  id: serial("id").primaryKey(),
  scriptVersionId: integer("script_version_id")
    .notNull()
    .references(() => scriptVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<CritiqueData>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scriptRatings = pgTable(
  "script_ratings",
  {
    id: serial("id").primaryKey(),
    scriptVersionId: integer("script_version_id")
      .notNull()
      .references(() => scriptVersions.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    tags: jsonb("tags").$type<RatingTag[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("script_ratings_version_uq").on(table.scriptVersionId)]
);

export const scriptMetrics = pgTable(
  "script_metrics",
  {
    id: serial("id").primaryKey(),
    scriptVersionId: integer("script_version_id")
      .notNull()
      .references(() => scriptVersions.id, { onDelete: "cascade" }),
    platform: text("platform").$type<MetricPlatform>().notNull(),
    hookRate: real("hook_rate"),
    ctr: real("ctr"),
    cpa: real("cpa"),
    impressions: integer("impressions"),
    notes: text("notes"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("script_metrics_version_platform_uq").on(table.scriptVersionId, table.platform),
  ]
);

export const industryLearnings = pgTable(
  "industry_learnings",
  {
    id: serial("id").primaryKey(),
    industry: text("industry").notNull(),
    subindustry: text("subindustry"),
    content: text("content").notNull(),
    evidenceCount: integer("evidence_count").notNull().default(1),
    sourceScriptId: integer("source_script_id").references(() => scripts.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("industry_learnings_scope_idx").on(table.industry, table.subindustry)]
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: serial("id").primaryKey(),
    intakeRequestId: uuid("intake_request_id").references(() => intakeRequests.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    providerId: text("provider_id"),
    status: text("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("email_deliveries_idempotency_uq").on(table.idempotencyKey)]
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    success: boolean("success").notNull().default(false),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_attempts_fingerprint_idx").on(table.fingerprint, table.attemptedAt)]
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Incluye proveedores históricos: guiones viejos pueden tener "anthropic"/"openai".
export type ProviderName = "anthropic" | "openai" | "openrouter";

export type ScriptBrief = {
  producto: string;
  audiencia: string;
  oferta: string;
  dolores: string;
  objeciones: string;
  duracionMin: number;
  /** Solo reels: duración objetivo en segundos (15–90). */
  duracionSeg?: number;
  /** Solo reels: plataforma de destino. */
  plataforma?: "tiktok" | "reels" | "shorts" | "";
  tono: string;
  cta: string;
  instruccionesExtra: string;
};

export type GenerationParams = {
  provider: ProviderName;
  model: string;
  documentIds: number[];
  frameworkId: number | null;
  templateId?: number;
  contextSnapshot?: {
    intakeRequestId?: string;
    brandId?: number;
    offerId?: number;
    campaignId?: number;
    sourceAssetIds?: string[];
    contextHash?: string;
    hierarchyHash?: string;
    intakeAnswersHash?: string;
    documentHashes?: Array<{ id: number; hash: string }>;
  };
};

export type UsageInfo = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export type HookVariant = { angulo: string; texto: string };

export type CritiqueData = {
  puntajes: {
    gancho: number;
    claridad: number;
    prueba: number;
    oferta: number;
    cta: number;
    flujoEmocional: number;
  };
  comentarios: {
    gancho: string;
    claridad: string;
    prueba: string;
    oferta: string;
    cta: string;
    flujoEmocional: string;
  };
  edicionesSugeridas: string[];
  veredicto: string;
};

export type Client = typeof clients.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type IntakeRequest = typeof intakeRequests.$inferSelect;
export type IntakeSubmission = typeof intakeSubmissions.$inferSelect;
export type SourceAsset = typeof sourceAssets.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Framework = typeof frameworks.$inferSelect;
export type Script = typeof scripts.$inferSelect;
export type ScriptVersion = typeof scriptVersions.$inferSelect;
export type ScriptRating = typeof scriptRatings.$inferSelect;
export type ScriptMetric = typeof scriptMetrics.$inferSelect;
export type Template = typeof templates.$inferSelect;
