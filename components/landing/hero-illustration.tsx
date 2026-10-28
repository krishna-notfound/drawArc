// Decorative: four nodes joined by connectors. Colours come from CSS variables only (no hex).
export function HeroIllustration(): React.JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 480 320" className="h-auto w-full text-brand">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M150 90 H210 Q240 90 240 120 V140" />
        <path d="M330 90 H270 Q240 90 240 120" />
        <path d="M240 200 V230" />
      </g>
      <g fill="currentColor">
        <circle cx="240" cy="140" r="4" />
        <circle cx="240" cy="230" r="4" />
      </g>
      <g fill="var(--bg-surface)" stroke="var(--border-default)" strokeWidth="2">
        <rect x="40" y="60" width="110" height="60" rx="12" />
        <rect x="330" y="60" width="110" height="60" rx="12" />
        <rect x="170" y="140" width="140" height="60" rx="12" />
        <rect x="170" y="230" width="140" height="60" rx="12" />
      </g>
      <g fill="var(--border-default)">
        <rect x="58" y="84" width="60" height="8" rx="4" />
        <rect x="348" y="84" width="60" height="8" rx="4" />
        <rect x="190" y="164" width="80" height="8" rx="4" />
        <rect x="190" y="254" width="80" height="8" rx="4" />
      </g>
    </svg>
  );
}
