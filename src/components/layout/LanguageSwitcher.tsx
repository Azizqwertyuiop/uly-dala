"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n";
import type from "@/components/ui/type.module.css";

type Props = {
  current: Locale;
  label: string;
  names: Record<Locale, string>;
  className?: string;
};

/** Та же страница на другом языке. Адреса считаются на сервере — работает без JS. */
export function LanguageSwitcher({ current, label, names, className }: Props) {
  const pathname = usePathname() ?? `/${current}`;
  const rest = pathname.replace(/^\/[^/]+/, "");

  return (
    <nav aria-label={label} className={className}>
      <ul>
        {locales.map((locale) => (
          <li key={locale}>
            <Link
              href={`/${locale}${rest}`}
              hrefLang={locale}
              lang={locale}
              className={type.link}
              aria-current={locale === current ? "page" : undefined}
            >
              {names[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
