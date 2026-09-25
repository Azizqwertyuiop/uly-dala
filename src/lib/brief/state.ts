import type { BriefValues, Source } from "./model";

export type FieldErrorCode = "required" | "invalid" | "tooLong" | "consent";

/** Состояние формы после отправки — общее для браузера и сервера. */
export type BriefFormState = {
  status: "idle" | "success" | "invalid" | "rateLimited" | "error";
  source: Source;
  errors?: Partial<Record<keyof BriefValues | "consent", FieldErrorCode>>;
  /** Введённые значения возвращаются при ошибке: без JS форма перерисуется заполненной. */
  values?: BriefValues;
  /** Меняется при каждой отправке — чтобы реагировать (фокус, прокрутка) на каждую. */
  submittedAt?: number;
};

export const initialBriefState = (source: Source): BriefFormState => ({ status: "idle", source });
