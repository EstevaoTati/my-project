import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { logout } from "@/lib/actions";

// Auth par cookie + données par requête : jamais de prérendu statique.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (session?.role !== "admin") {
    redirect(locale === "fr" ? "/connexion" : `/${locale}/connexion`);
  }

  const t = await getTranslations("adminUi");
  const auth = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-night-border pb-4">
        <div className="flex items-center gap-5">
          <span className="font-display text-lg text-warmwhite">{t("title")}</span>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="text-ink-muted hover:text-warmwhite">
              {t("nav.orgs")}
            </Link>
            <Link href="/admin/onboarding" className="text-ink-muted hover:text-warmwhite">
              {t("nav.onboarding")}
            </Link>
          </nav>
        </div>
        <form action={logout}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="text-xs text-ink-muted hover:text-warmwhite">
            {auth("logout")}
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
