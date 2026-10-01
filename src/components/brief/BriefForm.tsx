"use client";

import { BRIEF_SENT_EVENT } from "@/lib/sound/bus";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import type { Messages } from "@/content/messages";
import {
  channels,
  eventTypes,
  FIELD,
  formatPhoneMask,
  guestRanges,
  months,
  venues,
  type BriefValues,
  type DateMode,
  type Source,
} from "@/lib/brief/model";
import { initialBriefState, type BriefFormState } from "@/lib/brief/state";
import { useHydrated } from "@/lib/useHydrated";
import { submitBrief } from "@/server/leads/action";
import { useBriefStore } from "@/store/brief";
import type from "@/components/ui/type.module.css";
import { BriefSentence } from "./BriefSentence";
import { ChoiceField, DateInput, SelectField, TextField } from "./fields";
import { useBriefLayout, useKeepFocusedAboveKeyboard } from "./hooks";
import styles from "./brief.module.css";

type Copy = Messages["brief"];

type Props = {
  variant: Source;
  copy: Copy;
  locale: string;
  privacyHref: string;
  whatsappHref: string | null;
  /** Показывать бриф-предложение над формой (только большой бриф). */
  withSentence?: boolean;
};

/** Какие вопросы в какой форме (CLAUDE.md, раздел 9: мини-формы — те же компоненты). */
const FIELDS: Record<Source, readonly (keyof BriefValues)[]> = {
  brief: [
    "eventType",
    "dateMode",
    "guests",
    "venue",
    "name",
    "phone",
    "channel",
    "email",
    "comment",
  ],
  menu: ["eventType", "guests", "name", "phone", "channel", "email", "comment"],
  visit: ["dateMode", "name", "phone", "channel", "email", "comment"],
};

/*
 * Бриф и мини-формы. Одна форма, один эндпоинт (Server Action submitBrief).
 * Без JS — обычный POST: сервер валидирует и перерисовывает форму с ошибками и введёнными данными.
 * С JS — то же действие без перезагрузки, черновик в sessionStorage, фокус на первой ошибке.
 */
