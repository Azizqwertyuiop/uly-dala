"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/content/messages";
import {
  eventTypes,
  guestRanges,
  months,
  venues,
  type BriefValues,
  type GuestRange,
} from "@/lib/brief/model";
import styles from "./brief.module.css";

type Copy = Messages["brief"];
type Token = "event" | "date" | "guests" | "venue" | "name" | "phone";

type Props = {
  copy: Copy;
  values: BriefValues;
  onChange: (values: BriefValues) => void;
  /** id полей формы ниже: клик по «[имя]» переводит фокус в настоящее поле. */
  fieldIds: { name: string; phone: string };
  locale: string;
};

/*
 * Бриф-предложение (CLAUDE.md, раздел 9): крупная антиква, поля внутри текста,
 * каждое поле открывает выбор — список, месяцы и календарь, слайдер.
 *
 * Это визуальный слой для мыши и тача. Для клавиатуры и экранных читалок основной путь —
 * форма с вопросами прямо под ним (те же значения, синхронно), поэтому предложение
 * скрыто от вспомогательных технологий и не участвует в порядке Tab.
 */
export function BriefSentence({ copy, values, onChange, fieldIds, locale }: Props) {
  const [open, setOpen] = useState<Token | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: BriefValues) => {
    onChange(next);
    setOpen(null);
  };

  const dateText = (() => {
    if (values.dateMode === "unknown") return copy.dateUnknownPhrase;
    if (values.dateMode === "month" && values.month) return copy.months[values.month].in;
    if (values.dateMode === "date" && values.date) {
      const date = new Date(`${values.date}T12:00:00`);
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
    }
    return null;
  })();

  const text: Record<Token, string | null> = {
    event: values.eventType ? copy.eventTypes[values.eventType].phrase : null,
    date: dateText,
    guests: values.guests ? copy.guests[values.guests].phrase : null,
    venue: values.venue ? copy.venues[values.venue].phrase : null,
    name: values.name?.trim() || null,
    phone: values.phone && values.phone.replace(/\D/g, "").length > 1 ? values.phone : null,
  };

  const token = (key: Token) => {
    const filled = text[key] !== null;
    const label = text[key] ?? copy.placeholders[key];
    if (key === "name" || key === "phone") {
      return (
        <button
          type="button"
          tabIndex={-1}
          className={styles.token}
          data-filled={filled}
          onClick={() => document.getElementById(fieldIds[key])?.focus()}
        >
          {label}
        </button>
      );
    }
    return (
      <span className={styles.tokenWrap}>
        <button
          type="button"
          tabIndex={-1}
          className={styles.token}
          data-filled={filled}
          data-open={open === key}
          onClick={() => setOpen(open === key ? null : key)}
        >
          {label}
        </button>
        {open === key && <span className={styles.popover}>{popover(key)}</span>}
      </span>
    );
  };

  const option = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      tabIndex={-1}
      className={styles.popoverOption}
      data-active={active}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const guestIndex = values.guests ? guestRanges.indexOf(values.guests) : 1;

  function popover(key: Token) {
    switch (key) {
      case "event":
        return (
          <span className={styles.popoverList}>
            {eventTypes.map((type) =>
              option(copy.eventTypes[type].label, values.eventType === type, () =>
                choose({ eventType: type }),
              ),
            )}
          </span>
        );
      case "venue":
        return (
          <span className={styles.popoverList}>
            {venues.map((venue) =>
              option(copy.venues[venue].label, values.venue === venue, () => choose({ venue })),
            )}
          </span>
        );
      case "date":
        return (
          <span className={styles.popoverDate}>
            <span className={styles.monthGrid}>
              {months.map((month) =>
                option(
                  copy.months[month].name,
                  values.dateMode === "month" && values.month === month,
                  () => choose({ dateMode: "month", month }),
                ),
              )}
            </span>
            <label className={styles.popoverDateInput}>
              <span>{copy.dateLabel}</span>
              <input
                type="date"
                tabIndex={-1}
                value={values.dateMode === "date" ? (values.date ?? "") : ""}
                onChange={(e) =>
                  e.target.value && choose({ dateMode: "date", date: e.target.value })
                }
              />
            </label>
            {option(copy.dateModes.unknown, values.dateMode === "unknown", () =>
              choose({ dateMode: "unknown" }),
            )}
          </span>
        );
      case "guests":
        return (
          <span className={styles.popoverSlider}>
            <input
              type="range"
              tabIndex={-1}
              min={0}
              max={guestRanges.length - 1}
              step={1}
              value={guestIndex}
              onChange={(e) =>
                onChange({ guests: guestRanges[Number(e.target.value)] as GuestRange })
              }
            />
            <span className={styles.sliderLabels}>
              {guestRanges.map((range, i) => (
                <span key={range} data-active={i === guestIndex}>
                  {copy.guests[range].label}
                </span>
              ))}
            </span>
            {option(copy.done, false, () => choose({ guests: guestRanges[guestIndex] }))}
          </span>
        );
      default:
        return null;
    }
  }

  // Шаблон «Мы планируем {event} {date} …» → текст и поля.
  const parts = copy.sentence.split(/(\{\w+\})/);

  return (
    <div ref={rootRef} className={styles.sentence} aria-hidden="true" data-brief-sentence="">
      {parts.map((part, i) => {
        const match = /^\{(\w+)\}$/.exec(part);
        return match ? (
          <span key={i}>{token(match[1] as Token)}</span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </div>
  );
}
