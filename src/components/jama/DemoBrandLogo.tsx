// Temporary, fictional wordmarks used exclusively by the example catalog.
export function DemoBrandLogo({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 80 64"
      role="img"
      aria-label={`Logo provisional de ${name}`}
      className="h-12 w-16 shrink-0"
    >
      <rect x="1" y="1" width="78" height="62" rx="16" fill="#FAF8EF" />
      <path d="M24 21 Q40 4 56 21 L52 28 H28 Z" fill="#D4DC31" />
      <path
        d="M31 20 Q40 13 49 20"
        fill="none"
        stroke="#1E2B4D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text
        x="40"
        y="48"
        textAnchor="middle"
        fill="#1E2B4D"
        fontFamily="Nunito, sans-serif"
        fontSize="17"
        fontWeight="900"
      >
        {name}
      </text>
    </svg>
  );
}