export function BriefForm({
  variant,
  copy,
  locale,
  privacyHref,
  whatsappHref,
  withSentence,
}: Props) {
  const [state, formAction, pending] = useActionState<BriefFormState, FormData>(
    submitBrief,
    initialBriefState(variant),
  );
  const hydrated = useHydrated();
  const layout = useBriefLayout();
  const uid = useId();
  const id = (field: string) => `${variant}-${field}-${uid}`;
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const draft = useBriefStore((s) => s.draft);
  const storeReady = useBriefStore((s) => s.hydrated);
  const setField = useBriefStore((s) => s.setField);
  const merge = useBriefStore((s) => s.merge);
  const clear = useBriefStore((s) => s.clear);
  const [consent, setConsent] = useState(false);

  // До гидрации — значения, которые вернул сервер (важно для формы без JS), потом — черновик.
  const values: BriefValues = storeReady ? draft : (state.values ?? {});
  const show = (field: keyof BriefValues) => FIELDS[variant].includes(field);

  useEffect(() => {
    useBriefStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!state.submittedAt) return;
    if (state.status === "success") {
      window.dispatchEvent(new Event(BRIEF_SENT_EVENT));
      clear();
      resultRef.current?.focus();
    } else if (state.status === "invalid") {
      if (state.values) merge(state.values);
      formRef.current
        ?.querySelector<HTMLElement>(
          '[aria-invalid="true"] input, input[aria-invalid="true"], textarea[aria-invalid="true"]',
        )
        ?.focus();
    } else {
      resultRef.current?.focus();
    }
  }, [state.submittedAt, state.status, state.values, clear, merge]);

  useKeepFocusedAboveKeyboard(formRef, hydrated && layout === "lines");

  const set =
    <K extends keyof BriefValues>(field: K) =>
    (value: BriefValues[K]) =>
      setField(field, value);

  const errorText = (field: keyof BriefValues | "consent") => {
    const code = state.status === "invalid" ? state.errors?.[field] : undefined;
    if (!code) return undefined;
    if (code === "invalid" && (field === "name" || field === "phone" || field === "email")) {
      return copy.errors[field];
    }
    return copy.errors[code];
  };

  const fragment = (key: keyof Copy["fragments"]) =>
    // В раскладке «предложение» фрагменты уже есть наверху.
    layout === "lines" ? copy.fragments[key] : undefined;

  if (state.status === "success") {
    return (
      <div
        ref={resultRef}
        tabIndex={-1}
        role="status"
        className={styles.result}
        data-brief-result="success"
      >
        <h3 className={type.subTitle}>{copy.success.title}</h3>
        <p className={type.lead}>{copy.success.text}</p>
        <div className={styles.resultActions}>
          {whatsappHref && (
            <a
              href={whatsappHref}
              className={styles.primaryLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.success.whatsapp}
            </a>
          )}
          {hydrated ? (
            <button
              type="button"
              className={`${type.link} ${styles.plainButton}`}
              onClick={() => window.location.reload()}
            >
              {copy.success.again}
            </button>
          ) : (
            <a href="" className={type.link}>
              {copy.success.again}
            </a>
          )}
        </div>
      </div>
    );
  }

  const dateModes: DateMode[] =
    variant === "visit" ? ["date", "unknown"] : ["month", "date", "unknown"];
  const hasErrors = state.status === "invalid";
  const failed = state.status === "error" || state.status === "rateLimited";

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className={styles.form}
      data-layout={withSentence && hydrated && layout === "sentence" ? "sentence" : "lines"}
      onSubmit={(event) => {
        // С JS — отправка без сброса формы; без JS — обычный POST (action).
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name={FIELD.source} value={variant} />
      <input type="hidden" name={FIELD.locale} value={locale} />

      {withSentence && hydrated && layout === "sentence" && (
        <BriefSentence
          copy={copy}
          values={values}
          locale={locale}
          fieldIds={{ name: id("name"), phone: id("phone") }}
          onChange={(next) => merge(next)}
        />
      )}

      <p className={styles.note}>{copy.requiredNote}</p>

      <div aria-live="polite" className={styles.summary}>
        {hasErrors && <p className={styles.error}>{copy.errors.summary}</p>}
      </div>

      {show("eventType") && (
        <ChoiceField
          id={id("eventType")}
          name={FIELD.eventType}
          question={copy.questions.eventType}
          fragment={fragment("eventType")}
          mark={copy.optional}
          error={errorText("eventType")}
          value={values.eventType}
          onChange={set("eventType")}
          options={eventTypes.map((value) => ({ value, label: copy.eventTypes[value].label }))}
        />
      )}

      {show("dateMode") && (
        <ChoiceField
          id={id("date")}
          name={FIELD.dateMode}
          question={variant === "visit" ? copy.questions.visitDate : copy.questions.date}
          fragment={fragment("date")}
          mark={copy.optional}
          error={errorText("date") ?? errorText("month") ?? errorText("dateMode")}
          value={values.dateMode}
          onChange={set("dateMode")}
          options={dateModes.map((value) => ({ value, label: copy.dateModes[value] }))}
        >
          {/* Без JS видны оба поля; с JS — только нужное выбранному режиму. */}
          {variant !== "visit" && (!hydrated || values.dateMode === "month") && (
            <SelectField
              id={id("month")}
              name={FIELD.month}
              label={copy.monthLabel}
              value={values.month ?? ""}
              onChange={(v) => setField("month", (v || undefined) as BriefValues["month"])}
              options={months.map((m) => ({ value: m, label: copy.months[m].name }))}
            />
          )}
          {(!hydrated || values.dateMode === "date") && (
            <DateInput
              id={id("dateValue")}
              name={FIELD.date}
              label={copy.dateLabel}
              value={values.date ?? ""}
              onChange={(v) => setField("date", v || undefined)}
            />
          )}
        </ChoiceField>
      )}

      {show("guests") && (
        <ChoiceField
          id={id("guests")}
          name={FIELD.guests}
          question={copy.questions.guests}
          fragment={fragment("guests")}
          mark={copy.optional}
          error={errorText("guests")}
          value={values.guests}
          onChange={set("guests")}
          options={guestRanges.map((value) => ({ value, label: copy.guests[value].label }))}
        />
      )}

      {show("venue") && (
        <ChoiceField
          id={id("venue")}
          name={FIELD.venue}
          question={copy.questions.venue}
          fragment={fragment("venue")}
          mark={copy.optional}
          error={errorText("venue")}
          value={values.venue}
          onChange={set("venue")}
          options={venues.map((value) => ({ value, label: copy.venues[value].label }))}
        />
      )}

      <TextField
        id={id("name")}
        name={FIELD.name}
        question={copy.questions.name}
        fragment={fragment("name")}
        mark={copy.required}
        required
        autoComplete="name"
        maxLength={80}
        error={errorText("name")}
        value={values.name ?? ""}
        onChange={set("name")}
      />

      <TextField
        id={id("phone")}
        name={FIELD.phone}
        question={copy.questions.phone}
        fragment={fragment("phone")}
        mark={copy.required}
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={24}
        hint={copy.phoneHint}
        error={errorText("phone")}
        value={values.phone ?? ""}
        onFocus={() => {
          if (!values.phone) setField("phone", "+7 ");
        }}
        onChange={(v) => setField("phone", formatPhoneMask(v))}
      />

      {show("channel") && (
        <ChoiceField
          id={id("channel")}
          name={FIELD.channel}
          question={copy.questions.channel}
          fragment={fragment("channel")}
          mark={copy.optional}
          error={errorText("channel")}
          value={values.channel}
          onChange={set("channel")}
          options={channels.map((value) => ({ value, label: copy.channels[value] }))}
        />
      )}

      {show("email") && (!hydrated || values.channel === "email") && (
        <TextField
          id={id("email")}
          name={FIELD.email}
          question={copy.questions.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={120}
          hint={copy.emailHint}
          error={errorText("email")}
          value={values.email ?? ""}
          onChange={set("email")}
        />
      )}

      {show("comment") && (
        <TextField
          id={id("comment")}
          name={FIELD.comment}
          question={copy.questions.comment}
          mark={copy.optional}
          multiline
          maxLength={1000}
          error={errorText("comment")}
          value={values.comment ?? ""}
          onChange={set("comment")}
        />
      )}

      <div className={styles.row}>
        <div className={styles.consent}>
          <input
            id={id("consent")}
            type="checkbox"
            name={FIELD.consent}
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            aria-invalid={errorText("consent") ? true : undefined}
            aria-describedby={[
              `${id("consent")}-policy`,
              errorText("consent") && `${id("consent")}-error`,
            ]
              .filter(Boolean)
              .join(" ")}
          />
          <label htmlFor={id("consent")}>
            {copy.consent} <span className={styles.mark}>({copy.required})</span>
          </label>
          <a
            id={`${id("consent")}-policy`}
            href={privacyHref}
            className={type.link}
            target="_blank"
            rel="noopener"
          >
            {copy.consentLink}
          </a>
          {errorText("consent") && (
            <p id={`${id("consent")}-error`} className={styles.error}>
              {errorText("consent")}
            </p>
          )}
        </div>
      </div>

      {/* Ловушка для ботов (раздел 9): людям не видна и не в порядке Tab. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          {copy.honeypot}
          <input
            type="text"
            name={FIELD.honeypot}
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>

      {failed && (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="alert"
          className={styles.failure}
          data-brief-result={state.status}
        >
          <p className={styles.failureTitle}>{copy.failure.title}</p>
          <p>{state.status === "rateLimited" ? copy.failure.rateLimited : copy.failure.text}</p>
          {whatsappHref && (
            <a href={whatsappHref} className={type.link} target="_blank" rel="noopener noreferrer">
              {copy.failure.whatsapp}
            </a>
          )}
        </div>
      )}

      <div>
        <button type="submit" className={styles.submit} aria-disabled={pending || undefined}>
          {pending ? copy.submitting : copy.submit}
        </button>
      </div>
    </form>
  );
}
