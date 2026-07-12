import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, clients, documents } from "@/db/schema";
import { sendRadarDigestEmail } from "@/lib/email";
import { runRadarForClient } from "@/lib/radar/run";

// Vercel Cron usa UTC. 08:00 UTC equivale a 05:00 en Montevideo.
// En Hobby, Vercel puede cortar la ejecución antes de este máximo del plan Pro.
export const maxDuration = 300;

type Detail = {
  clientId: number;
  name: string;
  status: "ok" | "skipped" | "failed";
  message?: string;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET no está configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = getDb();
  const [allClients, brandIndustries] = await Promise.all([
    db.select().from(clients),
    db.select({ clientId: brands.clientId, industry: brands.industry }).from(brands),
  ]);
  const clientsWithBrandIndustry = new Set(
    brandIndustries
      .filter((brand) => Boolean(brand.industry?.trim()))
      .map((brand) => brand.clientId)
  );
  const eligibleClients = allClients.filter(
    (client) => Boolean(client.industry?.trim()) || clientsWithBrandIndustry.has(client.id)
  );

  const date = new Date().toISOString().slice(0, 10);
  const tag = `radar-${date}`;
  let ran = 0;
  let skipped = 0;
  let failed = 0;
  const details: Detail[] = [];
  const emailResults: Array<{
    clientName: string;
    status: "ok" | "skipped" | "failed";
    angulos?: number;
  }> = [];

  for (const client of eligibleClients) {
    try {
      const activeReferences = await db
        .select({ tags: documents.tags })
        .from(documents)
        .where(
          and(
            eq(documents.clientId, client.id),
            eq(documents.kind, "reference"),
            eq(documents.isActive, true)
          )
        );
      if (activeReferences.some((document) => document.tags.includes(tag))) {
        skipped += 1;
        details.push({ clientId: client.id, name: client.name, status: "skipped", message: "Radar de hoy ya generado" });
        emailResults.push({ clientName: client.name, status: "skipped" });
        continue;
      }

      const result = await runRadarForClient(client.id);
      if (result.ok) {
        ran += 1;
        details.push({ clientId: client.id, name: client.name, status: "ok" });
        emailResults.push({ clientName: client.name, status: "ok", angulos: result.angulos.length });
      } else if (result.reason === "sin-rubro" || result.reason === "sin-noticias") {
        skipped += 1;
        details.push({ clientId: client.id, name: client.name, status: "skipped", message: result.message });
        emailResults.push({ clientName: client.name, status: "skipped" });
      } else {
        failed += 1;
        details.push({ clientId: client.id, name: client.name, status: "failed", message: result.message });
        emailResults.push({ clientName: client.name, status: "failed" });
      }
    } catch (error) {
      failed += 1;
      const message = (error as Error).message;
      details.push({ clientId: client.id, name: client.name, status: "failed", message });
      emailResults.push({ clientName: client.name, status: "failed" });
    }
  }

  if (ran + failed > 0) {
    await sendRadarDigestEmail({ date, results: emailResults });
  }

  return Response.json({ ran, skipped, failed, details });
}
