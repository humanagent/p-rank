// The watercolor hall: a glass padel court under a gilded ceiling, the Invitational banner on the back wall.
// The watercolor look is three SVG filters: a wash, a torn paper edge and a grain.
const RAFTERS: [number, number][] = [
  [90, 345], [170, 380], [250, 415], [330, 450], [410, 490], [490, 530], [570, 575],
  [630, 625], [710, 670], [790, 710], [870, 750], [950, 785], [1030, 820], [1110, 855],
];

export function Hall({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 640"
      role="img"
      aria-label="Watercolor of a glass padel court under a gilded ceiling, the Summer Invitational banner on the back wall"
    >
      <defs>
        <filter id="mcc-wash" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.4" />
        </filter>
        <filter id="mcc-edge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="mcc-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" />
          <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0.10 0" />
        </filter>
        <mask id="mcc-paper">
          <rect x="40" y="40" width="1120" height="600" fill="#ffffff" filter="url(#mcc-edge)" />
        </mask>
      </defs>
      <g mask="url(#mcc-paper)">
        <g filter="url(#mcc-wash)">
          <rect x="0" y="0" width="1200" height="640" fill="#d8c29a" />
          <polygon points="0,30 1200,30 1200,640 0,640" fill="#cdb183" opacity="0.6" />
          <polygon points="40,40 330,290 330,560 40,640" fill="#b99766" opacity="0.75" />
          <polygon points="1160,40 870,290 870,560 1160,640" fill="#b99766" opacity="0.75" />
          <rect x="330" y="290" width="540" height="270" fill="#eadcbd" />
          <polygon points="40,40 1160,40 870,290 330,290" fill="#c99b4c" />
          <polygon points="120,40 1080,40 840,250 360,250" fill="#e2bd72" opacity="0.7" />
          <polygon points="300,40 900,40 760,200 440,200" fill="#f3dca2" opacity="0.65" />
        </g>
        <g stroke="#8c6a35" strokeWidth="2.2" opacity="0.55" filter="url(#mcc-wash)">
          {RAFTERS.map(([top, bottom]) => (
            <line key={top} x1={top} y1="44" x2={bottom} y2="288" />
          ))}
        </g>
        <g filter="url(#mcc-wash)">
          <rect x="430" y="320" width="340" height="150" fill="#f6eedb" stroke="#bfa476" strokeWidth="3" />
        </g>
        <g opacity="0.75">
          <ellipse cx="600" cy="370" rx="22" ry="28" fill="none" stroke="#8c6a35" strokeWidth="1.6" />
          <text x="600" y="377" textAnchor="middle" style={{ fontFamily: "var(--serif)" }} fontSize="20" fontStyle="italic" fill="#8c6a35">
            M
          </text>
          <text x="600" y="442" textAnchor="middle" style={{ fontFamily: "var(--serif)" }} fontSize="30" letterSpacing="6" fill="#8c6a35">
            SUMMER INVITATIONAL
          </text>
        </g>
        <g filter="url(#mcc-wash)">
          <polygon points="300,560 900,560 1100,640 100,640" fill="#5e8f6b" />
          <polygon points="330,500 870,500 900,560 300,560" fill="#6d9c78" opacity="0.9" />
        </g>
        <g fill="none" stroke="#f7f1e3" strokeWidth="2.4" opacity="0.9">
          <polyline points="330,500 870,500 1100,640" />
          <line x1="330" y1="500" x2="100" y2="640" />
          <line x1="230" y1="590" x2="970" y2="590" />
          <line x1="600" y1="500" x2="600" y2="640" />
        </g>
        <rect x="265" y="556" width="670" height="10" fill="#2a3a30" opacity="0.8" />
        <rect x="330" y="400" width="540" height="100" fill="#ffffff" opacity="0.18" />
        <g fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.6">
          <rect x="330" y="400" width="540" height="100" />
          <line x1="465" y1="400" x2="465" y2="500" />
          <line x1="600" y1="400" x2="600" y2="500" />
          <line x1="735" y1="400" x2="735" y2="500" />
          <polyline points="330,400 160,520 160,640" />
          <polyline points="870,400 1040,520 1040,640" />
        </g>
        <rect x="0" y="0" width="1200" height="640" filter="url(#mcc-grain)" />
      </g>
    </svg>
  );
}
