"use client";

import type { EventType, Source } from "@/lib/brief/model";
import { useHydrated } from "@/lib/useHydrated";
import { useBriefStore } from "@/store/brief";
import buttonStyles from "@/components/ui/ButtonLink.module.css";

/** Элемент, с которого открыли окно, — туда вернётся фокус. */
export let briefTrigger: HTMLElement | null = null;

type Props = {
  /** Адрес без JS: бриф на главной или страница мини-формы. */
  href: string;
  source: Source;
  eventType?: EventType;
  variant?: "primary" | "secondary" | "link";
  className?: string;
  children: React.ReactNode;
};

/*
 * Контекстный CTA в конце главы (CLAUDE.md, раздел 9): с JS открывает бриф в модальном окне
 * с предзаполнением, без JS — обычная ссылка на форму.
 */
export function BriefLink({
  href,
  source,
  eventType,
  variant = "primary",
  className,
  children,
}: Props) {
  const hydrated = useHydrated();
  const openModal = useBriefStore((s) => s.openModal);
  const base =
    variant === "link"
      ? ""
      : variant === "primary"
        ? buttonStyles.button
        : `${buttonStyles.button} ${buttonStyles.secondary}`;

  return (
    <a
      href={href}
      className={[base, className].filter(Boolean).join(" ")}
      aria-haspopup={hydrated ? "dialog" : undefined}
      // Аналитика: CTA с главой (TelemetryBootstrap).
      data-cta={source}
      data-format={eventType}
      onClick={(event) => {
        if (!hydrated || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        briefTrigger = event.currentTarget;
        openModal(source, eventType ? { eventType } : undefined);
      }}
    >
      {children}
    </a>
  );
}
