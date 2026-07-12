import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// slug d'URL (FR, stable) → clé de traduction
const VERTICALS = {
  impots: "tax",
  immigration: "immigration",
  assurance: "insurance",
} as const;

type Slug = keyof typeof VERTICALS;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    Object.keys(VERTICALS).map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!(slug in VERTICALS)) return {};
  const key = VERTICALS[slug as Slug];
  const t = await getTranslations({ locale, namespace: "verticals" });
  return {
    title: `${t(`${key}.name`)} — Mwinda Digital`,
    description: t(`${key}.pain`),
  };
}

export default async function VerticalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!(slug in VERTICALS)) notFound();
  const key = VERTICALS[slug as Slug];

  const t = await getTranslations("verticals");

  const scenario = [
    { role: "user" as const, text: t(`${key}.scenario.user1`) },
    { role: "agent" as const, text: t(`${key}.scenario.agent1`) },
    { role: "user" as const, text: t(`${key}.scenario.user2`) },
    { role: "agent" as const, text: t(`${key}.scenario.agent2`) },
  ];

  return (
    <>
      <section className="mwinda-glow">
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-20 text-center sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber">
            {t(`${key}.name`)}
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight text-warmwhite sm:text-5xl">
            <span className="text-gradient-light">{t(`${key}.title`)}</span>
          </h1>
          <p className="mt-6 text-ink-muted sm:text-lg">{t(`${key}.pain`)}</p>
        </div>
      </section>

      {/* Sélecteur de verticale */}
      <nav aria-label={t("hero.title")} className="mx-auto max-w-4xl px-4 sm:px-6">
        <ul className="flex flex-wrap justify-center gap-2">
          {(Object.keys(VERTICALS) as Slug[]).map((s) => (
            <li key={s}>
              <Link
                href={`/metiers/${s}`}
                className={`inline-block rounded-full border px-4 py-2 text-sm transition-colors ${
                  s === slug
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-night-border text-ink-muted hover:border-amber/50 hover:text-warmwhite"
                }`}
              >
                {t(`${VERTICALS[s]}.name`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Propositions de valeur */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {(["value1", "value2", "value3"] as const).map((v) => (
            <article key={v} className="card p-6">
              <span aria-hidden className="text-amber">◆</span>
              <h2 className="mt-3 font-semibold text-warmwhite">{t(`${key}.${v}.title`)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {t(`${key}.${v}.text`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Scénario de démonstration */}
      <section className="border-y border-night-border bg-night-soft">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-center font-display text-3xl text-warmwhite">
            {t("scenarioTitle")}
          </h2>
          <p className="mt-2 text-center text-sm text-ink-muted">{t("scenarioNote")}</p>
          <div className="card mt-8 space-y-4 p-5 sm:p-7">
            {scenario.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-night-border text-ink"
                      : "rounded-bl-sm border border-amber/25 bg-amber/8 text-ink"
                  }`}
                >
                  {msg.text}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={`/sandbox?vertical=${key}`} className="btn-primary w-full sm:w-auto">
              {t("tryCta")}
            </Link>
            <Link href="/contact" className="btn-secondary w-full sm:w-auto">
              {t("diagnosticCta")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
