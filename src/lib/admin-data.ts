import { getPrisma } from "@/lib/prisma";

/** Requêtes du back-office admin — vue santé + fiches organisation. */

export async function listOrganizationsWithHealth() {
  const prisma = getPrisma();
  if (!prisma) return [];

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      agentConfig: { select: { profession: true } },
      _count: { select: { conversations: true } },
    },
  });

  // Enrichit chaque org : taux d'escalade + brouillons en attente
  return Promise.all(
    orgs.map(async (org) => {
      const [escalated, pendingDrafts] = await Promise.all([
        prisma.conversation.count({
          where: { organizationId: org.id, status: "ESCALATED" },
        }),
        prisma.message.count({
          where: {
            status: "DRAFT",
            role: "AGENT",
            conversation: { organizationId: org.id },
          },
        }),
      ]);
      const total = org._count.conversations;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        active: org.active,
        draftMode: org.draftMode,
        profession: org.agentConfig?.profession ?? null,
        conversations: total,
        escalationRate: total ? Math.round((escalated / total) * 100) : 0,
        pendingDrafts,
      };
    }),
  );
}

export async function getOrganizationForAdmin(id: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.organization.findUnique({
    where: { id },
    include: { agentConfig: true, reports: { orderBy: [{ year: "desc" }, { month: "desc" }] } },
  });
}
