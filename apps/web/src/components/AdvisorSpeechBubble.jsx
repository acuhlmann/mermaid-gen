import {
  getLabelExplainDumbLevel,
  isLabelExplainGiveUpLevel,
  labelExplainDumbAudienceBadge,
  labelExplainDumbChipLabel,
  labelExplainDumbLoadingText
} from '@archislop/shared';
import { getVariantPersona } from '../utils/slopitectCopy.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';
import StakeholderCastStrip from './StakeholderCastStrip.jsx';
import { PersonaFace } from './personaFaces/index.jsx';

const PERSONA_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain',
  barker: 'is-barker'
};

function IconChevronLeft() {
  return (
    <svg
      className="advisor-speech-nav-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}

function IconPromptNext() {
  return (
    <svg
      className="advisor-speech-nav-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
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
  const { controls } = useUiCopy();
  const explainDumb = controls.explainDumb;
  const advisorCopy = controls.advisor;
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
      ? (getLabelExplainDumbLevel(architectDumbLevel)?.emoji ?? '🍼')
      : (getLabelExplainDumbLevel(1)?.emoji ?? '🍼');
  const isGibberishAnswer = architectDumbLevel === 7;

  const handleBubbleClick = (event) => {
    if (
      event.target?.closest?.(
        '.advisor-speech-btn, .advisor-speech-history-nav, .stakeholder-cast-avatar-btn'
      )
    ) {
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
      title={isPinned ? advisorCopy.pinTitle : advisorCopy.unpinTitle}
    >
      <StakeholderCastStrip
        variants={castVariants ?? []}
        activeVariant={persona}
        className="advisor-speech-cast"
        onSelectVariant={onSelectVariant}
        disabled={castDisabled}
      />
      <div className="advisor-speech-main">
        <span className="advisor-speech-emoji" aria-hidden="true">
          <PersonaFace id={persona} size={34} />
        </span>
        <div className="advisor-speech-body">
          <div className="advisor-speech-head">
            <span className="advisor-speech-persona">
              {meta.name}
              {isPinned ? (
                <span className="advisor-speech-pin" aria-label={advisorCopy.pinned}>
                  📌
                </span>
              ) : null}
            </span>
          </div>
          {dumbAudienceBadge ? (
            <p className="advisor-speech-dumb-audience" aria-live="polite">
              {dumbAudienceBadge}
            </p>
          ) : null}
          <span className={`advisor-speech-text${isGibberishAnswer ? ' is-gibberish' : ''}`}>
            {suggestion}
          </span>
        </div>
        <div className="advisor-speech-footer">
          <nav
            className="advisor-speech-history-nav"
            aria-label={advisorCopy.suggestionNav}
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
                      ? formatLocale(advisorCopy.olderSuggestionAt, { pos: historyPositionLabel })
                      : advisorCopy.oldestSuggestion
                  }
                  title={canGoBack ? advisorCopy.olderSuggestion : advisorCopy.oldestSuggestion}
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
              aria-label={advisorCopy.nextComment}
              title={advisorCopy.nextComment}
            >
              <IconPromptNext />
            </button>
          </nav>
          <div className="advisor-speech-actions">
            {isComment ? null : (
              <button
                type="button"
                className="advisor-speech-btn advisor-speech-btn--go"
                onClick={(event) => {
                  event.stopPropagation();
                  onGo?.();
                }}
                aria-label={formatLocale(advisorCopy.applySuggestion, { name: meta.name })}
              >
                {controls.prompt.doIt}
              </button>
            )}
            {showArchitectActions && onDumbDown ? (
              <button
                type="button"
                className={`advisor-speech-btn advisor-speech-btn--dumb${architectDumbLevel > 0 ? ' is-active' : ''}${isLabelExplainGiveUpLevel(architectDumbLevel) ? ' is-give-up' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDumbDown?.();
                }}
                disabled={isDumbingDown}
                aria-pressed={architectDumbLevel > 0}
                aria-label={
                  isLabelExplainGiveUpLevel(architectDumbLevel)
                    ? explainDumb.decommissionAria
                    : `${dumbChipLabel}${explainDumb.rephraseAriaSuffix}`
                }
                title={
                  isLabelExplainGiveUpLevel(architectDumbLevel)
                    ? explainDumb.decommissionTitle
                    : architectDumbLevel <= 0
                      ? explainDumb.rephrasePlain
                      : explainDumb.rephraseYounger
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
                onClick={(event) => {
                  event.stopPropagation();
                  onDrillDeeper?.();
                }}
                disabled={isDumbingDown}
                aria-label={advisorCopy.drillDeeperAria}
                title={advisorCopy.drillDeeperTitle}
              >
                {controls.radial.drillDeeper}
              </button>
            ) : null}
            <button
              type="button"
              className="advisor-speech-btn advisor-speech-btn--dismiss"
              onClick={(event) => {
                event.stopPropagation();
                onDismiss?.();
              }}
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
