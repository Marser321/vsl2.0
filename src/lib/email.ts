import { Resend } from "resend";
import { getDb } from "@/db";
import { emailDeliveries } from "@/db/schema";
import { eq } from "drizzle-orm";

let client: Resend | null = null;

function getResend() {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) return null;
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendIntakeSubmittedEmail(args: {
  requestId: string;
  clientName: string;
  brandName: string;
  submittedAt: Date;
}) {
  const idempotencyKey = `intake-submitted-${args.requestId}`;
  const [existing] = await getDb()
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing?.status === "sent") return;

  const resend = getResend();
  const to = process.env.INTAKE_NOTIFICATION_EMAIL;
  if (!resend || !to) {
    await getDb().insert(emailDeliveries).values({
      intakeRequestId: args.requestId,
      kind: "intake_submitted",
      idempotencyKey,
      status: "skipped",
      error: "Resend o destinatario no configurado",
    }).onConflictDoNothing();
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await resend.emails.send(
    {
      from: process.env.RESEND_FROM_EMAIL ?? "VSL Studio <onboarding@resend.dev>",
      to,
      subject: `Nuevo relevamiento: ${args.brandName}`,
      html: `<h1>Nuevo relevamiento listo para revisar</h1><p>Cliente: <strong>${escapeHtml(args.clientName)}</strong></p><p>Marca: <strong>${escapeHtml(args.brandName)}</strong></p><p>Fecha: ${escapeHtml(args.submittedAt.toLocaleDateString("es-UY", { timeZone: "America/Montevideo" }))}</p><p><a href="${appUrl}/relevamientos/${args.requestId}">Abrir en VSL Studio</a></p><p>Este correo no contiene respuestas ni archivos del cliente.</p>`,
    },
    { headers: { "Idempotency-Key": idempotencyKey } }
  );

  await getDb().insert(emailDeliveries).values({
    intakeRequestId: args.requestId,
    kind: "intake_submitted",
    idempotencyKey,
    providerId: data?.id,
    status: error ? "failed" : "sent",
    error: error ? JSON.stringify(error) : null,
  }).onConflictDoUpdate({
    target: emailDeliveries.idempotencyKey,
    set: { providerId: data?.id, status: error ? "failed" : "sent", error: error ? JSON.stringify(error) : null },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}
