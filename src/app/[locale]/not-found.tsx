import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <section className="mwinda-glow">
      <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6">
        <p className="font-display text-6xl text-amber">404</p>
        <h1 className="mt-4 font-display text-3xl text-warmwhite">{t("title")}</h1>
        <p className="mt-3 text-ink-muted">{t("text")}</p>
        <Link href="/" className="btn-primary mt-8">
          {t("back")}
        </Link>
      </div>
    </section>
  );
}
