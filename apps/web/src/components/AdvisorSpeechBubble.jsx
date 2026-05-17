import { getVariantPersona } from '../utils/slopitectCopy.js';

const PERSONA_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain'
};

/**
 * Floating speech bubble that surfaces a proactive suggestion from the active
 * council persona. Anchored above the dock mascot so the tail points down toward
 * the avatar without overlapping it.
 *
 * Interaction:
 * - Hover the bubble → orchestrator pauses the auto-dismiss timer.
 * - Mouse leaves the bubble → timer resumes (unless pinned).
 * - Click the bubble body (not Go/×) → toggle pin: bubble stays until Go or ×.
 *
 * Purely presentational; all timing/state lives in `useAdvisorOrchestrator`.
 */
export default function AdvisorSpeechBubble({
  persona,
  suggestion,
  isPinned = false,
  onGo,
  onDismiss,
  onTogglePin,
  onPauseTimer,
  onResumeTimer
}) {
  if (!persona || !suggestion) return null;
  const meta = getVariantPersona(persona);
  const personaClass = PERSONA_CLASS[persona] || '';
  const accent = meta.accentColorVar || 'var(--accent)';
  const accentStyle = accent.startsWith('--') ? `var(${accent})` : accent;
  const style = { '--advisor-accent': accentStyle };

  const handleBubbleClick = (event) => {
    // Ignore clicks that originated on Go/Dismiss buttons — their handlers run separately.
    if (event.target?.closest?.('.advisor-speech-btn')) return;
    onTogglePin?.();
  };

  return (
    <div
      className={`advisor-speech-bubble ${personaClass} ${isPinned ? 'is-pinned' : ''}`}
      role="status"
      aria-live="polite"
      style={style}
      data-testid="advisor-speech-bubble"
      onClick={handleBubbleClick}
      onPointerEnter={onPauseTimer}
      onPointerLeave={onResumeTimer}
      title={isPinned ? 'Pinned — click to unpin' : 'Click to pin this suggestion'}
    >
      <span className="advisor-speech-emoji" aria-hidden="true">{meta.avatarEmoji || '🏗️'}</span>
      <div className="advisor-speech-body">
        <span className="advisor-speech-persona">
          {meta.name}
          {isPinned ? <span className="advisor-speech-pin" aria-label="Pinned">📌</span> : null}
        </span>
        <span className="advisor-speech-text">{suggestion}</span>
      </div>
      <div className="advisor-speech-actions">
        <button
          type="button"
          className="advisor-speech-btn advisor-speech-btn--go"
          onClick={(event) => { event.stopPropagation(); onGo?.(); }}
          aria-label={`Apply suggestion from ${meta.name}`}
        >
          Go
        </button>
        <button
          type="button"
          className="advisor-speech-btn advisor-speech-btn--dismiss"
          onClick={(event) => { event.stopPropagation(); onDismiss?.(); }}
          aria-label="Dismiss suggestion"
        >
          ×
        </button>
      </div>
    </div>
  );
}
