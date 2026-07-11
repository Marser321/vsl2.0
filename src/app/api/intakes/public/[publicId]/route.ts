import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { clients, intakeRequests, intakeSubmissions, sourceAssets, type JsonObject } from "@/db/schema";
import { assertSameOrigin } from "@/lib/auth/session";
import { getSubmission, publicIntakeError, requirePublicIntake } from "@/lib/intake/access";
import { completionScore, missingHighValueFields, sectionSchemas, validateAnswerFormats, validateForSubmission, validateSection, type IntakeAnswers, type IntakeSection } from "@/lib/intake/schema";
import { generateJSON } from "@/lib/ai/structured";
import { sendIntakeSubmittedEmail } from "@/lib/email";

type Params = { params: Promise<{ publicId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { publicId } = await params;
    const request = await requirePublicIntake(publicId);
    const [submission, assets] = await Promise.all([
      getSubmission(request.id),
      getDb().select().from(sourceAssets).where(eq(sourceAssets.intakeRequestId, request.id)),
    ]);
    return NextResponse.json({
      request: { publicId: request.publicId, title: request.title, status: request.status, expiresAt: request.expiresAt },
      submission,
      assets,
      missing: missingHighValueFields(submission.answers as IntakeAnswers),
    });
  } catch (error) {
    return publicIntakeError(error);
  }
}

const saveSchema = z.object({
  section: z.enum(Object.keys(sectionSchemas) as [IntakeSection, ...IntakeSection[]]),
  data: z.unknown(),
  revision: z.number().int().nonnegative(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(req);
    const { publicId } = await params;
    const request = await requirePublicIntake(publicId);
    if (!["draft", "changes_requested"].includes(request.status)) return NextResponse.json({ error: "El relevamiento está bloqueado para revisión." }, { status: 423 });
    const parsed = saveSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos de guardado inválidos." }, { status: 400 });
    const section = validateSection(parsed.data.section, parsed.data.data);
    if (!section.success) return NextResponse.json({ error: section.error.issues[0].message, issues: section.error.issues }, { status: 400 });
    const current = await getSubmission(request.id);
    if (current.revision !== parsed.data.revision) return NextResponse.json({ error: "El relevamiento cambió en otra pestaña.", revision: current.revision, answers: current.answers }, { status: 409 });
    const answers = { ...(current.answers as JsonObject), [parsed.data.section]: section.data } as IntakeAnswers;
    const completion = completionScore(answers);
    const [saved] = await getDb().update(intakeSubmissions).set({
      answers: answers as JsonObject,
      completion,
      revision: sql`${intakeSubmissions.revision} + 1`,
      updatedAt: new Date(),
    }).where(and(eq(intakeSubmissions.requestId, request.id), eq(intakeSubmissions.revision, parsed.data.revision))).returning();
    if (!saved) return NextResponse.json({ error: "Conflicto de guardado." }, { status: 409 });
    await getDb().update(intakeRequests).set({ updatedAt: new Date() }).where(eq(intakeRequests.id, request.id));
    return NextResponse.json({ revision: saved.revision, completion, missing: missingHighValueFields(answers) });
  } catch (error) {
    return publicIntakeError(error);
  }
}

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    brandSummary: { type: "string" },
    offerSummary: { type: "string" },
    audienceSummary: { type: "string" },
    verifiedClaims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          sourceAssetIds: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["supported", "unsupported", "hypothesis"] },
        },
        required: ["claim", "sourceAssetIds", "status"],
        additionalProperties: false,
      },
    },
    hypotheses: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
  },
  required: ["brandSummary", "offerSummary", "audienceSummary", "verifiedClaims", "hypotheses", "gaps"],
  additionalProperties: false,
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(req);
    const { publicId } = await params;
    const request = await requirePublicIntake(publicId);
    if (!["draft", "changes_requested"].includes(request.status)) return NextResponse.json({ error: "El relevamiento ya fue enviado." }, { status: 409 });
    const submission = await getSubmission(request.id);
    const answers = submission.answers as IntakeAnswers;
    const formatErrors = validateAnswerFormats(answers);
    if (formatErrors.length) return NextResponse.json({ error: formatErrors[0], formatErrors }, { status: 400 });
    const missingRequired = validateForSubmission(answers);
    if (missingRequired.length) return NextResponse.json({ error: "Faltan datos esenciales.", missingRequired }, { status: 400 });
    const now = new Date();
    const [locked] = await getDb().update(intakeRequests).set({ status: "submitted", submittedAt: now, updatedAt: now })
      .where(and(eq(intakeRequests.id, request.id), eq(intakeRequests.status, request.status))).returning({ id: intakeRequests.id });
    if (!locked) return NextResponse.json({ error: "El relevamiento ya fue enviado desde otra sesión." }, { status: 409 });
    const snapshots = Array.isArray(submission.submittedSnapshots) ? submission.submittedSnapshots : [];
    await getDb().update(intakeSubmissions).set({
      submittedAt: now,
      submittedSnapshots: [...snapshots, { schemaVersion: submission.schemaVersion, revision: submission.revision, answers: answers as JsonObject, submittedAt: now.toISOString() }],
      updatedAt: now,
    }).where(eq(intakeSubmissions.requestId, request.id));

    let summary: JsonObject = {
      brandSummary: `${answers.brand?.name ?? "Marca"} · ${answers.brand?.industry ?? ""}`,
      offerSummary: answers.offer?.description ?? "",
      audienceSummary: answers.audience?.primaryAvatar ?? "",
      verifiedClaims: [], hypotheses: [], gaps: missingHighValueFields(answers),
    };
    try {
      summary = await generateJSON<JsonObject>({
        systemBlocks: [{ text: "Sos estratega de VSL. Resumí únicamente información provista. No inventes datos: separá hechos, hipótesis y faltantes.", cache: false }],
        userMessage: `Relevamiento:\n${JSON.stringify(answers)}\n\nFuentes adjuntas (citá sus IDs en cada claim): ${(await getDb().select({ id: sourceAssets.id, title: sourceAssets.title, status: sourceAssets.status, text: sourceAssets.extractedText }).from(sourceAssets).where(eq(sourceAssets.intakeRequestId, request.id))).map((asset) => `${asset.id} · ${asset.title} [${asset.status}]: ${asset.text.slice(0, 2000)}`).join("\n")}`,
        schema: SUMMARY_SCHEMA,
        maxTokens: 3000,
      });
    } catch {
      // El envío queda registrado aunque el servicio de IA no esté disponible.
    }
    await getDb().update(intakeSubmissions).set({ summary, updatedAt: new Date() }).where(eq(intakeSubmissions.requestId, request.id));
    try {
      const [client] = request.clientId ? await getDb().select({ name: clients.name }).from(clients).where(eq(clients.id, request.clientId)).limit(1) : [];
      await sendIntakeSubmittedEmail({
        requestId: request.id,
        clientName: client?.name ?? "Cliente",
        brandName: answers.brand?.name ?? request.title,
        submittedAt: now,
      });
    } catch {
      // El aviso es secundario: la entrega ya quedó persistida y visible en el panel.
    }
    return NextResponse.json({ ok: true, status: "submitted" });
  } catch (error) {
    return publicIntakeError(error);
  }
}
