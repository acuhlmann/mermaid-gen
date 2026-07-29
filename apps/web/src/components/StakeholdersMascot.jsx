import { Fragment, useEffect, useRef, useState } from 'react';
import { getVariantPersona, stakeholderTooltip } from '../utils/slopitectCopy.js';
import { officeChromeCopy } from '../utils/officeCast.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';
import StakeholderIntroSpotlight from './StakeholderIntroSpotlight.jsx';
import { PersonaFace } from './personaFaces/index.jsx';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

const COLLAPSE_AFTER_MS = 6000;
/** How long "<name> took it" stays up after you delegate to a teammate. */
export const HANDOFF_ACK_MS = 2600;

const ACTION_LABEL = {
  gilfoyle: 'Refine',
  dinesh: 'Refine',
  erlich: 'Innovate',
  russ: 'Russ',
  jared: 'Critique',
  richard: 'Explain',
  barker: 'Synergize'
};

function resolveActionLabel(variant, controls) {
  if (variant === 'barker') return controls.actions.prepForCeo ?? ACTION_LABEL.barker;
  return controls.actions[variant] ?? ACTION_LABEL[variant] ?? variant;
}

function cssVariant(variant) {
  return variant === 'russ' ? 'russ' : variant;
}

/**
 * Unified stakeholders dock: one mascot button represents the whole advisory cast.
 * Clicking opens a roster of personas (name, title, action) plus team verbs —
 * Huddle up (crowd the monitor) and Summon a sync (glass room or headsets).
 * Auto-collapses on outside click, inactivity, or when a huddle starts.
 */
