/*
 * TODO(brand): временный вордмарк. Финальный знак ULY DALA — отдельный SVG от дизайнера,
 * не набирается шрифтом (CLAUDE.md, раздел 4). Здесь — заглушка той же геометрии.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 168 28"
      width="168"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <text
        x="0"
        y="20"
        fill="currentColor"
        style={{ font: "500 22px var(--font-family-heading)", letterSpacing: "0.08em" }}
      >
        ULY DALA
      </text>
      <rect x="0" y="26" width="168" height="1" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
