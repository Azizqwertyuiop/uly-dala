"use client";

import { useEffect, useRef } from "react";
import type { Messages } from "@/content/messages";
import { useBriefStore } from "@/store/brief";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { BriefForm } from "./BriefForm";
import { briefTrigger } from "./BriefLink";
import styles from "./brief.module.css";

type Props = {
  copy: Messages["brief"];
  locale: string;
  privacyHref: string;
  whatsappHref: string | null;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])';

/*
 * Бриф в модальном окне — для контекстных CTA в конце глав. Нативный <dialog> (как меню):
 * роль dialog, Esc, ловушка Tab, возврат фокуса на кнопку, которой окно открыли.
 */
export function BriefModal({ copy, locale, privacyHref, whatsappHref }: Props) {
  const modal = useBriefStore((s) => s.modal);
  const closeModal = useBriefStore((s) => s.closeModal);
  const ref = useRef<HTMLDialogElement>(null);
  const variant = copy.variants[modal.source];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (modal.open && !dialog.open) {
      dialog.showModal();
      document.documentElement.dataset.menuOpen = "true";
      dialog.querySelector<HTMLElement>("h2")?.focus();
    } else if (!modal.open && dialog.open) {
      dialog.close();
    }
  }, [modal.open, modal.key]);

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-labelledby="brief-modal-title"
      data-tone="light"
      onClose={() => {
        delete document.documentElement.dataset.menuOpen;
        closeModal();
        briefTrigger?.focus();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => el.offsetParent !== null,
        );
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className={`${layout.container} ${styles.modalInner}`}>
        <div className={styles.modalTop}>
          <button
            type="button"
            className={`${type.link} ${styles.plainButton}`}
            onClick={() => ref.current?.close()}
          >
            {copy.modalClose}
          </button>
        </div>
        <h2 id="brief-modal-title" tabIndex={-1} className={type.chapterTitle}>
          {variant.title}
        </h2>
        <p className={type.lead}>{variant.lead}</p>
        {modal.open && (
          <BriefForm
            key={modal.key}
            variant={modal.source}
            copy={copy}
            locale={locale}
            privacyHref={privacyHref}
            whatsappHref={whatsappHref}
          />
        )}
      </div>
    </dialog>
  );
}
