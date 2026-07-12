import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { destroySession, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

// Auth par cookie + données par requête : jamais de prérendu statique.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const connexion = locale === "fr" ? "/connexion" : `/${locale}/connexion`;

  const session = await getSession();
  if (!session || session.role !== "client" || !session.organizationId) {
    redirect(connexion);
  }

  // Révocation immédiate : si l'organisation a été désactivée, on invalide
  // la session même si le cookie signé n'a pas encore expiré.
  const prisma = getPrisma();
  if (prisma) {
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { active: true },
    });
    if (!org?.active) {
      await destroySession();
      redirect(connexion);
    }
  }

  return children;
}
