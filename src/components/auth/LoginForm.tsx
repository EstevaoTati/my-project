"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { login, type LoginState } from "@/lib/actions";

const inputClass =
  "w-full rounded-xl border border-night-border bg-night px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/50 transition-colors";

export default function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="card space-y-5 p-6 sm:p-8">
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="mb-1.5 block text-sm text-ink-muted">{t("codeLabel")}</span>
        <input
          name="code"
          type="password"
          required
          autoComplete="off"
          placeholder={t("codePlaceholder")}
          className={inputClass}
        />
      </label>
      {state.error === "invalid" && (
        <p role="alert" className="text-sm text-red-300">
          {t("errorInvalid")}
        </p>
      )}
      {state.error === "unconfigured" && (
        <p role="alert" className="text-sm text-amber-soft">
          {t("errorUnconfigured")}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
