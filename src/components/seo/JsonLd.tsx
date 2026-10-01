import { serializeLd } from "@/lib/seo/jsonld";

/** Структурированные данные в HTML (раздел 11) — отдаются сервером, без JS. */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // Содержимое — наши данные, «<» экранирован (serializeLd).
      dangerouslySetInnerHTML={{ __html: serializeLd(data) }}
    />
  );
}
