/**
 * Optional captions for the voice-first orientation — like a video CC toggle.
 * Off by default; when on, the tour reveals the spoken lines as readable text.
 */
export default function IntroTranscriptButton({
  enabled = false,
  onToggle,
  label,
  enabledLabel,
  title,
  className = ''
}) {
  return (
    <button
      type="button"
      className={`intro-transcript-button${enabled ? ' is-on' : ''} ${className}`.trim()}
      onClick={onToggle}
      aria-pressed={enabled}
      title={title}
      data-testid="intro-transcript-button"
    >
      <span className="intro-transcript-button-icon" aria-hidden="true">
        CC
      </span>
      <span className="intro-transcript-button-label">{enabled ? enabledLabel : label}</span>
    </button>
  );
}
