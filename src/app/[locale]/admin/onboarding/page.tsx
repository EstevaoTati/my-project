import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createOrganization } from "@/lib/actions";

const inputClass =
  "w-full rounded-xl border border-night-border bg-night px-3 py-2.5 text-sm text-ink focus:border-amber focus:outline-none";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminUi.onboarding");
  const o = await getTranslations("adminUi.org");

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-warmwhite">{t("title")}</h1>
      <p className="mt-2 text-sm text-ink-muted">{t("subtitle")}</p>

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber">
            {t("step1")}
          </h2>
          <form action={createOrganization} className="card space-y-5 p-6">
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink-muted">{o("name")}</span>
                <input name="name" required className={inputClass} placeholder="Cabinet Kabongo Tax Services" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink-muted">{o("slug")}</span>
                <input name="slug" required className={inputClass} placeholder="kabongo-tax" pattern="[a-z0-9-]+" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-muted">{o("contactEmail")}</span>
              <input name="contactEmail" type="email" required className={inputClass} />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink-muted">{o("profession")}</span>
                <select name="profession" defaultValue="TAX" className={inputClass}>
                  <option value="TAX">{o("professionLabels.TAX")}</option>
                  <option value="IMMIGRATION">{o("professionLabels.IMMIGRATION")}</option>
                  <option value="INSURANCE">{o("professionLabels.INSURANCE")}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink-muted">{o("tone")}</span>
                <select name="tone" defaultValue="PROFESSIONAL" className={inputClass}>
                  <option value="PROFESSIONAL">{o("toneLabels.PROFESSIONAL")}</option>
                  <option value="FORMAL">{o("toneLabels.FORMAL")}</option>
                  <option value="CONCISE">{o("toneLabels.CONCISE")}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink-muted">{o("languages")}</span>
                <select name="languages" defaultValue="BOTH" className={inputClass}>
                  <option value="BOTH">{o("languageLabels.BOTH")}</option>
                  <option value="FR">{o("languageLabels.FR")}</option>
                  <option value="EN">{o("languageLabels.EN")}</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-muted">{o("customRules")}</span>
              <textarea name="customRules" rows={3} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="draftMode" defaultChecked className="h-4 w-4 accent-amber" />
              {o("draftMode")}
            </label>
            <button type="submit" className="btn-primary">{t("create")}</button>
          </form>
        </section>

        <section className="card p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-amber">{t("step2")}</h2>
          <p className="text-sm text-ink-muted">{t("step2Text")}</p>
          <Link href="/sandbox" className="btn-secondary mt-3 !py-2 text-xs">
            {t("step2Cta")}
          </Link>
        </section>

        <section className="card p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-amber">{t("step3")}</h2>
          <p className="text-sm text-ink-muted">{t("step3Text")}</p>
        </section>
      </div>
    </div>
  );
}
