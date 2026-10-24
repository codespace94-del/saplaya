/** Retail mode graphic: one woven basket with produce. */
export function BasketGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 180" className={className} fill="none" aria-hidden="true">
      <path d="M52 78c4-48 92-48 96 0" stroke="#B07A3E" strokeWidth="9" strokeLinecap="round" />
      <circle cx="78" cy="78" r="17" fill="#E53935" />
      <circle cx="108" cy="70" r="16" fill="#FFB300" />
      <circle cx="132" cy="84" r="13" fill="#4CAF50" />
      <path d="M118 52c8-12 22-12 26-4-9 1-17 3-26 4z" fill="#2E7D32" />
      <path d="M26 88h148l-14 76a12 12 0 0 1-12 10H52a12 12 0 0 1-12-10L26 88z" fill="#C98F4B" />
      <path d="M26 88h148l-3 17H29l-3-17z" fill="#B07A3E" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${46 + i * 27} 108l-6 58`} stroke="#8A5A26" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      ))}
      <path d="M36 128h128M42 150h116" stroke="#8A5A26" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/** Wholesale mode graphic: stacked wooden crates. */
export function CratesGraphic({ className }: { className?: string }) {
  const Crate = ({ x, y }: { x: number; y: number }) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="84" height="46" rx="5" fill="#C98F4B" stroke="#8A5A26" strokeWidth="3" />
      <path d="M0 15h84M0 31h84" stroke="#8A5A26" strokeWidth="3" />
      <rect x="9" y="-2" width="7" height="50" fill="#8A5A26" opacity="0.5" />
      <rect x="68" y="-2" width="7" height="50" fill="#8A5A26" opacity="0.5" />
    </g>
  );
  return (
    <svg viewBox="0 0 200 180" className={className} fill="none" aria-hidden="true">
      <circle cx="62" cy="58" r="13" fill="#E53935" />
      <circle cx="84" cy="54" r="12" fill="#E53935" />
      <circle cx="136" cy="62" r="13" fill="#FFB300" />
      <circle cx="154" cy="58" r="11" fill="#FFB300" />
      <Crate x={58} y={64} />
      <Crate x={12} y={112} />
      <Crate x={104} y={112} />
    </svg>
  );
}
