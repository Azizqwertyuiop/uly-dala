import layout from "@/components/ui/layout.module.css";
import type { Tone } from "@/components/sections/chapters";
import styles from "./Page.module.css";

/** Обёртка внутренних страниц: <main>, тон, сетка. */
export function PageShell({
  tone = "light",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <main id="main" tabIndex={-1} data-tone={tone} className={styles.page}>
      <div className={`${layout.container} ${styles.inner}`}>{children}</div>
    </main>
  );
}

export { styles as pageStyles };
