import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// El probe detecta el estado "pool zombie": postgres.js no siempre nota que
// Supavisor cerró los sockets, y las queries nuevas hacen cola infinita (no
// existe timeout de adquisición). QA 2026-07-15: eso dejaba la app entera
// colgada hasta reiniciar el proceso.
const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 10_000;

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL para conectar Supabase Postgres.");

  const client = postgres(url, {
    prepare: false,
    // Supavisor (transaction mode) multiplexa del lado servidor: las
    // conexiones cliente son baratas. Con max=4 el QA concurrente saturaba
    // la cola y cualquier request quedaba esperando minutos.
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 10 * 60,
    // TCP keepalive para que los sockets que el pooler mató se detecten
    // en segundos en vez de quedar como conexiones fantasma.
    keep_alive: 30,
    connection: {
      application_name: "vsl-studio",
      statement_timeout: 12_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    },
  });
  return { client, db: drizzle(client, { schema }), probing: false, lastProbeAt: Date.now(), failedProbes: 0 };
}

// Cacheado en globalThis para sobrevivir al HMR de Next dev: sin esto, cada
// recompilación crea un pool nuevo sin cerrar el anterior y termina agotando
// el pooler de Supabase (requests que se cuelgan hasta el connect_timeout).
const globalForDb = globalThis as unknown as {
  __vslPool?: ReturnType<typeof createPool>;
};

export function getDb() {
  if (!globalForDb.__vslPool) globalForDb.__vslPool = createPool();
  const pool = globalForDb.__vslPool;
  maybeProbe(pool);
  return pool.db;
}

// Chequeo asíncrono y espaciado: si un `select 1` no responde en
// PROBE_TIMEOUT_MS dos veces seguidas asumimos pool corrupto, lo descartamos
// y forzamos su cierre. Un solo fallo puede ser una ráfaga legítima de carga;
// dos con 15s de separación ya no. Las requests encoladas en el pool viejo
// reciben error (mejor que colgarse para siempre) y las nuevas usan uno fresco.
function maybeProbe(pool: ReturnType<typeof createPool>) {
  if (pool.probing || Date.now() - pool.lastProbeAt < PROBE_INTERVAL_MS) return;
  pool.probing = true;
  pool.lastProbeAt = Date.now();
  void (async () => {
    try {
      await Promise.race([
        pool.client`select 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("db probe timeout")), PROBE_TIMEOUT_MS)
        ),
      ]);
      pool.failedProbes = 0;
      pool.probing = false;
    } catch (error) {
      pool.failedProbes += 1;
      if (pool.failedProbes < 2) {
        console.warn(`[db] probe falló (${(error as Error).message}); un fallo más recrea el pool`);
        pool.probing = false;
        return;
      }
      console.error(
        `[db] pool no responde (${(error as Error).message}); se recrea en la próxima request`
      );
      if (globalForDb.__vslPool === pool) globalForDb.__vslPool = undefined;
      void pool.client.end({ timeout: 5 }).catch(() => undefined);
    }
  })();
}

export { schema };
