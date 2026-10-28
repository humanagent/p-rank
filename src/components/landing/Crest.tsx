// The Meridian Court Club crest: an oval of laurels, the club name, and a tassel hanging below.
// Ported from the rehearsal crest.
type Props = { width?: number; className?: string };

export function Crest({ width = 96, className }: Props) {
  return (
    <svg
      className={className}
      width={width}
      height={(width * 190) / 96}
      viewBox="0 0 96 190"
      role="img"
      aria-label="Meridian Court Club crest"
    >
      <g fill="none" stroke="var(--forest)">
        <ellipse cx="48" cy="58" rx="38" ry="50" strokeWidth="1.4" />
        <ellipse cx="48" cy="58" rx="33" ry="45" strokeWidth="0.7" />
      </g>
      <g fill="var(--forest)">
        <path d="M14 40 q-6 -6 -2 -14 q6 4 2 14z" />
        <path d="M11 58 q-8 -4 -6 -13 q7 3 6 13z" />
        <path d="M13 76 q-8 -2 -8 -11 q8 2 8 11z" />
        <path d="M20 92 q-8 1 -10 -8 q8 0 10 8z" />
        <path d="M82 40 q6 -6 2 -14 q-6 4 -2 14z" />
        <path d="M85 58 q8 -4 6 -13 q-7 3 -6 13z" />
        <path d="M83 76 q8 -2 8 -11 q-8 2 -8 11z" />
        <path d="M76 92 q8 1 10 -8 q-8 0 -10 8z" />
        <rect x="44" y="4" width="8" height="8" />
        <rect x="8" y="54" width="6" height="8" />
        <rect x="82" y="54" width="6" height="8" />
      </g>
      <text
        x="48"
        y="54"
        textAnchor="middle"
        style={{ fontFamily: "var(--serif)" }}
        fontSize="11.5"
        fontWeight="600"
        letterSpacing="1"
        fill="var(--forest)"
      >
        MERIDIAN
      </text>
      <text
        x="48"
        y="72"
        textAnchor="middle"
        style={{ fontFamily: "var(--serif)" }}
        fontSize="13"
        fontWeight="600"
        letterSpacing="2"
        fill="var(--forest)"
      >
        COURT
      </text>
      {/* hanging tassel: loop, knot, fringe */}
      <g fill="none" stroke="var(--forest)" strokeWidth="1.2" strokeLinecap="round">
        <path d="M48 108 c-14 0 -18 14 -6 16 c8 1 6 -10 -2 -6 M48 108 c14 0 18 14 6 16 c-8 1 -6 -10 2 -6" />
        <path d="M48 120 c-10 6 -10 18 0 22 c10 -4 10 -16 0 -22z" />
        <line x1="40" y1="146" x2="56" y2="146" stroke="var(--bronze)" strokeWidth="2" />
        <line x1="48" y1="142" x2="48" y2="186" />
        <line x1="44" y1="150" x2="43" y2="180" />
        <line x1="52" y1="150" x2="53" y2="180" />
        <line x1="40.5" y1="150" x2="38.5" y2="176" opacity="0.7" />
        <line x1="55.5" y1="150" x2="57.5" y2="176" opacity="0.7" />
      </g>
    </svg>
  );
}
