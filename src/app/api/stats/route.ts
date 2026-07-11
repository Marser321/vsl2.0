import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients, frameworks, scriptRatings, scripts, scriptVersions } from "@/db/schema";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { guardAdminRequest } from "@/lib/auth/session";

/**
 * Estadísticas del loop de puntuación: promedio de ★ por framework, proveedor
 * y formato (cada versión puntuada cuenta como una observación).
 */
export async function GET(req: NextRequest) {
  const guard = await guardAdminRequest();
  if (guard) return guard;
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format");
  const industry = sp.get("industry");

  const db = getDb();
  const formatCond = format === "vsl" || format === "reel" ? eq(scripts.format, format) : undefined;
  const industryCond = industry ? eq(clients.industry, industry) : undefined;
  const activeConds = [formatCond, industryCond].filter((c): c is SQL => Boolean(c));
  const where = activeConds.length ? and(...activeConds) : undefined;

  const nCol = sql<number>`count(*)`;
  const avgCol = sql<number>`avg(${scriptRatings.score})`;
  const wonCol = sql<number>`avg(case when ${scripts.outcome} = 'won' then 1.0 else 0.0 end)`;

  const [byFrameworkRaw, byProviderRaw, byFormatRaw, totalRaw] = await Promise.all([
    db
      .select({
        frameworkId: scripts.frameworkId,
        name: frameworks.name,
        n: nCol,
        avgScore: avgCol,
        wonRate: wonCol,
      })
      .from(scriptRatings)
      .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
      .innerJoin(scripts, eq(scriptVersions.scriptId, scripts.id))
      .leftJoin(clients, eq(scripts.clientId, clients.id))
      .leftJoin(frameworks, eq(scripts.frameworkId, frameworks.id))
      .where(where)
      .groupBy(scripts.frameworkId, frameworks.name),
    db
      .select({ provider: scripts.provider, n: nCol, avgScore: avgCol, wonRate: wonCol })
      .from(scriptRatings)
      .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
      .innerJoin(scripts, eq(scriptVersions.scriptId, scripts.id))
      .leftJoin(clients, eq(scripts.clientId, clients.id))
      .where(where)
      .groupBy(scripts.provider),
    // byFormat ignora el filtro de formato (compara ambos) pero respeta industry.
    db
      .select({ format: scripts.format, n: nCol, avgScore: avgCol, wonRate: wonCol })
      .from(scriptRatings)
      .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
      .innerJoin(scripts, eq(scriptVersions.scriptId, scripts.id))
      .leftJoin(clients, eq(scripts.clientId, clients.id))
      .where(industryCond)
      .groupBy(scripts.format),
    db
      .select({ n: nCol })
      .from(scriptRatings)
      .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
      .innerJoin(scripts, eq(scriptVersions.scriptId, scripts.id))
      .leftJoin(clients, eq(scripts.clientId, clients.id))
      .where(where),
  ]);

  const num = (v: unknown) => Number(v ?? 0);
  return NextResponse.json({
    totalRatings: num(totalRaw[0]?.n),
    byFramework: byFrameworkRaw.map((r) => ({
      frameworkId: r.frameworkId,
      name: r.name ?? "IA eligió estructura",
      n: num(r.n),
      avgScore: num(r.avgScore),
      wonRate: num(r.wonRate),
    })),
    byProvider: byProviderRaw.map((r) => ({
      provider: r.provider,
      n: num(r.n),
      avgScore: num(r.avgScore),
      wonRate: num(r.wonRate),
    })),
    byFormat: byFormatRaw.map((r) => ({
      format: r.format,
      n: num(r.n),
      avgScore: num(r.avgScore),
      wonRate: num(r.wonRate),
    })),
  });
}
