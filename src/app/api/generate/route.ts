import { NextRequest } from "next/server";
import { getDb } from "@/db";
import { scripts, scriptVersions } from "@/db/schema";
import { z } from "zod";
import { buildContext } from "@/lib/ai/context-builder";
import { getProvider, type ProviderName } from "@/lib/ai/provider";
import { getSetting } from "@/lib/settings";
import { guardAdminRequest } from "@/lib/auth/session";

export const maxDuration = 60;

const generateSchema = z.object({
  clientId: z.number(),
  brandId: z.number().nullable().optional(),
  offerId: z.number().nullable().optional(),
  campaignId: z.number().nullable().optional(),
  frameworkId: z.number().nullable(),
  documentIds: z.array(z.number()),
  title: z.string().min(1),
  provider: z.enum(["anthropic", "openai", "openrouter"]).optional(),
  model: z.string().optional(),
  brief: z.object({
    producto: z.string().min(1),
    audiencia: z.string().min(1),
    oferta: z.string().min(1),
    dolores: z.string().min(1),
    objeciones: z.string().default(""),
    duracionMin: z.number().min(1).max(60),
    tono: z.string().default(""),
    cta: z.string().min(1),
    instruccionesExtra: z.string().default(""),
  }),
});

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const parsed = generateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, path: parsed.error.issues[0].path },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const providerName: ProviderName =
    input.provider ?? (await getSetting("default_provider", "anthropic") as ProviderName);
  const model =
    input.model ??
    await getSetting(
      providerName === "anthropic"
        ? "default_model_anthropic"
        : providerName === "openai"
          ? "default_model_openai"
          : "default_model_openrouter",
      providerName === "openrouter" ? "openrouter/ensemble-5+1" : "claude-opus-4-8"
    );

  let context;
  try {
    context = await buildContext({
      clientId: input.clientId,
      brandId: input.brandId,
      offerId: input.offerId,
      campaignId: input.campaignId,
      frameworkId: input.frameworkId,
      documentIds: input.documentIds,
      brief: input.brief,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sse(data)));
      try {
        const provider = await getProvider(providerName);
        let content = "";
        for await (const delta of provider.generateStream({
          model,
          systemBlocks: context.systemBlocks,
          messages: context.messages,
          maxTokens: 64000,
          onStatus: (status) => send({ type: "status", ...status }),
        })) {
          content += delta;
          send({ type: "delta", text: delta });
        }

        const usage = provider.getFinalUsage();

        // Persistir script + versión 1
        const db = getDb();
        const [script] = await db
          .insert(scripts)
          .values({
            clientId: input.clientId,
            brandId: input.brandId ?? null,
            offerId: input.offerId ?? null,
            campaignId: input.campaignId ?? null,
            frameworkId: input.frameworkId,
            title: input.title,
            brief: input.brief,
            provider: providerName,
            model,
          })
          .returning();

        const [version] = await db
          .insert(scriptVersions)
          .values({
            scriptId: script.id,
            versionNumber: 1,
            content,
            generationParams: {
              provider: providerName,
              model,
              documentIds: context.includedDocumentIds,
              frameworkId: input.frameworkId,
              contextSnapshot: {
                ...context.snapshot,
                brandId: input.brandId ?? undefined,
                offerId: input.offerId ?? undefined,
                campaignId: input.campaignId ?? undefined,
              },
            },
            usage,
          })
          .returning();

        send({ type: "done", scriptId: script.id, versionId: version.id, usage });
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
