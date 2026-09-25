/*
 * Статичный кадр первого экрана — «момент контровой линии» (раздел 2): предрассветная степь,
 * узкая тёплая полоса у горизонта на 72% высоты, силуэт коня на правой трети с контровым светом.
 * Показывается до готовности 3D, в fallback, в reduced motion и в режиме «Коротко».
 *
 * Inline SVG, а не <img>: вектор не участвует в LCP — крупнейший элемент первого экрана —
 * HTML-заголовок, он рисуется с первой отрисовкой. Описание сцены — aria-label.
 */
export function HeroFrame({ label, className }: { label: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label={label}
      data-scene-slot=""
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10131c" />
          <stop offset="0.55" stopColor="#1c2230" />
          <stop offset="0.68" stopColor="#3a3550" />
          <stop offset="0.72" stopColor="#c9824a" />
        </linearGradient>
        <radialGradient
          id="hero-glow"
          cx="0.68"
          cy="0.72"
          r="0.42"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#e8a060" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e8a060" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141820" />
          <stop offset="1" stopColor="#0b0d12" />
        </linearGradient>
      </defs>
      <rect width="1600" height="648" fill="url(#hero-sky)" />
      <rect width="1600" height="648" fill="url(#hero-glow)" />
      {/* Горы — силуэты в дымке. */}
      <path
        d="M0 640 L140 628 L260 634 L420 620 L560 632 L700 624 L860 636 L1000 626 L1180 634 L1340 622 L1600 632 L1600 648 L0 648 Z"
        fill="#2a2840"
        opacity="0.8"
      />
      <rect y="648" width="1600" height="252" fill="url(#hero-ground)" />
      <rect y="647" width="1600" height="2" fill="#e8a060" opacity="0.8" />
      {/* Конь на правой трети, мордой влево, голова пересекает горизонт; контровой свет — по верху. */}
      <g transform="translate(1066 648)">
        <path
          d="M-34 -2 L-30 -22 C-38 -30 -44 -42 -40 -52 L-46 -62 L-40 -60 L-34 -54 C-26 -48 -22 -38 -16 -30 C-4 -30 18 -28 30 -24 C38 -20 40 -12 36 -2 L32 -2 L30 -14 L22 -12 L20 -2 L16 -2 L14 -12 L-10 -14 L-14 -2 L-18 -2 L-20 -14 L-26 -16 L-28 -2 Z"
          fill="#0e1016"
        />
        <path
          d="M-40 -52 L-46 -62 L-40 -60 L-34 -54 C-26 -48 -22 -38 -16 -30 C-4 -30 18 -28 30 -24"
          fill="none"
          stroke="#f2c890"
          strokeWidth="1.2"
          opacity="0.85"
        />
      </g>
    </svg>
  );
}
