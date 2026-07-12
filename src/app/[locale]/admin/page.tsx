import { setRequestLocale, getTranslations } from "next-intl/server";
import { listOrganizationsWithHealth } from "@/lib/admin-data";
import { Link } from "@/i18n/navigation";

export default async function AdminOrgsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminUi.orgs");
  const orgs = await listOrganizationsWithHealth();

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl text-warmwhite">{t("title")}</h1>
        <Link href="/admin/onboarding" className="btn-primary !py-2 text-xs">
          {t("newOrg")}
        </Link>
      </div>

      {orgs.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/organisations/${o.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-amber/40"
              >
                <div>
                  <p className="font-medium text-warmwhite">
                    {o.name}
                    {!o.active && (
                      <span className="ml-2 rounded bg-red-400/15 px-1.5 py-0.5 text-xs text-red-300">
                        {t("inactive")}
                      </span>
                    )}
                    {o.draftMode && (
                      <span className="ml-2 rounded bg-amber/15 px-1.5 py-0.5 text-xs text-amber">
                        {t("draftOn")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-muted">
                    /{o.slug}
                    {o.profession ? ` · ${o.profession}` : ""}
                  </p>
                </div>
                <div className="flex gap-5 text-xs text-ink-muted">
                  <span>
                    <span className="font-display text-base text-warmwhite">{o.conversations}</span>{" "}
                    {t("conversations")}
                  </span>
                  <span>
                    <span
                      className={`font-display text-base ${o.escalationRate > 40 ? "text-red-300" : "text-warmwhite"}`}
                    >
                      {o.escalationRate}%
                    </span>{" "}
                    {t("escalationRate")}
                  </span>
                  <span>
                    <span
                      className={`font-display text-base ${o.pendingDrafts > 0 ? "text-amber" : "text-warmwhite"}`}
                    >
                      {o.pendingDrafts}
                    </span>{" "}
                    {t("pendingDrafts")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
