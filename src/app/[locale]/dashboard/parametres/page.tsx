import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/dashboard-data";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { updateSettings } from "@/lib/actions";
import BillingButtons from "@/components/dashboard/BillingButtons";

const inputClass =
  "w-full rounded-xl border border-night-border bg-night px-3 py-2.5 text-sm text-ink focus:border-amber focus:outline-none";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const t = await getTranslations("dash.settings");
  const org = await getSettings(session!.organizationId!);

  return (
    <DashboardShell active="settings" title={t("title")}>
      <form action={updateSettings} className="card max-w-2xl space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">{t("tone")}</span>
            <select name="tone" defaultValue={org?.agentConfig?.tone ?? "PROFESSIONAL"} className={inputClass}>
              <option value="PROFESSIONAL">Professional</option>
              <option value="FORMAL">Formal</option>
              <option value="CONCISE">Concise</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">{t("languages")}</span>
            <select name="languages" defaultValue={org?.agentConfig?.languages ?? "BOTH"} className={inputClass}>
              <option value="BOTH">FR + EN</option>
              <option value="FR">FR</option>
              <option value="EN">EN</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("averageTicket")}</span>
          <input
            type="number"
            name="averageTicket"
            min={0}
            defaultValue={org?.averageTicket ?? ""}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("businessHours")}</span>
          <input
            name="businessHours"
            defaultValue={org?.agentConfig?.businessHours ?? ""}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("calendarUrl")}</span>
          <input
            name="calendarUrl"
            type="url"
            defaultValue={org?.agentConfig?.calendarUrl ?? ""}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("customRules")}</span>
          <textarea
            name="customRules"
            rows={4}
            defaultValue={org?.agentConfig?.customRules ?? ""}
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="draftMode"
            defaultChecked={org?.draftMode ?? true}
            className="h-4 w-4 accent-amber"
          />
          {t("draftMode")}
        </label>

        <button type="submit" className="btn-primary">
          {t("save")}
        </button>
      </form>

      <div className="card mt-6 max-w-2xl p-6">
        <h2 className="font-display text-lg text-warmwhite">{t("billing")}</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {t("billingTier")} :{" "}
          <span className="text-warmwhite">{org?.subscriptionTier ?? t("billingNone")}</span>
        </p>
        <BillingButtons
          hasSubscription={Boolean(org?.stripeCustomerId)}
          labels={{ manage: t("billingManage"), subscribe: t("billingSubscribe") }}
        />
      </div>
    </DashboardShell>
  );
}
