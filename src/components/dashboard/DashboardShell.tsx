import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { logout } from "@/lib/actions";

interface NavItem {
  key: "overview" | "conversations" | "validation" | "reports" | "settings";
  href: string;
}

const CLIENT_NAV: NavItem[] = [
  { key: "overview", href: "/dashboard" },
  { key: "conversations", href: "/dashboard/conversations" },
  { key: "validation", href: "/dashboard/validation" },
  { key: "reports", href: "/dashboard/rapports" },
  { key: "settings", href: "/dashboard/parametres" },
];

export default function DashboardShell({
  active,
  title,
  children,
  pendingCount,
}: {
  active: NavItem["key"];
  title: string;
  children: ReactNode;
  pendingCount?: number;
}) {
  const t = useTranslations("dash.nav");
  const auth = useTranslations("auth");
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {CLIENT_NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center justify-between whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm transition-colors ${
                  item.key === active
                    ? "bg-amber/12 text-amber"
                    : "text-ink-muted hover:bg-night-card hover:text-warmwhite"
                }`}
              >
                {t(item.key)}
                {item.key === "validation" && pendingCount ? (
                  <span className="ml-2 rounded-full bg-amber px-2 py-0.5 text-xs font-semibold text-night">
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
          <form action={logout} className="mt-4 px-1">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-xs text-ink-muted hover:text-warmwhite">
              {auth("logout")}
            </button>
          </form>
        </aside>

        <main className="min-w-0 flex-1">
          <h1 className="mb-6 font-display text-2xl text-warmwhite sm:text-3xl">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
