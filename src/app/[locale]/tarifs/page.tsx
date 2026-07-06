import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.pricing" });
  return { title: t("title"), description: t("description") };
}

const TIER_KEYS = ["essential", "pro", "firm"] as const;
const ROW_KEYS = [
  "conversations",
  "languages",
  "channels",
  "calendar",
  "draft",
  "report",
  "seats",
  "tone",
  "support",
] as const;

function PricingContent() {
  const t = useTranslations("pricing");

  return (
    <>
      <section className="mwinda-glow">
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-20 text-center sm:px-6">
          <h1 className="font-display text-4xl text-warmwhite sm:text-5xl">
            <span className="text-gradient-light">{t("hero.title")}</span>
          </h1>
          <p className="mt-5 text-ink-muted sm:text-lg">{t("hero.subtitle")}</p>
        </div>
      </section>

      {/* Démarrage */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h2 className="font-display text-2xl text-warmwhite">{t("setup.title")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(["diagnostic", "install"] as const).map((key) => (
            <article key={key} className="card p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-amber">
                  {t(`setup.${key}.name`)}
                </h3>
                <p className="font-display text-2xl text-warmwhite">{t(`setup.${key}.price`)}</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {t(`setup.${key}.text`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Paliers */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="font-display text-2xl text-warmwhite">{t("tiers.title")}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {TIER_KEYS.map((key) => {
            const isPro = key === "pro";
            return (
              <article
                key={key}
                className={`card relative flex flex-col p-6 ${
                  isPro ? "border-amber/50 shadow-[0_0_40px_rgba(245,166,35,0.12)]" : ""
                }`}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber px-3 py-1 text-xs font-semibold text-night">
                    {t("tiers.pro.badge")}
                  </span>
                )}
                <h3 className="text-sm font-semibold uppercase tracking-wider text-amber">
                  {t(`tiers.${key}.name`)}
                </h3>
                <p className="mt-3 font-display text-4xl text-warmwhite">
                  {t(`tiers.${key}.price`)}
                  <span className="ml-1 text-sm text-ink-muted">{t(`tiers.${key}.unit`)}</span>
                </p>
                <p className="mt-2 flex-1 text-sm text-ink-muted">{t(`tiers.${key}.tagline`)}</p>
                <Link
                  href="/contact"
                  className={`${isPro ? "btn-primary" : "btn-secondary"} mt-6 w-full text-sm`}
                >
                  {t(`tiers.${key}.cta`)}
                </Link>
              </article>
            );
          })}
        </div>

        {/* Tableau comparatif — scroll horizontal sur mobile */}
        <div className="mt-10 overflow-x-auto rounded-2xl border border-night-border">
          <table className="w-full min-w-[640px] border-collapse bg-night-card text-sm">
            <thead>
              <tr className="border-b border-night-border text-left">
                <th className="px-5 py-4 font-semibold text-ink-muted">{t("table.feature")}</th>
                {TIER_KEYS.map((key) => (
                  <th key={key} className="px-5 py-4 font-semibold text-warmwhite">
                    {t(`tiers.${key}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_KEYS.map((row, i) => (
                <tr
                  key={row}
                  className={i % 2 === 0 ? "bg-night/40" : ""}
                >
                  <td className="px-5 py-3.5 text-ink-muted">{t(`table.rows.${row}.label`)}</td>
                  {TIER_KEYS.map((tier) => {
                    const value = t(`table.rows.${row}.${tier}`);
                    return (
                      <td
                        key={tier}
                        className={`px-5 py-3.5 ${value === "✓" ? "text-emerald-pos" : "text-ink"}`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Garantie */}
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="card border-emerald-pos/30 p-7 text-center">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-pos shadow-[0_0_12px_rgba(45,212,167,0.7)]" />
          <h2 className="mt-3 font-display text-2xl text-warmwhite">{t("guarantee.title")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("guarantee.text")}</p>
        </div>
      </section>

      <section className="mwinda-glow border-t border-night-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-3xl text-warmwhite">{t("cta.title")}</h2>
          <Link href="/contact" className="btn-primary mt-7">
            {t("cta.cta")}
          </Link>
        </div>
      </section>
    </>
  );
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PricingContent />;
}
