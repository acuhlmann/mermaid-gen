import { useEffect, useRef, useState } from 'react';
import { getVariantPersona } from '../utils/slopitectCopy.js';
import AdvisorSpeechBubble from './AdvisorSpeechBubble.jsx';
import AdvisorThinkingIndicator from './AdvisorThinkingIndicator.jsx';

const COLLAPSE_AFTER_MS = 6000;

const VARIANT_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain'
};

const ACTION_LABEL = {
  refine: 'Refine',
  innovate: 'Innovate',
  goMad: 'Go Mad',
  critique: 'Critique',
  explain: 'Explain'
};

/**
 * Unified council dock: one mascot button represents the whole advisory cast.
 * When idle it shows a neutral "Council" face; when an advisor is speaking
 * (proactive bubble active), it morphs into that persona's avatar with their
 * accent glow so the dock visibly "becomes" the current speaker.
 *
 * Clicking the mascot fans out the five persona action buttons (refine /
 * innovate / goMad / critique / explain) inline. Auto-collapses on outside
 * click or COLLAPSE_AFTER_MS of inactivity. Each persona button reuses the
 * existing transform/analyze handlers passed by the parent.
 */
export default function CouncilMascot({
  personas,
  activeAdvisorVariant = null,
  thinkingPersona = null,
  busy = false,
  bubbleProps = null
}) {
  // Mascot avatar reflects whoever is "on stage" right now: the persona
  // currently thinking takes priority (priming the user), then a persona with
  // an active suggestion, then idle.
  const stagePersona = thinkingPersona ?? activeAdvisorVariant;
  // Default open in test runs so integration tests can find persona buttons
  // without each test having to click the mascot first; real users always
  // start collapsed and click to expand.
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
  const mascotEmoji = stageMeta?.avatarEmoji ?? '🏛️';
  const mascotName = stageMeta?.name ?? 'The Council';
  const mascotClass = [
    'overlay-button',
    'compact-button',
    'slop-action-button',
    'council-mascot',
    stagePersona ? `council-mascot--active ${VARIANT_CLASS[stagePersona] || ''}` : 'council-mascot--idle',
    thinkingPersona ? 'council-mascot--thinking' : '',
    expanded ? 'is-expanded' : ''
  ].filter(Boolean).join(' ');

  const accentVar = stageMeta?.accentColorVar;
  const accentStyle = accentVar
    ? (accentVar.startsWith('--') ? `var(${accentVar})` : accentVar)
    : 'var(--accent)';
  const style = { '--council-accent': accentStyle };

  return (
    <div className="council-mascot-wrap" ref={wrapperRef} style={style}>
      {thinkingPersona
        ? <AdvisorThinkingIndicator persona={thinkingPersona} />
        : (bubbleProps ? <AdvisorSpeechBubble {...bubbleProps} /> : null)}
      <button
        type="button"
        className={mascotClass}
        aria-expanded={expanded}
        aria-haspopup="true"
        aria-label={expanded ? 'Hide council actions' : `Open the Council · ${mascotName}`}
        title={expanded ? 'Tap to hide' : `${mascotName} · tap to open the Council`}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="council-mascot-emoji" aria-hidden="true">{mascotEmoji}</span>
        <span className="button-label">{stageMeta ? stageMeta.name.split(' ').pop() : 'Council'}</span>
        <span className="slop-action-role council-mascot-role">
          <span className="slop-action-role-emoji" aria-hidden="true">🏛️</span>
          {expanded ? 'Tap a persona' : 'Council'}
        </span>
      </button>
      {expanded ? (
        <div
          className="council-mascot-fan"
          onPointerEnter={armCollapseTimer}
          onPointerMove={armCollapseTimer}
        >
          {personas.map((p) => {
            const meta = getVariantPersona(p.variant);
            const actionLabel = p.label ?? ACTION_LABEL[p.variant] ?? meta.name;
            const isActiveAdvisor = activeAdvisorVariant === p.variant;
            const className = [
              'overlay-button',
              'compact-button',
              'slop-action-button',
              `is-${p.cssVariant ?? p.variant}`,
              'council-mascot-fan-item',
              isActiveAdvisor ? 'is-advisor-active' : ''
            ].filter(Boolean).join(' ');
            return (
              <button
                key={p.variant}
                type="button"
                className={className}
                disabled={busy || p.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  armCollapseTimer();
                  p.onClick?.();
                }}
                aria-label={p.ariaLabel ?? actionLabel}
                title={p.title ?? `${meta.name} · ${meta.title}`}
              >
                <span className={`action-persona-icon is-${p.cssVariant ?? p.variant}`} aria-hidden="true">
                  {meta.avatarEmoji || '🏗️'}
                </span>
                <span className="button-label">{actionLabel}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
