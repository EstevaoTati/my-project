import type { MonthlyReport, PrismaClient } from "@prisma/client";
import { Resend } from "resend";

/**
 * Rapports mensuels (Phase 3) : agrégation des métriques d'un cabinet sur un
 * mois, persistance (upsert idempotent) et envoi email via Resend.
 * Déclenché le 1er du mois par /api/cron/monthly-reports, ou à la demande
 * depuis le back-office admin.
 */

export interface ReportMetrics {
  leadsCount: number;
  appointmentsCount: number;
  escalationsCount: number;
  avgResponseSeconds: number | null;
  estimatedValueCaptured: number | null;
}

export async function computeMonthlyMetrics(
  prisma: PrismaClient,
  organizationId: string,
  year: number,
  month: number, // 1-12
): Promise<ReportMetrics> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const range = { gte: start, lt: end };

  const conversations = await prisma.conversation.findMany({
    where: { organizationId, createdAt: range },
    select: {
      id: true,
      qualificationScore: true,
      status: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, createdAt: true },
      },
    },
  });

  const leadsCount = conversations.length;
  const escalationsCount = conversations.filter(
    (c) => c.status === "ESCALATED",
  ).length;

  const appointmentsCount = await prisma.appointment.count({
    where: { conversation: { organizationId }, createdAt: range },
  });

  // Temps de réponse moyen : délai prospect -> première réponse agent
  const delays: number[] = [];
  for (const convo of conversations) {
    let pendingProspectAt: Date | null = null;
    for (const msg of convo.messages) {
      if (msg.role === "PROSPECT") {
        pendingProspectAt ??= msg.createdAt;
      } else if (pendingProspectAt) {
        delays.push((msg.createdAt.getTime() - pendingProspectAt.getTime()) / 1000);
        pendingProspectAt = null;
      }
    }
  }
  const avgResponseSeconds = delays.length
    ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
    : null;

  // Valeur estimée capturée : leads qualifiés (score >= 61) × panier moyen
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { averageTicket: true },
  });
  const qualified = conversations.filter(
    (c) => (c.qualificationScore ?? 0) >= 61,
  ).length;
  const estimatedValueCaptured = org?.averageTicket
    ? qualified * org.averageTicket
    : null;

  return {
    leadsCount,
    appointmentsCount,
    escalationsCount,
    avgResponseSeconds,
    estimatedValueCaptured,
  };
}

export async function generateMonthlyReport(
  prisma: PrismaClient,
  organizationId: string,
  year: number,
  month: number,
  options: { sendEmail?: boolean } = {},
): Promise<MonthlyReport> {
  const metrics = await computeMonthlyMetrics(prisma, organizationId, year, month);

  const report = await prisma.monthlyReport.upsert({
    where: {
      organizationId_year_month: { organizationId, year, month },
    },
    create: { organizationId, year, month, ...metrics },
    update: { ...metrics },
  });

  if (options.sendEmail) {
    await sendReportEmail(prisma, report).catch((err) => {
      // L'échec d'email ne doit pas invalider le rapport généré
      console.error("[reports] Échec d'envoi du rapport :", err);
    });
  }
  return report;
}

async function sendReportEmail(
  prisma: PrismaClient,
  report: MonthlyReport,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[reports] RESEND_API_KEY absente — rapport non envoyé par email.");
    return;
  }
  const org = await prisma.organization.findUnique({
    where: { id: report.organizationId },
    select: { name: true, contactEmail: true },
  });
  if (!org) return;

  const from =
    process.env.LEAD_FROM_EMAIL ?? "Mwinda Digital <onboarding@resend.dev>";
  const resend = new Resend(apiKey);
  const monthLabel = `${String(report.month).padStart(2, "0")}/${report.year}`;
  const fmt = (n: number | null, suffix = "") => (n == null ? "—" : `${n}${suffix}`);

  const { error } = await resend.emails.send({
    from,
    to: org.contactEmail,
    subject: `[Mwinda] Rapport mensuel ${monthLabel} — ${org.name}`,
    html: `
      <h2>Rapport mensuel ${monthLabel} — ${org.name}</h2>
      <table cellpadding="8" style="border-collapse:collapse">
        <tr><td style="border:1px solid #ddd">Leads reçus</td><td style="border:1px solid #ddd"><b>${report.leadsCount}</b></td></tr>
        <tr><td style="border:1px solid #ddd">Rendez-vous proposés</td><td style="border:1px solid #ddd"><b>${report.appointmentsCount}</b></td></tr>
        <tr><td style="border:1px solid #ddd">Escalades vers l'humain</td><td style="border:1px solid #ddd"><b>${report.escalationsCount}</b></td></tr>
        <tr><td style="border:1px solid #ddd">Temps de réponse moyen</td><td style="border:1px solid #ddd"><b>${fmt(report.avgResponseSeconds, " s")}</b></td></tr>
        <tr><td style="border:1px solid #ddd">Valeur estimée capturée</td><td style="border:1px solid #ddd"><b>${fmt(report.estimatedValueCaptured, " $")}</b></td></tr>
      </table>
      <p>Le détail complet est disponible dans votre tableau de bord Mwinda Digital.</p>`,
  });
  if (error) throw error;

  await prisma.monthlyReport.update({
    where: { id: report.id },
    data: { sentAt: new Date() },
  });
}
