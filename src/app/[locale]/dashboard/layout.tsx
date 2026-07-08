import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth";

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

  const session = await getSession();
  if (!session || session.role !== "client" || !session.organizationId) {
    redirect(locale === "fr" ? "/connexion" : `/${locale}/connexion`);
  }

  return children;
}
