import { getVariantPersona } from '../utils/slopitectCopy.js';

const PERSONA_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain',
  exec: 'is-exec'
};

/**
 * Floating speech bubble that surfaces a proactive suggestion from the active
 * stakeholders persona. Anchored above the dock mascot so the tail points down toward
 * the avatar without overlapping it.
 *
 * Interaction:
 * - Hover the bubble → orchestrator pauses the auto-dismiss timer.
 * - Mouse leaves the bubble → timer resumes (unless pinned).
 * - Click the bubble body (not Do it/×) → toggle pin: bubble stays until Do it or ×.
 *
 * `kind`: 'suggestion' shows the Do-it button (default — actionable). 'comment' hides
 * it — the persona is just weighing in, not proposing a change.
 *
 * The Wise Architect (persona='explain') is always 'comment' — never gets Do-it — but
 * gets two ivory-tower-friendly actions instead: "Dumb it Down" (rephrase plainly)
 * and "Drill deeper" (open the full Thinking-pane dissertation).
 *
 * Purely presentational; all timing/state lives in `useAdvisorOrchestrator`.
 */
export default function AdvisorSpeechBubble({
  persona,
  suggestion,
  kind = 'suggestion',
  isPinned = false,
  isDumbingDown = false,
  onGo,
  onDismiss,
  onTogglePin,
  onPauseTimer,
  onResumeTimer,
  onDumbDown,
  onDrillDeeper
}) {
  if (!persona || !suggestion) return null;
  const meta = getVariantPersona(persona);
  const personaClass = PERSONA_CLASS[persona] || '';
  const accent = meta.accentColorVar || 'var(--accent)';
  const accentStyle = accent.startsWith('--') ? `var(${accent})` : accent;
  const style = { '--advisor-accent': accentStyle };
  const isComment = kind === 'comment';
  const isArchitect = persona === 'explain';
  const showArchitectActions = isArchitect && (onDumbDown || onDrillDeeper);

  const handleBubbleClick = (event) => {
    // Ignore clicks that originated on Do-it/Dismiss buttons — their handlers run separately.
    if (event.target?.closest?.('.advisor-speech-btn')) return;
    onTogglePin?.();
  };

  return (
    <div
      className={`advisor-speech-bubble ${personaClass} ${isPinned ? 'is-pinned' : ''} ${isComment ? 'is-comment' : 'is-suggestion'}`}
      role="status"
      aria-live="polite"
      style={style}
      data-testid="advisor-speech-bubble"
      data-kind={isComment ? 'comment' : 'suggestion'}
      onClick={handleBubbleClick}
      onPointerEnter={onPauseTimer}
      onPointerLeave={onResumeTimer}
      title={isPinned ? 'Pinned — click to unpin' : 'Click to pin this comment'}
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
        {isComment ? null : (
          <button
            type="button"
            className="advisor-speech-btn advisor-speech-btn--go"
            onClick={(event) => { event.stopPropagation(); onGo?.(); }}
            aria-label={`Apply suggestion from ${meta.name}`}
          >
            Do it
          </button>
        )}
        {showArchitectActions && onDumbDown ? (
          <button
            type="button"
            className="advisor-speech-btn advisor-speech-btn--dumb"
            onClick={(event) => { event.stopPropagation(); onDumbDown?.(); }}
            disabled={isDumbingDown}
            aria-label="Dumb it down — rephrase in plain English"
            title="Translate the architect's musing into plain English"
          >
            {isDumbingDown ? 'Dumbing…' : 'Dumb it Down'}
          </button>
        ) : null}
        {showArchitectActions && onDrillDeeper ? (
          <button
            type="button"
            className="advisor-speech-btn advisor-speech-btn--drill"
            onClick={(event) => { event.stopPropagation(); onDrillDeeper?.(); }}
            disabled={isDumbingDown}
            aria-label="Drill deeper — open the full architecture dissertation"
            title="Open the full architecture deep-dive in the Thinking panel"
          >
            Drill Deeper
          </button>
        ) : null}
        <button
          type="button"
          className="advisor-speech-btn advisor-speech-btn--dismiss"
          onClick={(event) => { event.stopPropagation(); onDismiss?.(); }}
          aria-label={isComment ? 'Dismiss comment' : 'Dismiss suggestion'}
        >
          ×
        </button>
      </div>
    </div>
  );
}
