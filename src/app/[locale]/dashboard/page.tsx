import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { getOrganizationOverview } from "@/lib/dashboard-data";
import { Link } from "@/i18n/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-warmwhite">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const t = await getTranslations("dash.overview");
  const orgId = session!.organizationId!;
  const data = await getOrganizationOverview(orgId);

  const fmt = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(n);

  return (
    <DashboardShell active="overview" title={t("title")} pendingCount={data?.pendingDrafts}>
      <p className="mb-4 text-sm text-ink-muted">{t("thisMonth")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label={t("leads")} value={data ? fmt(data.leadsThisMonth) : "—"} />
        <Stat label={t("appointments")} value={data ? fmt(data.appointmentsThisMonth) : "—"} />
        <Stat
          label={t("avgResponse")}
          value={data?.avgResponseSeconds != null ? `${fmt(data.avgResponseSeconds)} ${t("seconds")}` : "—"}
        />
        <Stat
          label={t("capturedValue")}
          value={data?.capturedValue != null ? `${fmt(data.capturedValue)} $` : "—"}
          hint={data && !data.hasTicket ? t("noTicket") : undefined}
        />
        <Stat label={t("escalated")} value={data ? fmt(data.escalated) : "—"} />
        <div className="card flex flex-col justify-between p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-muted">{t("pendingDrafts")}</p>
            <p className="mt-2 font-display text-3xl text-amber">{data ? fmt(data.pendingDrafts) : "—"}</p>
          </div>
          {data && data.pendingDrafts > 0 ? (
            <Link href="/dashboard/validation" className="btn-primary mt-4 !py-2 text-xs">
              {t("reviewCta")}
            </Link>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
