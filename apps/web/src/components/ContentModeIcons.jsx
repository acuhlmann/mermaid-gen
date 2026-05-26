/** Tiny mode badges for Thinking-pane run metadata (engine logos at chip scale). */

export function ThreeJsModeIcon({ className = 'insights-entry-meta-icon' }) {
  return (
    <svg className={className} viewBox="0 0 226.77 226.77" aria-hidden="true">
      <g
        transform="translate(8.964 4.2527)"
        fillRule="evenodd"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeWidth="4"
      >
        <path d="m63.02 200.61-43.213-174.94 173.23 49.874z" />
        <path d="m106.39 50.612 21.591 87.496-86.567-24.945z" />
        <path d="m84.91 125.03-10.724-43.465 43.008 12.346z" />
        <path d="m63.458 38.153 10.724 43.465-43.008-12.346z" />
        <path d="m149.47 62.93 10.724 43.465-43.008-12.346z" />
        <path d="m84.915 125.06 10.724 43.465-43.008-12.346z" />
      </g>
    </svg>
  );
}

/** Vega-Lite mark (simplified from the official VL_Color logo). */
export function VegaLiteModeIcon({ className = 'insights-entry-meta-icon' }) {
  return (
    <svg className={className} viewBox="0 0 64 48" aria-hidden="true">
      <polygon fill="currentColor" points="37 48 64 48 64 36 50 36 50 0 37 0 37 48" />
      <polygon fill="currentColor" opacity="0.72" points="17 48 33 48 16 0 0 0 17 48" />
      <polygon fill="currentColor" opacity="0.88" points="33 48 17 48 34 0 50 0 33 48" />
    </svg>
  );
}

/** AntV-style angular mark for the Infographic slot (@antv/infographic). */
export function AntVModeIcon({ className = 'insights-entry-meta-icon' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M1.5 14 8 2 10.2 2 14.5 14Z" />
      <path fill="currentColor" opacity="0.58" d="M5.5 14 9.8 2 12 2 15.5 14Z" />
    </svg>
  );
}
