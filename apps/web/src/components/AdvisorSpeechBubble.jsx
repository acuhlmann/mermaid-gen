import {
  getLabelExplainDumbLevel,
  isLabelExplainGiveUpLevel,
  labelExplainDumbAudienceBadge,
  labelExplainDumbChipLabel,
  labelExplainDumbLoadingText
} from '@archislop/shared';
import { getVariantPersona } from '../utils/slopitectCopy.js';
import StakeholderCastStrip from './StakeholderCastStrip.jsx';

const PERSONA_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain',
  exec: 'is-exec'
};

function IconChevronLeft() {
  return (
    <svg className="advisor-speech-nav-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}

function IconPromptNext() {
  return (
    <svg className="advisor-speech-nav-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h2v16H4V4zm13.17 2.59-1.41 1.41L16.17 11H8v2h8.17l-2.41 2.59 1.41 1.41L21 12l-3.83-5.41z"
      />
    </svg>
  );
}

/**
 * Floating speech bubble that surfaces a proactive suggestion from the active
 * stakeholders persona. Anchored above the dock mascot so the tail points down toward
 * the avatar without overlapping it.
 */
export default function AdvisorSpeechBubble({
  persona,
  castVariants = null,
  suggestion,
  kind = 'suggestion',
  isPinned = false,
  isDumbingDown = false,
  architectDumbLevel = 0,
  onGo,
  onDismiss,
  onTogglePin,
  onPauseTimer,
  onResumeTimer,
  onDumbDown,
  onDrillDeeper,
  onSelectVariant,
  castDisabled = false,
  showHistoryNav = false,
  canGoBack = false,
  canPromptNext = true,
  historyPositionLabel = '',
  onHistoryBack,
  onPromptNext
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
  const dumbChipLabel = labelExplainDumbChipLabel(architectDumbLevel);
  const dumbLoadingLabel = labelExplainDumbLoadingText(architectDumbLevel);
  const dumbAudienceBadge =
    architectDumbLevel > 0 ? labelExplainDumbAudienceBadge(architectDumbLevel) : '';
  const dumbChipEmoji = isLabelExplainGiveUpLevel(architectDumbLevel)
    ? '🏳️'
    : architectDumbLevel > 0
      ? getLabelExplainDumbLevel(architectDumbLevel)?.emoji ?? '🍼'
      : getLabelExplainDumbLevel(1)?.emoji ?? '🍼';
  const isGibberishAnswer = architectDumbLevel === 7;

  const handleBubbleClick = (event) => {
    if (event.target?.closest?.('.advisor-speech-btn, .advisor-speech-history-nav, .stakeholder-cast-avatar-btn')) {
      return;
    }
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
      <StakeholderCastStrip
        variants={castVariants ?? []}
        activeVariant={persona}
        className="advisor-speech-cast"
        onSelectVariant={onSelectVariant}
        disabled={castDisabled}
      />
      <div className="advisor-speech-main">
        <span className="advisor-speech-emoji" aria-hidden="true">{meta.avatarEmoji || '🏗️'}</span>
        <div className="advisor-speech-body">
          <div className="advisor-speech-head">
            <span className="advisor-speech-persona">
              {meta.name}
              {isPinned ? <span className="advisor-speech-pin" aria-label="Pinned">📌</span> : null}
            </span>
          </div>
          {dumbAudienceBadge ? (
            <p className="advisor-speech-dumb-audience" aria-live="polite">
              {dumbAudienceBadge}
            </p>
          ) : null}
          <span
            className={`advisor-speech-text${isGibberishAnswer ? ' is-gibberish' : ''}`}
          >
            {suggestion}
          </span>
        </div>
        <div className="advisor-speech-footer">
          <nav
            className="advisor-speech-history-nav"
            aria-label="Stakeholder suggestion navigation"
            onClick={(event) => event.stopPropagation()}
          >
            {showHistoryNav ? (
              <>
                <button
                  type="button"
                  className="advisor-speech-history-btn"
                  disabled={!canGoBack}
                  onClick={(event) => {
                    event.stopPropagation();
                    onHistoryBack?.();
                  }}
                  aria-label={
                    canGoBack
                      ? `Older suggestion (${historyPositionLabel})`
                      : 'Oldest suggestion'
                  }
                  title={canGoBack ? 'Older suggestion' : 'Oldest suggestion'}
                >
                  <IconChevronLeft />
                </button>
                <span className="advisor-speech-history-pos" aria-hidden="true">
                  {historyPositionLabel}
                </span>
              </>
            ) : null}
            <button
              type="button"
              className="advisor-speech-history-btn advisor-speech-history-btn--next"
              disabled={!canPromptNext}
              onClick={(event) => {
                event.stopPropagation();
                onPromptNext?.();
              }}
              aria-label="Next stakeholder comment"
              title="Next stakeholder comment"
            >
              <IconPromptNext />
            </button>
          </nav>
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
                className={`advisor-speech-btn advisor-speech-btn--dumb${architectDumbLevel > 0 ? ' is-active' : ''}${isLabelExplainGiveUpLevel(architectDumbLevel) ? ' is-give-up' : ''}`}
                onClick={(event) => { event.stopPropagation(); onDumbDown?.(); }}
                disabled={isDumbingDown}
                aria-pressed={architectDumbLevel > 0}
                aria-label={
                  isLabelExplainGiveUpLevel(architectDumbLevel)
                    ? 'I give up — dismiss this observation'
                    : `${dumbChipLabel} — rephrase for a simpler audience`
                }
                title={
                  isLabelExplainGiveUpLevel(architectDumbLevel)
                    ? 'Decommission this observation (OUT OF SCOPE)'
                    : architectDumbLevel <= 0
                      ? 'Rephrase in plain language — click again for even simpler'
                      : 'Make it even simpler for a younger audience'
                }
              >
                <span className="advisor-speech-dumb-emoji" aria-hidden="true">
                  {dumbChipEmoji}
                </span>
                <span className="advisor-speech-dumb-label">
                  {isDumbingDown ? dumbLoadingLabel : dumbChipLabel}
                </span>
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
      </div>
    </div>
  );
}
