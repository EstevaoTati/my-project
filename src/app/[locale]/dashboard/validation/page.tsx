import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { listPendingDrafts } from "@/lib/dashboard-data";
import { Link } from "@/i18n/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { reviewDraft } from "@/lib/actions";

export default async function ValidationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const t = await getTranslations("dash.validation");
  const drafts = await listPendingDrafts(session!.organizationId!);

  return (
    <DashboardShell active="validation" title={t("title")} pendingCount={drafts.length}>
      <p className="mb-5 text-sm text-ink-muted">{t("subtitle")}</p>
      {drafts.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d) => (
            <li key={d.id} className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-ink-muted">
                  {t("draftFrom")}{" "}
                  <span className="text-warmwhite">
                    {d.conversation.prospectName ?? d.conversation.prospectEmail ?? "—"}
                  </span>
                </p>
                <Link
                  href={`/dashboard/conversations/${d.conversation.id}`}
                  className="text-xs text-ink-muted hover:text-warmwhite"
                >
                  {t("viewThread")}
                </Link>
              </div>
              <form action={reviewDraft} className="space-y-3">
                <input type="hidden" name="messageId" value={d.id} />
                <textarea
                  name="editedContent"
                  rows={4}
                  defaultValue={d.content}
                  className="w-full rounded-xl border border-night-border bg-night px-3 py-2.5 text-sm leading-relaxed text-ink focus:border-amber focus:outline-none"
                />
                <p className="text-xs text-ink-muted">{t("editHint")}</p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="action"
                    value="approve"
                    className="btn-primary !py-2 text-xs"
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="submit"
                    name="action"
                    value="reject"
                    className="btn-secondary !py-2 text-xs"
                  >
                    {t("reject")}
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
