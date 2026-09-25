"use client";

import type { ChangeEvent, ReactNode } from "react";
import styles from "./brief.module.css";

/*
 * Поля брифа. Каждое поле — вопрос: <fieldset><legend> для групп, <label> для текстовых.
 * Ошибка — текстом у поля (aria-describedby + aria-invalid), подсказка — там же.
 * Фрагмент предложения («Мы планируем…») — визуальный, для раскладки «строка + поле».
 */

type Common = {
  id: string;
  question: string;
  fragment?: string;
  error?: string;
  hint?: string;
  /** Подпись «обязательно» / «необязательно». */
  mark?: string;
};

function describedBy(id: string, hint?: string, error?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

function Fragment({ text }: { text?: string }) {
  return text ? (
    <p className={styles.fragment} aria-hidden="true">
      {text}
    </p>
  ) : null;
}

function Messages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}

export function ChoiceField<T extends string>({
  id,
  name,
  question,
  fragment,
  error,
  hint,
  mark,
  options,
  value,
  onChange,
  children,
}: Common & {
  name: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  children?: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <Fragment text={fragment} />
      <fieldset
        className={styles.fieldset}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
      >
        <legend className={styles.question}>
          {question}
          {mark && <span className={styles.mark}> ({mark})</span>}
        </legend>
        <div className={styles.options}>
          {options.map((option) => (
            <label key={option.value} className={styles.option}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {children}
        <Messages id={id} hint={hint} error={error} />
      </fieldset>
    </div>
  );
}

export function TextField({
  id,
  name,
  question,
  fragment,
  error,
  hint,
  mark,
  value,
  onChange,
  onFocus,
  required,
  type = "text",
  autoComplete,
  inputMode,
  multiline,
  maxLength,
}: Common & {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  required?: boolean;
  type?: "text" | "tel" | "email";
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email";
  multiline?: boolean;
  maxLength?: number;
}) {
  const common = {
    id,
    name,
    value,
    required,
    maxLength,
    "aria-describedby": describedBy(id, hint, error),
    "aria-invalid": error ? true : undefined,
    className: styles.input,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    onFocus,
  };
  return (
    <div className={styles.row}>
      <Fragment text={fragment} />
      <div className={styles.field}>
        <label htmlFor={id} className={styles.question}>
          {question}
          {mark && <span className={styles.mark}> ({mark})</span>}
        </label>
        {multiline ? (
          <textarea {...common} rows={3} />
        ) : (
          <input {...common} type={type} autoComplete={autoComplete} inputMode={inputMode} />
        )}
        <Messages id={id} hint={hint} error={error} />
      </div>
    </div>
  );
}

export function SelectField({
  id,
  name,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.subField}>
      <label htmlFor={id} className={styles.subLabel}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        className={styles.input}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DateInput({
  id,
  name,
  label,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.subField}>
      <label htmlFor={id} className={styles.subLabel}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="date"
        value={value}
        className={styles.input}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
