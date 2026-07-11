import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL para conectar Supabase Postgres.");

  const client = postgres(url, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 2,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return drizzle(client, { schema });
}

let instance: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!instance) instance = createDb();
  return instance;
}

export { schema };
