/** Mide cada query del endpoint de stats por separado contra Supabase. */
import { getDb } from "../src/db";
import { clients, frameworks, scriptRatings, scripts, scriptVersions } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

const db = getDb();
const nCol = sql<number>`count(*)`;
const avgCol = sql<number>`avg(${scriptRatings.score})`;

async function time<T>(label: string, fn: () => Promise<T>) {
  const t = Date.now();
  const r = await fn();
  console.log(`${label}: ${Date.now() - t}ms`, Array.isArray(r) ? `(${r.length} filas)` : "");
  return r;
}

const wonCol = sql<number>`avg(case when ${scripts.outcome} = 'won' then 1.0 else 0.0 end)`;
const base = () =>
  db
    .select({ n: nCol })
    .from(scriptRatings)
    .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
    .innerJoin(scripts, eq(scriptVersions.scriptId, scripts.id))
    .leftJoin(clients, eq(scripts.clientId, clients.id));

async function main() {
  await time("Promise.all de 4 (como el route)", () =>
    Promise.all([
      db
        .select({ frameworkId: scripts.frameworkId, name: frameworks.name, n: nCol, avgScore: avgCol, wonRate: wonCol })
        .from(scriptRatings)
        .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
        .innerJoin(scripts, eq(scriptVersions.scriptId, scripts.id))
        .leftJoin(clients, eq(scripts.clientId, clients.id))
        .leftJoin(frameworks, eq(scripts.frameworkId, frameworks.id))
        .groupBy(scripts.frameworkId, frameworks.name),
      base().groupBy(scripts.provider),
      base().groupBy(scripts.format),
      base(),
    ])
  );
  console.log("OK");
  process.exit(0);
}
main();
