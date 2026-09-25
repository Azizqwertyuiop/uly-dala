import type { ComponentProps } from "react";
import { Link } from "@/lib/intl/navigation";
import styles from "./ButtonLink.module.css";

type Props = {
  href: ComponentProps<typeof Link>["href"];
  variant?: "primary" | "secondary";
  children: React.ReactNode;
};

/** Кнопка-ссылка. Работает без JS: это обычная ссылка. */
export function ButtonLink({ href, variant = "primary", children }: Props) {
  const className = variant === "primary" ? styles.button : `${styles.button} ${styles.secondary}`;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
