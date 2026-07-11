import {
  getLabelExplainDumbLevel,
  isLabelExplainGiveUpLevel,
  isLabelExplainGibberishLevel,
  labelExplainDumbAudienceBadge,
  labelExplainDumbChipLabel,
  labelExplainDumbLoadingText
} from '@archislop/shared';
import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Progressive "Dumb it Down" chip row — same ladder as the radial Wise Architect explainer.
 */
export default function ExplainDumbDownControls({
  dumbLevel = 0,
  loading = false,
  surrendered = false,
  onDumbDown,
  className = ''
}) {
  const { controls } = useUiCopy();
  const copy = controls.explainDumb;

  if (typeof onDumbDown !== 'function') return null;

  const dumbChipLabel = labelExplainDumbChipLabel(dumbLevel);
  const dumbLoadingLabel = labelExplainDumbLoadingText(dumbLevel);
  const dumbAudienceBadge = dumbLevel > 0 ? labelExplainDumbAudienceBadge(dumbLevel) : '';
  const dumbChipEmoji = isLabelExplainGiveUpLevel(dumbLevel)
    ? '🏳️'
    : dumbLevel > 0
      ? (getLabelExplainDumbLevel(dumbLevel)?.emoji ?? '🍼')
      : (getLabelExplainDumbLevel(1)?.emoji ?? '🍼');
  const isGibberishAnswer = isLabelExplainGibberishLevel(dumbLevel);

  return (
    <div
      className={['insights-explain-dumb-wrap', className].filter(Boolean).join(' ')}
      data-testid="explain-dumb-down-controls"
    >
      {dumbAudienceBadge && !surrendered ? (
        <p className="insights-explain-dumb-audience" aria-live="polite">
          {dumbAudienceBadge}
        </p>
      ) : null}
      {surrendered ? (
        <p className="insights-explain-dumb-surrender" aria-live="assertive">
          {copy.surrenderCaption}
        </p>
      ) : null}
      <div className="insights-explain-dumb-followups" role="group" aria-label={copy.rephraseGroup}>
        <button
          type="button"
          className={[
            'insights-explain-dumb-btn',
            dumbLevel > 0 ? 'is-active' : '',
            isLabelExplainGiveUpLevel(dumbLevel) ? 'is-give-up' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onDumbDown}
          disabled={loading || surrendered}
          aria-pressed={dumbLevel > 0}
          aria-label={
            isLabelExplainGiveUpLevel(dumbLevel)
              ? copy.decommissionAria
              : `${dumbChipLabel}${copy.rephraseAriaSuffix}`
          }
          title={
            isLabelExplainGiveUpLevel(dumbLevel)
              ? copy.decommissionTitle
              : dumbLevel <= 0
                ? copy.rephrasePlain
                : copy.rephraseYounger
          }
        >
          <span className="insights-explain-dumb-emoji" aria-hidden="true">
            {dumbChipEmoji}
          </span>
          <span className="insights-explain-dumb-label">
            {loading ? dumbLoadingLabel : dumbChipLabel}
          </span>
        </button>
      </div>
      {isGibberishAnswer && !surrendered ? (
        <span className="sr-only">{copy.gibberishActive}</span>
      ) : null}
    </div>
  );
}
