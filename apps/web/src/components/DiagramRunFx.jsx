/**
 * Variant-specific run-FX overlay sitting on top of the diagram surface.
 *
 * `pointer-events: none` everywhere — never blocks interaction.
 * Renders one of five animation tracks while `streaming === true`.
 * All animation lives in App.css under `.diagram-run-fx.is-*`, gated by
 * `prefers-reduced-motion: no-preference` (reduced-motion gets a static tint).
 */

const VARIANT_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain'
};

/** Stable random-ish positions for falling hard-hats — no per-frame churn. */
const HARD_HAT_LANES = [
  { left: 6, delay: 0, dur: 2.6 },
  { left: 16, delay: 0.6, dur: 2.4 },
  { left: 27, delay: 1.2, dur: 2.8 },
  { left: 38, delay: 0.2, dur: 2.5 },
  { left: 49, delay: 1.6, dur: 2.7 },
  { left: 61, delay: 0.4, dur: 2.3 },
  { left: 72, delay: 1.4, dur: 2.9 },
  { left: 84, delay: 0.9, dur: 2.5 },
  { left: 92, delay: 1.9, dur: 2.7 }
];

/** Numbered pin positions for the Explain overlay. Reading order top-left → mid → bottom-right. */
const PIN_SLOTS = [
  { top: 12, left: 14, delay: 0.0 },
  { top: 20, left: 64, delay: 0.6 },
  { top: 48, left: 32, delay: 1.2 },
  { top: 56, left: 78, delay: 1.8 },
  { top: 78, left: 22, delay: 2.4 }
];

function SparkleSvg() {
  return (
    <svg className="diagram-run-fx-sparkle-svg" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 0 7 5l5 1-5 1-1 5-1-5-5-1 5-1z"
      />
    </svg>
  );
}

function SquiggleSvg() {
  return (
    <svg className="diagram-run-fx-squiggle-svg" viewBox="0 0 80 20" width="80" height="20" aria-hidden="true">
      <path
        d="M2 12 Q 8 2, 14 12 T 26 12 T 38 12 T 50 12 T 62 12 T 76 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LightningSvg() {
  return (
    <svg className="diagram-run-fx-zap-svg" viewBox="0 0 32 64" width="32" height="64" aria-hidden="true">
      <path fill="currentColor" d="M18 0 4 36h10L8 64l22-40H18z" />
    </svg>
  );
}

function PinSvg({ number }) {
  return (
    <svg className="diagram-run-fx-pin-svg" viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 0c-5.5 0-10 4.5-10 10 0 7.5 10 22 10 22s10-14.5 10-22C22 4.5 17.5 0 12 0z"
      />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#fff"
        fontFamily="system-ui, sans-serif"
      >
        {number}
      </text>
    </svg>
  );
}

export default function DiagramRunFx({ variant, streaming = false, intensity = 'normal' }) {
  if (!streaming || !variant || !VARIANT_CLASS[variant]) return null;
  const className = [
    'diagram-run-fx',
    VARIANT_CLASS[variant],
    intensity === 'high' ? 'is-intensity-high' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} aria-hidden="true" data-testid="diagram-run-fx">
      {variant === 'refine' ? (
        <>
          <div className="diagram-run-fx-polish-sweep" />
          <div className="diagram-run-fx-sparkle-field">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={`sparkle-${i}`}
                className="diagram-run-fx-sparkle"
                style={{
                  left: `${10 + i * 14}%`,
                  animationDelay: `${i * 0.45}s`
                }}
              >
                <SparkleSvg />
              </span>
            ))}
          </div>
        </>
      ) : null}

      {variant === 'innovate' ? (
        <>
          <div className="diagram-run-fx-synthgrid" />
          <span className="diagram-run-fx-zap diagram-run-fx-zap-1">
            <LightningSvg />
          </span>
          <span className="diagram-run-fx-zap diagram-run-fx-zap-2">
            <LightningSvg />
          </span>
        </>
      ) : null}

      {variant === 'goMad' ? (
        <>
          <div className="diagram-run-fx-glitch-layer" />
          {HARD_HAT_LANES.map((lane, i) => (
            <span
              key={`hardhat-${i}`}
              className="diagram-run-fx-hardhat"
              style={{
                left: `${lane.left}%`,
                animationDelay: `${lane.delay}s`,
                animationDuration: `${lane.dur}s`
              }}
            >
              🪖
            </span>
          ))}
          {intensity === 'high' ? (
            <>
              <span className="diagram-run-fx-flame diagram-run-fx-flame-1">🔥</span>
              <span className="diagram-run-fx-flame diagram-run-fx-flame-2">🔥</span>
            </>
          ) : null}
        </>
      ) : null}

      {variant === 'critique' ? (
        <>
          <div className="diagram-run-fx-manila-vignette" />
          {[0, 1, 2, 3].map((i) => (
            <span
              key={`squiggle-${i}`}
              className="diagram-run-fx-squiggle"
              style={{
                top: `${15 + i * 22}%`,
                left: `${20 + (i % 2) * 35}%`,
                animationDelay: `${i * 0.7}s`
              }}
            >
              <SquiggleSvg />
            </span>
          ))}
          <div className="diagram-run-fx-stamp">REVIEWING</div>
        </>
      ) : null}

      {variant === 'explain' ? (
        <>
          <div className="diagram-run-fx-parchment-vignette" />
          {PIN_SLOTS.map((slot, i) => (
            <span
              key={`pin-${i}`}
              className="diagram-run-fx-pin"
              style={{
                top: `${slot.top}%`,
                left: `${slot.left}%`,
                animationDelay: `${slot.delay}s`
              }}
            >
              <PinSvg number={i + 1} />
            </span>
          ))}
        </>
      ) : null}
    </div>
  );
}
