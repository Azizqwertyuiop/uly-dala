import { useTranslations } from "next-intl";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type from "@/components/ui/type.module.css";

export default function NotFound() {
  const t = useTranslations("notFound");
  const common = useTranslations("common");

  return (
    <PageShell tone="dark">
      <div className={pageStyles.head}>
        <h1 className={type.chapterTitle}>{t("title")}</h1>
        <div>
          <ButtonLink href="/">{common("backHome")}</ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
