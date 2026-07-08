import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getOrganizationForAdmin } from "@/lib/admin-data";
import {
  updateOrganization,
  regenerateDashboardToken,
  generateReportNow,
} from "@/lib/actions";

const inputClass =
  "w-full rounded-xl border border-night-border bg-night px-3 py-2.5 text-sm text-ink focus:border-amber focus:outline-none";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminUi.org");
  const org = await getOrganizationForAdmin(id);
  if (!org) notFound();

  const cfg = org.agentConfig;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 font-display text-2xl text-warmwhite">{org.name}</h1>

      <form action={updateOrganization} className="card space-y-5 p-6">
        <input type="hidden" name="organizationId" value={org.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">{t("name")}</span>
            <input name="name" defaultValue={org.name} required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">{t("slug")}</span>
            <input name="slug" defaultValue={org.slug} required className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("contactEmail")}</span>
          <input name="contactEmail" type="email" defaultValue={org.contactEmail} required className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">{t("profession")}</span>
            <select name="profession" defaultValue={cfg?.profession ?? "TAX"} className={inputClass}>
              <option value="TAX">{t("professionLabels.TAX")}</option>
              <option value="IMMIGRATION">{t("professionLabels.IMMIGRATION")}</option>
              <option value="INSURANCE">{t("professionLabels.INSURANCE")}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">{t("tone")}</span>
            <select name="tone" defaultValue={cfg?.tone ?? "PROFESSIONAL"} className={inputClass}>
              <option value="PROFESSIONAL">{t("toneLabels.PROFESSIONAL")}</option>
              <option value="FORMAL">{t("toneLabels.FORMAL")}</option>
              <option value="CONCISE">{t("toneLabels.CONCISE")}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">{t("languages")}</span>
            <select name="languages" defaultValue={cfg?.languages ?? "BOTH"} className={inputClass}>
              <option value="BOTH">{t("languageLabels.BOTH")}</option>
              <option value="FR">{t("languageLabels.FR")}</option>
              <option value="EN">{t("languageLabels.EN")}</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("customRules")}</span>
          <textarea name="customRules" rows={3} defaultValue={cfg?.customRules ?? ""} className={inputClass} />
        </label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="draftMode" defaultChecked={org.draftMode} className="h-4 w-4 accent-amber" />
            {t("draftMode")}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="active" defaultChecked={org.active} className="h-4 w-4 accent-amber" />
            {t("active")}
          </label>
        </div>
        <button type="submit" className="btn-primary">{t("save")}</button>
      </form>

      <div className="card mt-5 p-6">
        <p className="text-sm font-semibold text-warmwhite">{t("token")}</p>
        <p className="mt-1 text-xs text-ink-muted">{t("tokenHint")}</p>
        <code className="mt-3 block break-all rounded-lg bg-night px-3 py-2 text-xs text-amber-soft">
          {org.dashboardToken}
        </code>
        <form action={regenerateDashboardToken} className="mt-3">
          <input type="hidden" name="organizationId" value={org.id} />
          <button type="submit" className="btn-secondary !py-2 text-xs">{t("regenerate")}</button>
        </form>
        <p className="mt-4 text-xs text-ink-muted">{t("webhookHint")}</p>
      </div>

      <div className="card mt-5 p-6">
        <form action={generateReportNow}>
          <input type="hidden" name="organizationId" value={org.id} />
          <button type="submit" className="btn-secondary !py-2 text-xs">{t("generateReport")}</button>
        </form>
        {org.reports.length > 0 && (
          <p className="mt-3 text-xs text-ink-muted">
            {org.reports.length} rapport(s) — dernier :{" "}
            {String(org.reports[0]!.month).padStart(2, "0")}/{org.reports[0]!.year}
          </p>
        )}
      </div>
    </div>
  );
}
