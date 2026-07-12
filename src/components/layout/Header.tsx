"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";

const NAV_ITEMS = [
  { key: "how", href: "/comment-ca-marche" },
  { key: "pricing", href: "/tarifs" },
  { key: "verticals", href: "/metiers/impots" },
  { key: "sandbox", href: "/sandbox" },
] as const;

export default function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-night-border/70 bg-night/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-amber shadow-[0_0_14px_rgba(245,166,35,0.8)]"
          />
          <span className="font-display text-lg tracking-tight text-warmwhite">
            Mwinda <span className="text-amber">Digital</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`text-sm transition-colors hover:text-warmwhite ${
                pathname.startsWith(item.href.split("/").slice(0, 2).join("/"))
                  ? "text-warmwhite"
                  : "text-ink-muted"
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/contact" className="btn-primary hidden text-sm sm:inline-flex !px-5 !py-2.5">
            {t("cta")}
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-night-border text-ink lg:hidden"
          >
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {open ? (
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-night-border bg-night-soft px-4 py-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-ink-muted transition-colors hover:bg-night-card hover:text-warmwhite"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="btn-primary w-full text-sm"
              >
                {t("cta")}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