export default function StakeholdersMascot({
  personas,
  busy = false,
  introProps = null,
  onHuddle = null,
  canHuddle = true,
  onCallMeeting = null,
  canCallMeeting = true
}) {
  const { controls } = useUiCopy();
  const stakeholdersCopy = controls.stakeholders;
  const deskCopy = officeChromeCopy().desk;

  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const [expanded, setExpanded] = useState(startExpanded);
  const rosterZIndex = useOverlayLayer('stakeholders-roster', expanded);

  const wrapperRef = useRef(null);
  const mascotAnchorRef = useRef(null);
  const collapseTimerRef = useRef(null);

  /**
   * Who you just handed the work to. Delegating runs the streaming agent rather
   * than a suggestion bubble, so the roster owns the only acknowledgement that a
   * *person* picked it up.
   */
  const [handedTo, setHandedTo] = useState(/** @type {string | null} */ (null));
  const handoffTimerRef = useRef(null);
  useEffect(
    () => () => {
      if (handoffTimerRef.current != null) clearTimeout(handoffTimerRef.current);
    },
    []
  );
  const noteHandoff = (variant) => {
    if (handoffTimerRef.current != null) clearTimeout(handoffTimerRef.current);
    setHandedTo(variant);
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      setHandedTo(null);
    }, HANDOFF_ACK_MS);
  };

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

  const mascotEmoji = '👥';
  const mascotName = stakeholdersCopy.theStakeholders;
  const mascotClass = [
    'overlay-button',
    'compact-button',
    'slop-action-button',
    'stakeholders-mascot',
    'stakeholders-mascot--idle',
    expanded ? 'is-expanded' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const style = { '--stakeholders-accent': 'var(--accent)' };

  const startHuddle = () => {
    // Close the roster the moment the ring starts forming — the huddle *is* the
    // team UI now, and leaving the popup open on top of six faces is noise.
    setExpanded(false);
    void onHuddle?.();
  };

  const startSync = () => {
    setExpanded(false);
    void onCallMeeting?.({ source: 'desk' });
  };

  return (
    <div
      className={['stakeholders-mascot-wrap', expanded ? 'is-menu-expanded' : '']
        .filter(Boolean)
        .join(' ')}
      ref={wrapperRef}
      style={style}
    >
      {introProps ? (
        <div className="stakeholders-float-stack">
          <StakeholderIntroSpotlight {...introProps} />
        </div>
      ) : null}
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
          {expanded ? controls.actions.stakeholders : controls.actions.stakeholders}
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
          style={overlayLayerStyle(rosterZIndex)}
          role="menu"
          aria-label={stakeholdersCopy.personaMenu}
          onPointerEnter={armCollapseTimer}
          onPointerMove={armCollapseTimer}
        >
          <p className="stakeholders-roster-heading">
            {stakeholdersCopy.teamActionsHeading ?? 'Get the team on it'}
          </p>
          <div className="stakeholders-team-actions">
            <button
              type="button"
              role="menuitem"
              className={[
                'stakeholders-roster-row',
                'stakeholders-roster-team-action',
                'stakeholders-roster-huddle-action',
                'slop-action-button',
                'is-huddle'
              ].join(' ')}
              disabled={!canHuddle}
              aria-label={deskCopy.huddleAction}
              title={
                canHuddle
                  ? (deskCopy.huddleActionTitle ?? deskCopy.huddleAction)
                  : (deskCopy.blocked?.busy ?? deskCopy.huddleAction)
              }
              onClick={(event) => {
                event.stopPropagation();
                startHuddle();
              }}
            >
              <span className="stakeholders-roster-team-emoji" aria-hidden="true">
                🤝
              </span>
              <span className="stakeholders-roster-label">
                <span className="stakeholders-roster-name">{deskCopy.huddleAction}</span>
              </span>
            </button>
            {typeof onCallMeeting === 'function' ? (
              <button
                type="button"
                role="menuitem"
                className={[
                  'stakeholders-roster-row',
                  'stakeholders-roster-team-action',
                  'stakeholders-roster-sync-action',
                  'slop-action-button',
                  'is-sync'
                ].join(' ')}
                disabled={!canCallMeeting}
                aria-label={deskCopy.meeting}
                title={
                  canCallMeeting
                    ? (deskCopy.meetingTitle ?? deskCopy.meeting)
                    : (deskCopy.blocked?.meeting ?? deskCopy.meeting)
                }
                onClick={(event) => {
                  event.stopPropagation();
                  startSync();
                }}
              >
                <span className="stakeholders-roster-team-emoji" aria-hidden="true">
                  📅
                </span>
                <span className="stakeholders-roster-label">
                  <span className="stakeholders-roster-name">{deskCopy.meeting}</span>
                </span>
              </button>
            ) : null}
          </div>
          <span className="stakeholders-roster-divider" role="presentation">
            {stakeholdersCopy.delegateDivider ?? 'Delegate to…'}
          </span>
          {personas.map((p) => {
            const meta = getVariantPersona(p.variant);
            const actionLabel = p.label ?? resolveActionLabel(p.variant, controls) ?? meta.name;
            const variantClass = p.cssVariant ?? cssVariant(p.variant);
            const rowClassName = [
              'stakeholders-roster-row',
              'slop-action-button',
              `is-${variantClass}`,
              handedTo === p.variant ? 'is-handed-off' : ''
            ]
              .filter(Boolean)
              .join(' ');
            const delegateLabel = formatLocale(
              stakeholdersCopy.delegateAria ?? 'Delegate to {name} — {action}',
              { name: meta.name, action: actionLabel }
            );
            const row = (
              <button
                key={p.variant}
                type="button"
                className={rowClassName}
                disabled={busy || p.disabled}
                title={p.title ?? `${delegateLabel} · ${stakeholderTooltip(p.variant)}`}
                aria-label={p.ariaLabel ?? delegateLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  armCollapseTimer();
                  noteHandoff(p.variant);
                  p.onClick?.();
                }}
              >
                <span className={`action-persona-icon is-${variantClass}`} aria-hidden="true">
                  <PersonaFace id={p.variant} size={22} />
                </span>
                <span className="stakeholders-roster-label">
                  <span className="stakeholders-roster-name">{meta.name}</span>
                  <span className="stakeholders-roster-title">
                    {handedTo === p.variant
                      ? formatLocale(stakeholdersCopy.handoffAck ?? '{name} took it', {
                          name: meta.name.split(' ')[0]
                        })
                      : meta.title}
                  </span>
                </span>
                <span className="stakeholders-roster-chip" aria-hidden="true">
                  <span className="stakeholders-roster-handoff">
                    {handedTo === p.variant ? '✓' : '→'}
                  </span>
                  {actionLabel}
                </span>
              </button>
            );
            if (!p.senior) return row;
            return (
              <Fragment key={`${p.variant}-senior`}>
                <span className="stakeholders-roster-divider" role="presentation">
                  {stakeholdersCopy.seniorDivider ?? 'Upstairs'}
                </span>
                {row}
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
