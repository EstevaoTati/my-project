import { getPrisma } from "@/lib/prisma";

/** Requêtes partagées du dashboard client. Renvoient des valeurs neutres
 *  quand DATABASE_URL est absente (déploiement sans base). */

export async function getOrganizationOverview(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return null;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [org, leadsThisMonth, appointmentsThisMonth, pendingDrafts, escalated, convos] =
    await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, averageTicket: true, draftMode: true },
      }),
      prisma.conversation.count({
        where: { organizationId, createdAt: { gte: monthStart } },
      }),
      prisma.appointment.count({
        where: {
          conversation: { organizationId },
          createdAt: { gte: monthStart },
        },
      }),
      prisma.message.count({
        where: {
          status: "DRAFT",
          role: "AGENT",
          conversation: { organizationId },
        },
      }),
      prisma.conversation.count({
        where: { organizationId, status: "ESCALATED" },
      }),
      prisma.conversation.findMany({
        where: { organizationId, createdAt: { gte: monthStart } },
        select: {
          qualificationScore: true,
          messages: {
            orderBy: { createdAt: "asc" },
            select: { role: true, createdAt: true },
          },
        },
      }),
    ]);

  // Temps de réponse moyen (prospect -> première réponse agent/humain)
  const delays: number[] = [];
  for (const c of convos) {
    let pending: Date | null = null;
    for (const m of c.messages) {
      if (m.role === "PROSPECT") pending ??= m.createdAt;
      else if (pending) {
        delays.push((m.createdAt.getTime() - pending.getTime()) / 1000);
        pending = null;
      }
    }
  }
  const avgResponseSeconds = delays.length
    ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
    : null;

  const qualified = convos.filter((c) => (c.qualificationScore ?? 0) >= 61).length;
  const capturedValue = org?.averageTicket ? qualified * org.averageTicket : null;

  return {
    name: org?.name ?? "",
    draftMode: org?.draftMode ?? true,
    leadsThisMonth,
    appointmentsThisMonth,
    pendingDrafts,
    escalated,
    avgResponseSeconds,
    capturedValue,
    hasTicket: Boolean(org?.averageTicket),
  };
}

export async function listConversations(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.conversation.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { messages: true } } },
  });
}

export async function getConversation(organizationId: string, id: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.conversation.findFirst({
    where: { id, organizationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      appointment: true,
    },
  });
}

export async function listPendingDrafts(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.message.findMany({
    where: { status: "DRAFT", role: "AGENT", conversation: { organizationId } },
    orderBy: { createdAt: "asc" },
    include: {
      conversation: {
        select: { id: true, prospectName: true, prospectEmail: true },
      },
    },
  });
}

export async function listReports(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.monthlyReport.findMany({
    where: { organizationId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getSettings(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: { agentConfig: true },
  });
}
