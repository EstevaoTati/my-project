"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

const CONVERSION_RATE = 0.5; // hypothèse prudente : 1 lead manqué sur 2 aurait signé
const WEEKS_PER_YEAR = 52;

export default function PainCalculator() {
  const t = useTranslations("home.painCalc");
  const locale = useLocale();
  const [missedPerWeek, setMissedPerWeek] = useState(5);
  const [averageTicket, setAverageTicket] = useState(400);

  const yearlyLoss = Math.round(
    missedPerWeek * WEEKS_PER_YEAR * CONVERSION_RATE * averageTicket,
  );
  const formatted = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(
    yearlyLoss,
  );

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2">
        <div className="space-y-7">
          <label className="block">
            <span className="flex items-baseline justify-between text-sm text-ink-muted">
              {t("missedLabel")}
              <span className="font-display text-xl text-warmwhite">{missedPerWeek}</span>
            </span>
            <input
              type="range"
              min={1}
              max={30}
              value={missedPerWeek}
              onChange={(e) => setMissedPerWeek(Number(e.target.value))}
              className="mt-3 w-full accent-amber"
            />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between text-sm text-ink-muted">
              {t("ticketLabel")}
              <span className="font-display text-xl text-warmwhite">${averageTicket}</span>
            </span>
            <input
              type="range"
              min={100}
              max={3000}
              step={50}
              value={averageTicket}
              onChange={(e) => setAverageTicket(Number(e.target.value))}
              className="mt-3 w-full accent-amber"
            />
          </label>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-amber/25 bg-night p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
            {t("resultPrefix")}
          </p>
          <p
            aria-live="polite"
            className="mt-2 font-display text-4xl text-transparent sm:text-5xl text-gradient-light"
          >
            {formatted} <span className="text-2xl">{t("perYear")}</span>
          </p>
        </div>
      </div>
      <p className="border-t border-night-border bg-night px-6 py-4 text-xs leading-relaxed text-ink-muted sm:px-8">
        {t("resultNote")}
      </p>
    </div>
  );
}
