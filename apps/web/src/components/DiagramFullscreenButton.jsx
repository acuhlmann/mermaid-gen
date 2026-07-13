import { useUiCopy } from '../i18n/useUiLocale.js';

function FullscreenEnterIcon() {
  return (
    <svg
      className="diagram-fullscreen-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9V4h5M4 4l6 6M20 9V4h-5M20 4l-6 6M4 15v5h5M4 20l6-6M20 15v5h-5M20 20l-6-6"
      />
    </svg>
  );
}

function FullscreenExitIcon() {
  return (
    <svg
      className="diagram-fullscreen-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 4H4v5M4 4l6 6M15 4h5v5M20 4l-6 6M9 20H4v-5M4 20l6-6M15 20h5v-5M20 20l-6-6"
      />
    </svg>
  );
}

export default function DiagramFullscreenButton({
  isFullscreen = false,
  disabled = false,
  onToggle
}) {
  const { controls } = useUiCopy();
  const label = isFullscreen ? controls.fullscreen.exit : controls.fullscreen.enter;
  return (
    <button
      type="button"
      className="diagram-fullscreen-btn"
      title={label}
      aria-label={label}
      aria-pressed={isFullscreen}
      disabled={disabled}
      onClick={() => {
        void onToggle?.();
      }}
    >
      {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
    </button>
  );
}
