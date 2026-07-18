import { useEffect, useRef, useState } from 'react';
import { getVariantPersona, stakeholderTooltip } from '../utils/slopitectCopy.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';
import AdvisorFloatPortal from './AdvisorFloatPortal.jsx';
import AdvisorSpeechBubble from './AdvisorSpeechBubble.jsx';
import AdvisorThinkingIndicator from './AdvisorThinkingIndicator.jsx';
import StakeholderCastStrip from './StakeholderCastStrip.jsx';
import StakeholderIntroSpotlight from './StakeholderIntroSpotlight.jsx';

const COLLAPSE_AFTER_MS = 6000;
/** Keep the float anchor latched briefly across thinking→bubble handoff gaps. */
const SURFACE_LATCH_MS = 1200;

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

function resolveActionLabel(variant, controls) {
  if (variant === 'exec') return controls.stakeholders.align;
  return controls.actions[variant] ?? ACTION_LABEL[variant] ?? variant;
}

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
  bubbleProps = null,
  onSelectVariant = null,
  castDisabled = false,
  introProps = null
}) {
  const { controls } = useUiCopy();
  const stakeholdersCopy = controls.stakeholders;
  const castVariants = personas.map((p) => p.variant).filter(Boolean);

  const bubbleReady = Boolean(
    (bubbleProps?.persona || activeAdvisorVariant) &&
    typeof bubbleProps?.suggestion === 'string' &&
    bubbleProps.suggestion.trim().length > 0
  );
  const thinkingDisplayPersona = thinkingPersona ?? activeAdvisorVariant;
  // Keep the thinking indicator up until the speech bubble has both persona + text.
  // Falling back to activeAdvisorVariant prevents a blank gap when suggestion
  // text arrives a tick before persona is wired into bubbleProps.
  const showThinking = Boolean(thinkingDisplayPersona) && !bubbleReady;
  const stagePersona = bubbleReady
    ? (bubbleProps?.persona ?? activeAdvisorVariant)
    : thinkingDisplayPersona;

  const liveAdvisorSurface = showThinking ? (
    <AdvisorThinkingIndicator
      persona={thinkingDisplayPersona}
      castVariants={castVariants}
      onSelectVariant={onSelectVariant}
      castDisabled={castDisabled}
    />
  ) : bubbleReady ? (
    <AdvisorSpeechBubble
      {...bubbleProps}
      persona={bubbleProps?.persona ?? activeAdvisorVariant}
      castVariants={castVariants}
    />
  ) : null;

  const hasLiveSurface = showThinking || bubbleReady;

  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const useFloatPortal = !startExpanded;
  const [expanded, setExpanded] = useState(startExpanded);
  const [surfaceLatch, setSurfaceLatch] = useState(false);
  const heldSurfaceRef = useRef(/** @type {import('react').ReactNode} */ (null));
  if (liveAdvisorSurface) {
    heldSurfaceRef.current = liveAdvisorSurface;
  }
  const advisorSurface = liveAdvisorSurface ?? (surfaceLatch ? heldSurfaceRef.current : null);
  const hasFloatSurface = Boolean(introProps || advisorSurface || surfaceLatch);

  const wrapperRef = useRef(null);
  const mascotAnchorRef = useRef(null);
  const collapseTimerRef = useRef(null);

  const portaledFloat =
    introProps || advisorSurface ? (
      introProps ? (
        <div className="stakeholders-float-stack">
          <StakeholderIntroSpotlight {...introProps} />
          {advisorSurface}
        </div>
      ) : (
        advisorSurface
      )
    ) : null;

  // Depend on a stable boolean — not the React element — so parent re-renders
  // do not reset the latch timer while the surface is already gone.
  useEffect(() => {
    if (introProps || hasLiveSurface) {
      setSurfaceLatch(true);
      return undefined;
    }
    const id = setTimeout(() => setSurfaceLatch(false), SURFACE_LATCH_MS);
    return () => clearTimeout(id);
  }, [introProps, hasLiveSurface]);

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
  const mascotName = expanded
    ? stakeholdersCopy.theStakeholders
    : (stageMeta?.name ?? stakeholdersCopy.theStakeholders);
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
  ]
    .filter(Boolean)
    .join(' ');

  const accentVar = expanded ? null : stageMeta?.accentColorVar;
  const accentStyle = accentVar
    ? accentVar.startsWith('--')
      ? `var(${accentVar})`
      : accentVar
    : 'var(--accent)';
  const style = { '--stakeholders-accent': accentStyle };

  return (
    <div
      className={[
        'stakeholders-mascot-wrap',
        expanded ? 'is-menu-expanded' : '',
        hasFloatSurface ? 'has-float-surface' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      ref={wrapperRef}
      style={style}
    >
      {useFloatPortal ? (
        <AdvisorFloatPortal anchorRef={mascotAnchorRef} active={Boolean(portaledFloat)}>
          {portaledFloat}
        </AdvisorFloatPortal>
      ) : (
        portaledFloat
      )}
      <button
        ref={mascotAnchorRef}
        type="button"
        className={mascotClass}
        aria-expanded={expanded}
        aria-haspopup="menu"
        aria-label={
          expanded
            ? stakeholdersCopy.hideActions
            : formatLocale(stakeholdersCopy.openStakeholders, { name: mascotName })
        }
        title={
          expanded
            ? stakeholdersCopy.tapToHide
            : formatLocale(stakeholdersCopy.tapToOpen, { name: mascotName })
        }
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="stakeholders-mascot-emoji" aria-hidden="true">
          {mascotEmoji}
        </span>
        <span className="button-label">
          {expanded
            ? controls.actions.stakeholders
            : stageMeta
              ? stageMeta.name.split(' ').pop()
              : controls.actions.stakeholders}
        </span>
        <span className="slop-action-role stakeholders-mascot-role">
          <span className="slop-action-role-emoji" aria-hidden="true">
            👥
          </span>
          {expanded ? stakeholdersCopy.pickPersona : controls.actions.stakeholders}
        </span>
      </button>
      {expanded ? (
        <div
          className="stakeholders-roster"
          role="menu"
          aria-label={stakeholdersCopy.personaMenu}
          onPointerEnter={armCollapseTimer}
          onPointerMove={armCollapseTimer}
        >
          {personas.map((p) => {
            const meta = getVariantPersona(p.variant);
            const actionLabel = p.label ?? resolveActionLabel(p.variant, controls) ?? meta.name;
            const isActiveAdvisor = activeAdvisorVariant === p.variant;
            const variantClass = p.cssVariant ?? cssVariant(p.variant);
            const rowClassName = [
              'stakeholders-roster-row',
              'slop-action-button',
              `is-${variantClass}`,
              isActiveAdvisor ? 'is-advisor-active' : ''
            ]
              .filter(Boolean)
              .join(' ');
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
                <span className="stakeholders-roster-chip" aria-hidden="true">
                  {actionLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
