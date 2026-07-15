import { Resend } from "resend";
import { getDb } from "@/db";
import { emailDeliveries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolvePublicAppUrl } from "@/lib/public-url";

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

  const appUrl = resolvePublicAppUrl();
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

export async function sendRadarDigestEmail(args: {
  date: string;
  results: Array<{
    clientName: string;
    status: "ok" | "skipped" | "failed";
    angulos?: number;
  }>;
}) {
  const idempotencyKey = `radar-weekly-${args.date}`;
  const [existing] = await getDb()
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing?.status === "sent") return;

  const resend = getResend();
  const to = process.env.INTAKE_NOTIFICATION_EMAIL;
  if (!resend || !to) {
    await getDb()
      .insert(emailDeliveries)
      .values({
        intakeRequestId: null,
        kind: "radar_weekly",
        idempotencyKey,
        status: "skipped",
        error: "Resend o destinatario no configurado",
      })
      .onConflictDoNothing();
    return;
  }

  const appUrl = resolvePublicAppUrl();
  const list = args.results
    .map((result) => {
      const marker = result.status === "ok" ? "✓" : "—";
      const detail = result.status === "ok"
        ? `${result.angulos ?? 0} ángulo${result.angulos === 1 ? "" : "s"}`
        : result.status === "failed"
          ? "falló"
          : "sin novedades";
      return `<li>${marker} <strong>${escapeHtml(result.clientName)}</strong> — ${escapeHtml(detail)}</li>`;
    })
    .join("");
  const { data, error } = await resend.emails.send(
    {
      from: process.env.RESEND_FROM_EMAIL ?? "VSL Studio <onboarding@resend.dev>",
      to,
      subject: `Radar semanal — ${args.date}`,
      html: `<h1>Radar semanal — ${escapeHtml(args.date)}</h1><ul>${list}</ul><p><a href="${escapeHtml(appUrl)}/clientes">Ver clientes en VSL Studio</a></p>`,
    },
    { headers: { "Idempotency-Key": idempotencyKey } }
  );

  await getDb()
    .insert(emailDeliveries)
    .values({
      intakeRequestId: null,
      kind: "radar_weekly",
      idempotencyKey,
      providerId: data?.id,
      status: error ? "failed" : "sent",
      error: error ? JSON.stringify(error) : null,
    })
    .onConflictDoUpdate({
      target: emailDeliveries.idempotencyKey,
      set: {
        providerId: data?.id,
        status: error ? "failed" : "sent",
        error: error ? JSON.stringify(error) : null,
      },
    });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}
