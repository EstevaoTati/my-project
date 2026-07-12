"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export default function LanguageSwitcher() {
  const t = useTranslations("langSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next !== locale) {
      router.replace(pathname, { locale: next });
    }
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex items-center overflow-hidden rounded-full border border-night-border text-xs font-semibold"
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-pressed={locale === l}
          className={`px-3 py-1.5 transition-colors ${
            locale === l
              ? "bg-amber text-night"
              : "text-ink-muted hover:text-warmwhite"
          }`}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
