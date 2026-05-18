import { useEffect, useRef, useState } from 'react';
import { getVariantPersona, stakeholderTooltip } from '../utils/slopitectCopy.js';
import AdvisorSpeechBubble from './AdvisorSpeechBubble.jsx';
import AdvisorThinkingIndicator from './AdvisorThinkingIndicator.jsx';

const COLLAPSE_AFTER_MS = 6000;

const VARIANT_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain',
  exec: 'is-exec'
};

const ACTION_LABEL = {
  refine: 'Refine',
  innovate: 'Innovate',
  goMad: 'Go Mad',
  critique: 'Critique',
  explain: 'Explain',
  exec: 'Align'
};

function cssVariant(variant) {
  return variant === 'goMad' ? 'go-mad' : variant;
}

/**
 * Unified stakeholders dock: one mascot button represents the whole advisory cast.
 * When idle it shows a neutral face; when an advisor is speaking the mascot morphs
 * into that persona's avatar with their accent glow. Clicking opens a roster of
 * personas (name, title, action); auto-collapses on outside click or inactivity.
 */
export default function StakeholdersMascot({
  personas,
  activeAdvisorVariant = null,
  thinkingPersona = null,
  busy = false,
  bubbleProps = null
}) {
  const stagePersona = thinkingPersona ?? activeAdvisorVariant;
  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const [expanded, setExpanded] = useState(startExpanded);
  const wrapperRef = useRef(null);
  const collapseTimerRef = useRef(null);

  const armCollapseTimer = () => {
    if (collapseTimerRef.current != null) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => setExpanded(false), COLLAPSE_AFTER_MS);
  };

  useEffect(() => {
    if (!expanded) {
      if (collapseTimerRef.current != null) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      return undefined;
    }
    armCollapseTimer();
    const onDocPointer = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      if (collapseTimerRef.current != null) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, [expanded]);

  const stageMeta = stagePersona ? getVariantPersona(stagePersona) : null;
  const mascotEmoji = expanded ? '👥' : (stageMeta?.avatarEmoji ?? '👥');
  const mascotName = expanded ? 'The Stakeholders' : (stageMeta?.name ?? 'The Stakeholders');
  const mascotClass = [
    'overlay-button',
    'compact-button',
    'slop-action-button',
    'stakeholders-mascot',
    expanded
      ? 'stakeholders-mascot--idle'
      : stagePersona
        ? `stakeholders-mascot--active ${VARIANT_CLASS[stagePersona] || ''}`
        : 'stakeholders-mascot--idle',
    !expanded && thinkingPersona ? 'stakeholders-mascot--thinking' : '',
    expanded ? 'is-expanded' : ''
  ].filter(Boolean).join(' ');

  const accentVar = expanded ? null : stageMeta?.accentColorVar;
  const accentStyle = accentVar
    ? (accentVar.startsWith('--') ? `var(${accentVar})` : accentVar)
    : 'var(--accent)';
  const style = { '--stakeholders-accent': accentStyle };

  return (
    <div
      className={['stakeholders-mascot-wrap', expanded ? 'is-menu-expanded' : ''].filter(Boolean).join(' ')}
      ref={wrapperRef}
      style={style}
    >
      {thinkingPersona
        ? <AdvisorThinkingIndicator persona={thinkingPersona} />
        : (bubbleProps ? <AdvisorSpeechBubble {...bubbleProps} /> : null)}
      <button
        type="button"
        className={mascotClass}
        aria-expanded={expanded}
        aria-haspopup="menu"
        aria-label={expanded ? 'Hide stakeholders actions' : `Open the Stakeholders · ${mascotName}`}
        title={expanded ? 'Tap to hide' : `${mascotName} · tap to open the Stakeholders`}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="stakeholders-mascot-emoji" aria-hidden="true">{mascotEmoji}</span>
        <span className="button-label">{expanded ? 'Stakeholders' : (stageMeta ? stageMeta.name.split(' ').pop() : 'Stakeholders')}</span>
        <span className="slop-action-role stakeholders-mascot-role">
          <span className="slop-action-role-emoji" aria-hidden="true">👥</span>
          {expanded ? 'Pick a persona' : 'Stakeholders'}
        </span>
      </button>
      {expanded ? (
        <div
          className="stakeholders-roster"
          role="menu"
          aria-label="Stakeholder personas"
          onPointerEnter={armCollapseTimer}
          onPointerMove={armCollapseTimer}
        >
          {personas.map((p) => {
            const meta = getVariantPersona(p.variant);
            const actionLabel = p.label ?? ACTION_LABEL[p.variant] ?? meta.name;
            const isActiveAdvisor = activeAdvisorVariant === p.variant;
            const variantClass = p.cssVariant ?? cssVariant(p.variant);
            const rowClassName = [
              'stakeholders-roster-row',
              'slop-action-button',
              `is-${variantClass}`,
              isActiveAdvisor ? 'is-advisor-active' : ''
            ].filter(Boolean).join(' ');
            return (
              <button
                key={p.variant}
                type="button"
                className={rowClassName}
                disabled={busy || p.disabled}
                title={p.title ?? `${stakeholderTooltip(p.variant)} · ${actionLabel}`}
                aria-label={p.ariaLabel ?? actionLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  armCollapseTimer();
                  p.onClick?.();
                }}
              >
                <span className={`action-persona-icon is-${variantClass}`} aria-hidden="true">
                  {meta.avatarEmoji || '🏗️'}
                </span>
                <span className="stakeholders-roster-label">
                  <span className="stakeholders-roster-name">{meta.name}</span>
                  <span className="stakeholders-roster-title">{meta.title}</span>
                </span>
                <span className="stakeholders-roster-chip" aria-hidden="true">{actionLabel}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}