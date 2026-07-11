import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { getDb } from "../src/db";
import {
  clients,
  critiques,
  documents,
  frameworks,
  hookSets,
  scripts,
  scriptVersions,
  settings,
  type CritiqueData,
  type GenerationParams,
  type HookVariant,
  type ProviderName,
  type ScriptBrief,
  type UsageInfo,
} from "../src/db/schema";
import { getSupabaseAdmin, INTAKE_BUCKET } from "../src/lib/supabase";

const sqlitePath = process.env.SQLITE_SOURCE_PATH ?? path.join(process.cwd(), "data", "vsl.db");
if (!fs.existsSync(sqlitePath)) throw new Error(`No existe ${sqlitePath}`);
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");

const sqlite = new Database(sqlitePath, { readonly: true });
const db = getDb();

function rows(table: string): Record<string, unknown>[] {
  const exists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  return exists ? sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[] : [];
}

function json<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function date(value: unknown): Date {
  const parsed = value ? new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z")) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function migrate() {
  const counts: Record<string, number> = {};
  const clientRows = rows("clients");
  for (const row of clientRows) {
    await db.insert(clients).values({
      id: Number(row.id), name: String(row.name), industry: row.industry ? String(row.industry) : null,
      description: row.description ? String(row.description) : null, notes: row.notes ? String(row.notes) : null,
      createdAt: date(row.created_at), updatedAt: date(row.updated_at),
    }).onConflictDoUpdate({ target: clients.id, set: { name: String(row.name), industry: row.industry ? String(row.industry) : null, description: row.description ? String(row.description) : null, notes: row.notes ? String(row.notes) : null, updatedAt: date(row.updated_at) } });
  }
  counts.clients = clientRows.length;

  const frameworkRows = rows("frameworks");
  for (const row of frameworkRows) {
    await db.insert(frameworks).values({
      id: Number(row.id), name: String(row.name), slug: String(row.slug), description: row.description ? String(row.description) : null,
      structureMd: String(row.structure_md), isBuiltin: Boolean(row.is_builtin), createdAt: date(row.created_at),
    }).onConflictDoUpdate({ target: frameworks.id, set: { name: String(row.name), slug: String(row.slug), description: row.description ? String(row.description) : null, structureMd: String(row.structure_md), isBuiltin: Boolean(row.is_builtin) } });
  }
  counts.frameworks = frameworkRows.length;

  const settingRows = rows("settings");
  for (const row of settingRows) await db.insert(settings).values({ key: String(row.key), value: String(row.value) }).onConflictDoUpdate({ target: settings.key, set: { value: String(row.value) } });
  counts.settings = settingRows.length;

  const documentRows = rows("documents");
  for (const row of documentRows) {
    let storagePath: string | null = null;
    const localPath = row.file_path ? String(row.file_path) : "";
    if (localPath && fs.existsSync(localPath) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      storagePath = `library/migrated/${row.id}/${path.basename(localPath)}`;
      const { error } = await getSupabaseAdmin().storage.from(INTAKE_BUCKET).upload(storagePath, fs.readFileSync(localPath), { contentType: row.mime_type ? String(row.mime_type) : undefined, upsert: true });
      if (error) throw new Error(`Upload ${localPath}: ${error.message}`);
    }
    await db.insert(documents).values({
      id: Number(row.id), clientId: row.client_id == null ? null : Number(row.client_id), visibility: row.client_id == null ? "global" : "private",
      title: String(row.title), kind: String(row.kind) as typeof documents.$inferInsert.kind,
      filename: row.filename ? String(row.filename) : null, mimeType: row.mime_type ? String(row.mime_type) : null,
      filePath: storagePath, extractedText: String(row.extracted_text ?? ""), tokenCount: Number(row.token_count ?? 0),
      language: String(row.language ?? "es"), tags: json<string[]>(row.tags, []), isActive: Boolean(row.is_active), createdAt: date(row.created_at),
    }).onConflictDoUpdate({ target: documents.id, set: { clientId: row.client_id == null ? null : Number(row.client_id), visibility: row.client_id == null ? "global" : "private", title: String(row.title), extractedText: String(row.extracted_text ?? ""), tokenCount: Number(row.token_count ?? 0), filePath: storagePath } });
  }
  counts.documents = documentRows.length;

  const scriptRows = rows("scripts");
  for (const row of scriptRows) {
    await db.insert(scripts).values({
      id: Number(row.id), clientId: Number(row.client_id), frameworkId: row.framework_id == null ? null : Number(row.framework_id),
      title: String(row.title), brief: json<ScriptBrief>(row.brief, {} as ScriptBrief), provider: String(row.provider) as ProviderName,
      model: String(row.model), status: String(row.status) as "draft" | "final" | "archived", outcome: String(row.outcome) as "unknown" | "won" | "lost",
      outcomeNotes: row.outcome_notes ? String(row.outcome_notes) : null, createdAt: date(row.created_at), updatedAt: date(row.updated_at),
    }).onConflictDoUpdate({ target: scripts.id, set: { title: String(row.title), brief: json<ScriptBrief>(row.brief, {} as ScriptBrief), status: String(row.status) as "draft" | "final" | "archived", outcome: String(row.outcome) as "unknown" | "won" | "lost", outcomeNotes: row.outcome_notes ? String(row.outcome_notes) : null } });
  }
  counts.scripts = scriptRows.length;

  const versionRows = rows("script_versions");
  for (const row of versionRows) {
    await db.insert(scriptVersions).values({
      id: Number(row.id), scriptId: Number(row.script_id), versionNumber: Number(row.version_number), content: String(row.content),
      generationParams: json<GenerationParams>(row.generation_params, {} as GenerationParams), refinementInstruction: row.refinement_instruction ? String(row.refinement_instruction) : null,
      usage: json<UsageInfo | null>(row.usage, null), createdAt: date(row.created_at),
    }).onConflictDoUpdate({ target: scriptVersions.id, set: { content: String(row.content), generationParams: json<GenerationParams>(row.generation_params, {} as GenerationParams), usage: json<UsageInfo | null>(row.usage, null) } });
  }
  counts.scriptVersions = versionRows.length;

  const hookRows = rows("hook_sets");
  for (const row of hookRows) await db.insert(hookSets).values({ id: Number(row.id), scriptId: Number(row.script_id), hooks: json<HookVariant[]>(row.hooks, []), createdAt: date(row.created_at) }).onConflictDoNothing();
  counts.hookSets = hookRows.length;

  const critiqueRows = rows("critiques");
  for (const row of critiqueRows) await db.insert(critiques).values({ id: Number(row.id), scriptVersionId: Number(row.script_version_id), data: json<CritiqueData>(row.data, {} as CritiqueData), createdAt: date(row.created_at) }).onConflictDoNothing();
  counts.critiques = critiqueRows.length;

  for (const table of ["clients", "frameworks", "documents", "scripts", "script_versions", "hook_sets", "critiques"]) {
    await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`));
  }

  console.table(counts);
  console.log("Migración idempotente completada.");
}

migrate().finally(() => sqlite.close()).catch((error) => { console.error(error); process.exitCode = 1; });
