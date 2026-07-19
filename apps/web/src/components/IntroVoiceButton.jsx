/**
 * The ▶ "Hear it" control used across the first-run orientation and the roster.
 * Purely presentational: the caller owns the narrator (useIntroNarrator) and
 * decides whether this beat is the one currently speaking. Flips to a stop
 * affordance while its line is playing so a second click silences it.
 *
 * During the cinematic tour, speech auto-plays after Press Start / Meet the
 * team; this button remains for replay/stop. Roster revisit stays click-only.
 */
export default function IntroVoiceButton({
  speaking = false,
  onClick,
  idleLabel = 'Hear it',
  speakingLabel = 'Stop',
  title,
  className = ''
}) {
  return (
    <button
      type="button"
      className={`intro-voice-button ${speaking ? 'is-speaking' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-pressed={speaking}
      title={title}
      data-testid="intro-voice-button"
    >
      <span className="intro-voice-button-icon" aria-hidden="true">
        {speaking ? '◼' : '▶'}
      </span>
      <span className="intro-voice-button-label">{speaking ? speakingLabel : idleLabel}</span>
    </button>
  );
}
