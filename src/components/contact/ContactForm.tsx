"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

const PROFESSIONS = [
  "TAX_PREPARER",
  "IMMIGRATION_LAWYER",
  "INSURANCE_AGENT",
  "ACCOUNTANT",
  "TRAVEL_AGENCY",
  "OTHER",
] as const;

const VOLUMES = ["UNDER_10", "FROM_10_TO_30", "FROM_30_TO_75", "OVER_75"] as const;
const LANGUAGES = ["FR", "EN", "BOTH"] as const;

type Status = "idle" | "submitting" | "success" | "error";

const inputClass =
  "w-full rounded-xl border border-night-border bg-night px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/50 transition-colors";

export default function ContactForm() {
  const t = useTranslations("contact.form");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    const form = e.currentTarget;
    const data = new FormData(form);
    const ticketRaw = data.get("averageTicket");

    const payload = {
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone") || null,
      firmName: data.get("firmName"),
      profession: data.get("profession"),
      weeklyInquiries: data.get("weeklyInquiries"),
      averageTicket: ticketRaw ? Number(ticketRaw) : null,
      preferredLanguage: data.get("preferredLanguage"),
      message: data.get("message") || null,
      locale,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card border-emerald-pos/40 p-8 text-center" role="status">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full bg-emerald-pos shadow-[0_0_16px_rgba(45,212,167,0.8)]"
        />
        <h2 className="mt-4 font-display text-2xl text-warmwhite">{t("success.title")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("success.text")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("name")} *</span>
          <input name="name" required placeholder={t("namePlaceholder")} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("email")} *</span>
          <input
            name="email"
            type="email"
            required
            placeholder={t("emailPlaceholder")}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("phone")}</span>
          <input name="phone" type="tel" placeholder={t("phonePlaceholder")} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("firmName")} *</span>
          <input
            name="firmName"
            required
            placeholder={t("firmNamePlaceholder")}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-ink-muted">{t("profession")} *</span>
        <select name="profession" required defaultValue="" className={inputClass}>
          <option value="" disabled hidden />
          {PROFESSIONS.map((p) => (
            <option key={p} value={p}>
              {t(`professionOptions.${p}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("weeklyInquiries")} *</span>
          <select name="weeklyInquiries" required defaultValue="" className={inputClass}>
            <option value="" disabled hidden />
            {VOLUMES.map((v) => (
              <option key={v} value={v}>
                {t(`weeklyInquiriesOptions.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">{t("averageTicket")}</span>
          <input
            name="averageTicket"
            type="number"
            min={0}
            placeholder={t("averageTicketPlaceholder")}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-ink-muted">{t("preferredLanguage")} *</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <label
              key={l}
              className="cursor-pointer rounded-full border border-night-border px-4 py-2 text-sm text-ink-muted transition-colors has-[:checked]:border-amber has-[:checked]:bg-amber/10 has-[:checked]:text-amber"
            >
              <input
                type="radio"
                name="preferredLanguage"
                value={l}
                required
                className="sr-only"
              />
              {t(`preferredLanguageOptions.${l}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm text-ink-muted">{t("message")}</span>
        <textarea
          name="message"
          rows={4}
          placeholder={t("messagePlaceholder")}
          className={inputClass}
        />
      </label>

      {status === "error" && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {t("error")}
        </p>
      )}

      <button type="submit" disabled={status === "submitting"} className="btn-primary w-full disabled:opacity-60">
        {status === "submitting" ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
