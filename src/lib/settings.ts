import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await getDb().select().from(settings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
