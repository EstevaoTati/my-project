import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { listReports } from "@/lib/dashboard-data";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const t = await getTranslations("dash.reports");
  const ov = await getTranslations("dash.overview");
  const reports = await listReports(session!.organizationId!);
  const fmt = (n: number | null, suffix = "") =>
    n == null ? "—" : `${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(n)}${suffix}`;

  return (
    <DashboardShell active="reports" title={t("title")}>
      {reports.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <div className="space-y-4 print:space-y-6">
          {reports.map((r) => (
            <article key={r.id} className="card p-5 print:border-black">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-warmwhite">
                  {String(r.month).padStart(2, "0")}/{r.year}
                </h2>
                <p className="text-xs text-ink-muted">
                  {r.sentAt
                    ? `${t("sentAt")} ${new Date(r.sentAt).toLocaleDateString(locale)}`
                    : t("notSent")}
                </p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div>
                  <dt className="text-ink-muted">{ov("leads")}</dt>
                  <dd className="font-display text-lg text-warmwhite">{fmt(r.leadsCount)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{ov("appointments")}</dt>
                  <dd className="font-display text-lg text-warmwhite">{fmt(r.appointmentsCount)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{ov("escalated")}</dt>
                  <dd className="font-display text-lg text-warmwhite">{fmt(r.escalationsCount)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{ov("avgResponse")}</dt>
                  <dd className="font-display text-lg text-warmwhite">{fmt(r.avgResponseSeconds, ` ${ov("seconds")}`)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{ov("capturedValue")}</dt>
                  <dd className="font-display text-lg text-emerald-pos">{fmt(r.estimatedValueCaptured, " $")}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
