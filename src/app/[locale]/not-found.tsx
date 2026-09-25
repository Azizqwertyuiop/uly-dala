import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <main id="main">
      <h1>{t("title")}</h1>
    </main>
  );
}
