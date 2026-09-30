import styles from "./sections.module.css";

type Props = { title: string; city: string; fazenda: string };

/*
 * Схема дороги: фазенда в степи — линия — Алматы у гор. Не карта: без масштаба (подпись рядом).
 * TODO(client-data): при подтверждённом адресе — положение точки по реальному направлению.
 */
export function FazendaMap({ title, city, fazenda }: Props) {
  return (
    <svg
      className={styles.worldMap}
      viewBox="0 0 640 240"
      role="img"
      aria-labelledby="fazenda-map-title"
    >
      <title id="fazenda-map-title">{title}</title>
      {/* Горы за городом. */}
      <path
        d="M300 170 L352 132 L380 150 L430 104 L468 138 L510 96 L560 142 L600 118 L640 150"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* Горизонт. */}
      <path d="M0 190 H640" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      {/* Город — огни у горизонта. */}
      <g fill="currentColor" fillOpacity="0.7">
        {[468, 482, 494, 506, 520, 534, 546, 560, 574].map((x, i) => (
          <rect key={x} x={x} y={190 - 6 - (i % 3) * 5} width="6" height={6 + (i % 3) * 5} />
        ))}
      </g>
      {/* Дорога. */}
      <path
        d="M122 190 C 220 206, 360 206, 468 190"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="6 6"
      />
      {/* Фазенда: купол юрты и точка. */}
      <path d="M96 190 A 18 14 0 0 1 132 190 Z" fill="currentColor" fillOpacity="0.85" />
      <circle cx="114" cy="202" r="4" fill="var(--ember)" />
      <text x="114" y="228" textAnchor="middle" className={styles.worldMapLabel}>
        {fazenda}
      </text>
      <text x="522" y="228" textAnchor="middle" className={styles.worldMapLabel}>
        {city}
      </text>
    </svg>
  );
}
