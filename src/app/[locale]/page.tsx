import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PainCalculator from "@/components/home/PainCalculator";
import Faq from "@/components/home/Faq";
import HeroVisual from "@/components/home/HeroVisual";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.home" });
  return { title: t("title"), description: t("description") };
}

const FLOW_KEYS = ["inquiry", "agent", "qualify", "booking", "report"] as const;
const TESTIMONIAL_KEYS = ["t1", "t2", "t3"] as const;

function HomeContent() {
  const t = useTranslations("home");

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mwinda-glow overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
          <div className="text-center lg:text-left">
            <p className="fade-up text-sm font-medium uppercase tracking-[0.2em] text-amber">
              {t("hero.eyebrow")}
            </p>
            <h1 className="fade-up-delay-1 mt-5 font-display text-4xl leading-tight text-warmwhite sm:text-6xl">
              <span className="text-gradient-light">{t("hero.title")}</span>
            </h1>
            <p className="fade-up-delay-2 mt-6 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg lg:mx-0 mx-auto">
              {t("hero.subtitle")}
            </p>
            <div className="fade-up-delay-2 mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/contact" className="btn-primary w-full sm:w-auto">
                {t("hero.cta")}
              </Link>
              <Link href="/sandbox" className="btn-secondary w-full sm:w-auto">
                {t("hero.ctaSecondary")}
              </Link>
            </div>
          </div>
          <div className="fade-up-delay-2 flex justify-center">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ── Calculateur de douleur ───────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-3xl text-warmwhite sm:text-4xl">
          {t("painCalc.title")}
        </h2>
        <p className="mt-3 text-center text-ink-muted">{t("painCalc.subtitle")}</p>
        <div className="mt-8">
          <PainCalculator />
        </div>
      </section>

      {/* ── Flux visuel ──────────────────────────────────────── */}
      <section className="border-y border-night-border bg-night-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-display text-3xl text-warmwhite sm:text-4xl">
            {t("flow.title")}
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {FLOW_KEYS.map((key, i) => (
              <li key={key} className="card relative p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/15 font-display text-sm text-amber">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-warmwhite">
                  {t(`flow.steps.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {t(`flow.steps.${key}.text`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Les 3 briques ────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-3xl text-warmwhite sm:text-4xl">
          {t("offer.title")}
        </h2>
        <p className="mt-3 text-center text-ink-muted">{t("offer.subtitle")}</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {(["diagnostic", "install", "subscription"] as const).map((key) => (
            <article key={key} className="card flex flex-col p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber">
                {t(`offer.${key}.name`)}
              </h3>
              <p className="mt-3 font-display text-3xl text-warmwhite">
                {t(`offer.${key}.price`)}
                <span className="ml-1 text-sm text-ink-muted">{t(`offer.${key}.unit`)}</span>
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-muted">
                {t(`offer.${key}.text`)}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/tarifs" className="btn-secondary">
            {t("offer.cta")}
          </Link>
        </div>
      </section>

      {/* ── Témoignages ──────────────────────────────────────── */}
      <section className="border-y border-night-border bg-night-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-display text-3xl text-warmwhite sm:text-4xl">
            {t("testimonials.title")}
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIAL_KEYS.map((key) => (
              <figure key={key} className="card flex flex-col p-6">
                <blockquote className="flex-1 text-sm leading-relaxed text-ink">
                  « {t(`testimonials.items.${key}.quote`)} »
                </blockquote>
                <figcaption className="mt-5 border-t border-night-border pt-4">
                  <p className="text-sm font-semibold text-warmwhite">
                    {t(`testimonials.items.${key}.name`)}
                  </p>
                  <p className="text-xs text-ink-muted">{t(`testimonials.items.${key}.role`)}</p>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-ink-muted">
            {t("testimonials.disclaimer")}
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-3xl text-warmwhite sm:text-4xl">
          {t("faq.title")}
        </h2>
        <div className="mt-8">
          <Faq />
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────── */}
      <section className="mwinda-glow border-t border-night-border">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl text-warmwhite sm:text-4xl">
            {t("finalCta.title")}
          </h2>
          <p className="mt-4 text-ink-muted">{t("finalCta.text")}</p>
          <Link href="/contact" className="btn-primary mt-8">
            {t("finalCta.cta")}
          </Link>
        </div>
      </section>
    </>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeContent />;
}
