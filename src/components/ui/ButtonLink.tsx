import type { ComponentProps } from "react";
import { Link } from "@/lib/intl/navigation";
import styles from "./ButtonLink.module.css";

type Props = {
  href: ComponentProps<typeof Link>["href"];
  variant?: "primary" | "secondary";
  children: React.ReactNode;
  /** Связь со сценой: hover на главной кнопке первого экрана ярче полосу рассвета. */
  dawnHover?: boolean;
};

/** Кнопка-ссылка. Работает без JS: это обычная ссылка. */
export function ButtonLink({ href, variant = "primary", children, dawnHover }: Props) {
  const className = variant === "primary" ? styles.button : `${styles.button} ${styles.secondary}`;
  return (
    <Link href={href} className={className} data-dawn-hover={dawnHover ? "" : undefined}>
      {children}
    </Link>
  );
}
