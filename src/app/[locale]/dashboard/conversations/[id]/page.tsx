import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { getConversation } from "@/lib/dashboard-data";
import { Link } from "@/i18n/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { ScoreBadge, StatusBadge } from "@/components/dashboard/badges";
import { closeConversation, takeOver } from "@/lib/actions";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const t = await getTranslations("dash.conversations");
  const convo = await getConversation(session!.organizationId!, id);
  if (!convo) notFound();

  return (
    <DashboardShell active="conversations" title={convo.prospectName ?? convo.prospectEmail ?? "—"}>
      <Link href="/dashboard/conversations" className="text-sm text-ink-muted hover:text-warmwhite">
        {t("back")}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ScoreBadge score={convo.qualificationScore} />
        <StatusBadge label={t(`statusLabels.${convo.status}`)} status={convo.status} />
        {convo.detectedLanguage ? (
          <span className="rounded-full border border-night-border px-2.5 py-1 text-xs text-ink-muted">
            {convo.detectedLanguage}
          </span>
        ) : null}
      </div>

      {convo.summaryForHuman ? (
        <div className="card mt-4 border-amber/20 p-4">
          <p className="text-xs uppercase tracking-wider text-amber">{t("summaryTitle")}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink">{convo.summaryForHuman}</p>
        </div>
      ) : null}

      <div className="card mt-5 space-y-3 p-5">
        {convo.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "PROSPECT" ? "justify-start" : "justify-end"}`}>
            <div className="max-w-[85%]">
              <p className="mb-1 text-xs text-ink-muted">
                {t(`roleLabels.${m.role}`)}
                {m.status === "DRAFT" ? (
                  <span className="ml-2 rounded bg-amber/15 px-1.5 py-0.5 text-amber">{t("draftBadge")}</span>
                ) : null}
                {m.status === "REJECTED" ? (
                  <span className="ml-2 rounded bg-red-400/15 px-1.5 py-0.5 text-red-300">{t("rejectedBadge")}</span>
                ) : null}
              </p>
              <p
                className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "PROSPECT"
                    ? "rounded-bl-sm bg-night-border text-ink"
                    : m.role === "HUMAN"
                      ? "rounded-br-sm border border-emerald-pos/30 bg-emerald-pos/8 text-ink"
                      : "rounded-br-sm border border-amber/25 bg-amber/8 text-ink"
                } ${m.status === "REJECTED" ? "opacity-50 line-through" : ""}`}
              >
                {m.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {convo.status !== "CLOSED" ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <form action={takeOver} className="card p-4">
            <p className="text-sm font-semibold text-warmwhite">{t("takeOverTitle")}</p>
            <input type="hidden" name="conversationId" value={convo.id} />
            <textarea
              name="content"
              rows={3}
              placeholder={t("takeOverPlaceholder")}
              className="mt-2 w-full rounded-xl border border-night-border bg-night px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-amber focus:outline-none"
            />
            <button type="submit" className="btn-secondary mt-2 w-full !py-2 text-xs">
              {t("takeOverSubmit")}
            </button>
          </form>
          <form action={closeConversation} className="card flex items-center p-4">
            <input type="hidden" name="conversationId" value={convo.id} />
            <button type="submit" className="text-sm text-ink-muted hover:text-warmwhite">
              {t("close")}
            </button>
          </form>
        </div>
      ) : null}
    </DashboardShell>
  );
}
