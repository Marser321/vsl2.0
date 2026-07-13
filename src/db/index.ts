import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL para conectar Supabase Postgres.");

  const client = postgres(url, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 4,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 10 * 60,
    connection: {
      application_name: "vsl-studio",
      statement_timeout: 12_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    },
  });
  return drizzle(client, { schema });
}

// Cacheado en globalThis para sobrevivir al HMR de Next dev: sin esto, cada
// recompilación crea un pool nuevo sin cerrar el anterior y termina agotando
// el pooler de Supabase (requests que se cuelgan hasta el connect_timeout).
const globalForDb = globalThis as unknown as {
  __vslDb?: ReturnType<typeof createDb>;
};

export function getDb() {
  if (!globalForDb.__vslDb) globalForDb.__vslDb = createDb();
  return globalForDb.__vslDb;
}

export { schema };
