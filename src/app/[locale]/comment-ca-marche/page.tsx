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
  const t = await getTranslations({ locale, namespace: "meta.how" });
  return { title: t("title"), description: t("description") };
}

const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;
const GUARDRAIL_KEYS = ["g1", "g2", "g3", "g4", "g5", "g6"] as const;
const SECURITY_KEYS = ["s1", "s2", "s3"] as const;

function HowContent() {
  const t = useTranslations("how");

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

      {/* Les 5 étapes */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl text-warmwhite">{t("steps.title")}</h2>
        <ol className="mt-8 space-y-4">
          {STEP_KEYS.map((key, i) => (
            <li key={key} className="card flex gap-5 p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber/15 font-display text-lg text-amber">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-warmwhite">{t(`steps.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {t(`steps.${key}.text`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Garde-fous */}
      <section className="border-y border-night-border bg-night-soft">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-3xl text-warmwhite">{t("guardrails.title")}</h2>
          <p className="mt-3 max-w-2xl text-ink-muted">{t("guardrails.subtitle")}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUARDRAIL_KEYS.map((key) => (
              <article key={key} className="card p-5">
                <span aria-hidden className="text-amber">◆</span>
                <h3 className="mt-3 text-sm font-semibold text-warmwhite">
                  {t(`guardrails.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {t(`guardrails.${key}.text`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Sécurité */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl text-warmwhite">{t("security.title")}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SECURITY_KEYS.map((key) => (
            <article key={key} className="card border-emerald-pos/20 p-5">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-emerald-pos" />
              <h3 className="mt-3 text-sm font-semibold text-warmwhite">
                {t(`security.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {t(`security.${key}.text`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mwinda-glow border-t border-night-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-3xl text-warmwhite">{t("cta.title")}</h2>
          <p className="mt-4 text-ink-muted">{t("cta.text")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sandbox" className="btn-primary w-full sm:w-auto">
              {t("cta.ctaPrimary")}
            </Link>
            <Link href="/contact" className="btn-secondary w-full sm:w-auto">
              {t("cta.ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export default async function HowPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HowContent />;
}
