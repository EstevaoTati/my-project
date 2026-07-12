import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const verticals = useTranslations("verticals");

  return (
    <footer className="border-t border-night-border bg-night-soft">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-lg text-warmwhite">
            Mwinda <span className="text-amber">Digital</span>
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            {t("tagline")}
          </p>
          <p className="mt-4 text-xs text-ink-muted">{t("company")}</p>
        </div>

        <nav aria-label={t("linksTitle")}>
          <p className="text-sm font-semibold text-warmwhite">{t("linksTitle")}</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link className="hover:text-warmwhite" href="/">{nav("home")}</Link></li>
            <li><Link className="hover:text-warmwhite" href="/comment-ca-marche">{nav("how")}</Link></li>
            <li><Link className="hover:text-warmwhite" href="/tarifs">{nav("pricing")}</Link></li>
            <li><Link className="hover:text-warmwhite" href="/sandbox">{nav("sandbox")}</Link></li>
            <li><Link className="hover:text-warmwhite" href="/contact">{nav("contact")}</Link></li>
          </ul>
        </nav>

        <nav aria-label={t("verticalsTitle")}>
          <p className="text-sm font-semibold text-warmwhite">{t("verticalsTitle")}</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link className="hover:text-warmwhite" href="/metiers/impots">{verticals("tax.name")}</Link></li>
            <li><Link className="hover:text-warmwhite" href="/metiers/immigration">{verticals("immigration.name")}</Link></li>
            <li><Link className="hover:text-warmwhite" href="/metiers/assurance">{verticals("insurance.name")}</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-night-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-pos" />
            {t("privacy")}
          </p>
          <p>
            © {new Date().getFullYear()} Mwinda Group LLC. {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
