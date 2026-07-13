import { getVariantPersona } from '../utils/slopitectCopy.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import StakeholderCastStrip from './StakeholderCastStrip.jsx';

const PERSONA_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain'
};

/**
 * Compact "<persona> is thinking…" bubble shown while the advisor LLM call is
 * in flight. Anchored above the stakeholders mascot, same coordinate system as
 * AdvisorSpeechBubble — they are mutually exclusive (StakeholdersMascot picks one).
 */
export default function AdvisorThinkingIndicator({
  persona,
  castVariants = null,
  onSelectVariant = null,
  castDisabled = false
}) {
  const { controls } = useUiCopy();
  const thinkingCopy = controls.advisorThinking;
  if (!persona) return null;
  const meta = getVariantPersona(persona);
  const personaClass = PERSONA_CLASS[persona] || '';
  const accent = meta.accentColorVar || 'var(--accent)';
  const accentStyle = accent.startsWith('--') ? `var(${accent})` : accent;
  const verb = thinkingCopy[persona] ?? thinkingCopy.default;
  return (
    <div
      className={`advisor-thinking-indicator ${personaClass}`}
      role="status"
      aria-live="polite"
      aria-label={`${meta.name} ${verb}`}
      style={{ '--advisor-accent': accentStyle }}
      data-testid="advisor-thinking-indicator"
    >
      <StakeholderCastStrip
        variants={castVariants ?? []}
        activeVariant={persona}
        className="advisor-thinking-cast"
        compact
        onSelectVariant={onSelectVariant}
        disabled={castDisabled}
      />
      <div className="advisor-thinking-main">
        <span className="advisor-thinking-emoji" aria-hidden="true">
          {meta.avatarEmoji || '🏗️'}
        </span>
        <span className="advisor-thinking-text">
          <span className="advisor-thinking-persona">{meta.name}</span>
          <span className="advisor-thinking-verb">{verb}</span>
          <span className="advisor-thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </span>
      </div>
    </div>
  );
}
