import type {
  Channel,
  DateMode,
  EventType,
  GuestRange,
  Month,
  Source,
  Venue,
} from "@/lib/brief/model";
import type { Locale } from "@/lib/i18n";

/** Проверенная заявка (после zod). */
export type Lead = {
  source: Source;
  locale: Locale;
  eventType?: EventType;
  dateMode?: DateMode;
  month?: Month;
  date?: string;
  guests?: GuestRange;
  venue?: Venue;
  name: string;
  phone: string;
  channel?: Channel;
  email?: string;
  comment?: string;
};

export type StoredLead = Lead & { id: string; createdAt: string; consentAt: string };

/** Коды ошибок полей — тексты в messages (brief.errors). */
export type FieldErrorCode = "required" | "invalid" | "tooLong" | "consent";

export type FieldErrors = Partial<Record<keyof Lead | "consent", FieldErrorCode>>;
