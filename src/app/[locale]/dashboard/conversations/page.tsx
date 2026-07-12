import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { listConversations } from "@/lib/dashboard-data";
import { Link } from "@/i18n/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { ScoreBadge, StatusBadge } from "@/components/dashboard/badges";

export default async function ConversationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const t = await getTranslations("dash.conversations");
  const convos = await listConversations(session!.organizationId!);

  return (
    <DashboardShell active="conversations" title={t("title")}>
      {convos.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {convos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/conversations/${c.id}`}
                className="card flex items-center justify-between gap-4 p-4 transition-colors hover:border-amber/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-warmwhite">
                    {c.prospectName ?? c.prospectEmail ?? "—"}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {t(`channelLabels.${c.channel}`)} · {c._count.messages} msg
                    {c.detectedLanguage ? ` · ${c.detectedLanguage}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ScoreBadge score={c.qualificationScore} />
                  <StatusBadge label={t(`statusLabels.${c.status}`)} status={c.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
