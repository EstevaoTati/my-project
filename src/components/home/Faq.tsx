"use client";

import { useTranslations } from "next-intl";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export default function Faq() {
  const t = useTranslations("home.faq");

  return (
    <div className="space-y-3">
      {FAQ_KEYS.map((key) => (
        <details key={key} className="card group p-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-warmwhite [&::-webkit-details-marker]:hidden">
            {t(`items.${key}.q`)}
            <span
              aria-hidden
              className="text-amber transition-transform duration-200 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="border-t border-night-border px-5 py-4 text-sm leading-relaxed text-ink-muted">
            {t(`items.${key}.a`)}
          </p>
        </details>
      ))}
    </div>
  );
}
