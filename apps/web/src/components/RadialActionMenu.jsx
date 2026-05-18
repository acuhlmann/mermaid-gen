import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { partKindLabel } from '../utils/partKindLabel.js';
import { MOBILE_MEDIA_QUERY } from '../utils/layoutBreakpoints.js';
import { chipBoundingClearancePx, resolveArcGeometry } from '../utils/radialMenuLayout.js';
import { fetchLabelExplanation } from '../utils/fetchLabelExplanation.js';

const ARC_RADIUS_DESKTOP_PX = 82;
const ARC_RADIUS_MOBILE_PX = 62;
const BUTTON_HALF_DESKTOP_PX = 34;
const BUTTON_HALF_MOBILE_PX = 32;
const VIEWPORT_MARGIN_PX = 8;
const MOBILE_BOTTOM_CHROME_RESERVE_PX = 120;
const HOVER_DISK_EXTRA_PX = 12;
/** Max chip width before the label wraps (keeps the action ring compact). */
export const CHIP_MAX_WIDTH_PX = 100;

function estimateChipSize(name, typeLabel) {
  const maxW = CHIP_MAX_WIDTH_PX;
  const padX = 20;
  const padY = 10;
  const typeLineH = 12;
  const nameLineH = 14;
  const avgChar = 6.5;
  const contentW = Math.max(typeLabel.length * 5.5, (name || '').length * avgChar);
  const width = Math.min(maxW, Math.max(72, contentW + padX));
  const charsPerLine = Math.max(8, (width - padX) / avgChar);
  const lines = name ? Math.max(1, Math.ceil(name.length / charsPerLine)) : 0;
  const height = padY * 2 + typeLineH + (lines ? lines * nameLineH + 2 : 0);
  return { width, height };
}

function pickArcSide(anchor, vv) {
  const spaces = {
    right: vv.right - anchor.nodeRight,
    left: anchor.nodeLeft - vv.left,
    top: anchor.nodeTop - vv.top,
    bottom: vv.bottom - anchor.nodeBottom
  };
  let best = 'bottom';
  for (const side of Object.keys(spaces)) {
    if (spaces[side] > spaces[best]) best = side;
  }
  return best;
}

function arcCenterDeg(side) {
  if (side === 'right') return 0;
  if (side === 'bottom') return 90;
  if (side === 'left') return 180;
  return 270; // top
}

function computeButtonPositions(side, count, arcRadiusPx, arcSpreadDeg) {
  if (count <= 0) return [];
  const center = arcCenterDeg(side);
  const start = center - arcSpreadDeg / 2;
  const step = count === 1 ? 0 : arcSpreadDeg / (count - 1);
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const angleDeg = start + step * i;
    const rad = (angleDeg * Math.PI) / 180;
    result.push({
      angleDeg,
      dx: arcRadiusPx * Math.cos(rad),
      dy: arcRadiusPx * Math.sin(rad)
    });
  }
  return result;
}

function clampToViewport(x, y, vv, buttonHalfPx, bottomReservePx = 0) {
  const bottomLimit = vv.bottom - bottomReservePx;
  return {
    x: Math.max(vv.left + VIEWPORT_MARGIN_PX + buttonHalfPx, Math.min(vv.right - VIEWPORT_MARGIN_PX - buttonHalfPx, x)),
    y: Math.max(
      vv.top + VIEWPORT_MARGIN_PX + buttonHalfPx,
      Math.min(bottomLimit - VIEWPORT_MARGIN_PX - buttonHalfPx, y)
    )
  };
}

function readViewportBounds() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      right: vv.offsetLeft + vv.width,
      bottom: vv.offsetTop + vv.height
    };
  }
  if (typeof window !== 'undefined') {
    return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  }
  return { left: 0, top: 0, right: 0, bottom: 0 };
}

export default function RadialActionMenu({
  descriptor,
  anchor,
  actions,
  busy = false,
  slopPrompt = null,
  slopPromptOpen = false,
  diagramSource = '',
  contentType = 'mermaid',
  sessionId = '',
  onSlopPromptClose,
  onActionPick,
  onHoverHold,
  onHoverRelease,
  onBackdropPointerDown,
  onClose
}) {
  const wrapperRef = useRef(null);
  const chipRef = useRef(null);
  const [chipSize, setChipSize] = useState(null);
  const [viewportTick, setViewportTick] = useState(0);
  const [stakeholdersExpanded, setStakeholdersExpanded] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [explanation, setExplanation] = useState({ status: 'idle', text: '', error: '' });
  const [narrowLayout, setNarrowLayout] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const sync = () => setNarrowLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!descriptor) return undefined;
    function bump() {
      setViewportTick((n) => n + 1);
    }
    window.addEventListener('resize', bump);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', bump);
    vv?.addEventListener('scroll', bump);
    return () => {
      window.removeEventListener('resize', bump);
      vv?.removeEventListener('resize', bump);
      vv?.removeEventListener('scroll', bump);
    };
  }, [descriptor]);

  const popoverMode = explainerOpen || stakeholdersExpanded;

  const visibleActions = useMemo(() => {
    if (!Array.isArray(actions)) return [];
    const cleaned = actions.filter((action) => action && !action.hidden);
    const hasPrimaryGroup = cleaned.some((action) => action.group === 'primary');
    if (!hasPrimaryGroup) return cleaned;
    // In the new design, opening either popover hides the chip + arc entirely
    // (the popover replaces the menu), so we only ever render the primary
    // group's two entries here.
    return cleaned.filter((action) => (action.group || 'persona') === 'primary');
  }, [actions]);

  const personaActions = useMemo(() => {
    if (!Array.isArray(actions)) return [];
    return actions.filter(
      (action) => action && !action.hidden && (action.group || 'persona') !== 'primary'
    );
  }, [actions]);

  const chipTypeLabel = descriptor ? partKindLabel(descriptor.partKind) : '';
  const chipName = descriptor ? descriptor.partName || descriptor.label || descriptor.id || '' : '';
  const explainTarget =
    (descriptor && (descriptor.clickedLabel || descriptor.partName || descriptor.label || descriptor.id)) ||
    '';

  useEffect(() => {
    setChipSize(null);
  }, [descriptor?.id, chipName, chipTypeLabel]);

  // The parent re-mounts this component with `key={descriptor.id}` whenever the
  // selected element changes, so popover state (explainer / stakeholders) starts
  // fresh per selection — no manual reset needed here.

  // When the explainer opens (or the focused part changes while it's open),
  // kick off a fresh fast-agent fetch. Cancel any in-flight call.
  useEffect(() => {
    if (!explainerOpen || !descriptor) return undefined;
    const controller = new AbortController();
    let alive = true;
    setExplanation({ status: 'loading', text: '', error: '' });
    fetchLabelExplanation({
      descriptor,
      contentType,
      diagramSource,
      sessionId,
      signal: controller.signal
    })
      .then((text) => {
        if (!alive) return;
        if (text) {
          setExplanation({ status: 'ready', text, error: '' });
        } else {
          setExplanation({
            status: 'error',
            text: '',
            error: 'No explanation came back — try again in a moment.'
          });
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err?.name === 'AbortError') return;
        setExplanation({
          status: 'error',
          text: '',
          error: err?.message || 'Could not fetch explanation.'
        });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [contentType, descriptor, diagramSource, explainerOpen, sessionId]);

  useLayoutEffect(() => {
    const el = chipRef.current;
    if (!el || !descriptor || popoverMode) return undefined;
    function measure() {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setChipSize((prev) => {
        if (
          prev &&
          Math.abs(prev.width - rect.width) < 0.5 &&
          Math.abs(prev.height - rect.height) < 0.5
        ) {
          return prev;
        }
        return { width: rect.width, height: rect.height };
      });
    }
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [descriptor, chipName, chipTypeLabel, narrowLayout, popoverMode]);

  const effectiveChipSize = useMemo(
    () => chipSize ?? estimateChipSize(chipName, chipTypeLabel),
    [chipName, chipSize, chipTypeLabel]
  );

  const layout = useMemo(() => {
    if (!anchor) return null;
    const vv = readViewportBounds();
    const baseRadiusPx = narrowLayout ? ARC_RADIUS_MOBILE_PX : ARC_RADIUS_DESKTOP_PX;
    const buttonHalfPx = narrowLayout ? BUTTON_HALF_MOBILE_PX : BUTTON_HALF_DESKTOP_PX;
    const chipClearancePx = chipBoundingClearancePx(
      effectiveChipSize.width,
      effectiveChipSize.height,
      buttonHalfPx
    );
    const { radiusPx: arcRadiusPx, spreadDeg: arcSpreadDeg } = resolveArcGeometry(
      visibleActions.length,
      baseRadiusPx,
      chipClearancePx
    );
    const bottomReservePx = narrowLayout ? MOBILE_BOTTOM_CHROME_RESERVE_PX : 0;
    const centerX = typeof anchor.left === 'number' ? anchor.left : (anchor.nodeLeft + anchor.nodeRight) / 2;
    const centerY = typeof anchor.centerY === 'number' ? anchor.centerY : (anchor.nodeTop + anchor.nodeBottom) / 2;
    const side = pickArcSide(anchor, vv);
    const positions = computeButtonPositions(side, visibleActions.length, arcRadiusPx, arcSpreadDeg);
    const hoverDiskDiameter = 2 * (arcRadiusPx + buttonHalfPx + HOVER_DISK_EXTRA_PX);
    const nodeBottom = typeof anchor.nodeBottom === 'number' ? anchor.nodeBottom : centerY;
    const nodeTop = typeof anchor.nodeTop === 'number' ? anchor.nodeTop : centerY;
    return {
      centerX,
      centerY,
      nodeTop,
      nodeBottom,
      side,
      hoverDiskDiameter,
      chipHalfHeight: effectiveChipSize.height / 2,
      positions: positions.map((pos) => {
        const rawX = centerX + pos.dx;
        const rawY = centerY + pos.dy;
        const clamped = clampToViewport(rawX, rawY, vv, buttonHalfPx, bottomReservePx);
        return { ...pos, x: clamped.x, y: clamped.y };
      })
    };
    // viewportTick forces re-layout when the visual viewport size changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, effectiveChipSize.height, effectiveChipSize.width, narrowLayout, visibleActions.length, viewportTick]);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'Escape') return;
      if (slopPromptOpen && typeof onSlopPromptClose === 'function') {
        event.preventDefault();
        onSlopPromptClose();
        return;
      }
      // Escape always closes the whole menu — the parent unmounts us when
      // descriptor goes away, which clears any popover state.
      event.preventDefault();
      if (typeof onClose === 'function') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onSlopPromptClose, slopPromptOpen]);

  if (!descriptor || !anchor || !layout) return null;

  function handleBackdropPointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onBackdropPointerDown?.();
  }

  const chipStyle = {
    left: layout.centerX,
    top: layout.centerY,
    transform: 'translate(-50%, -50%)'
  };

  // Place popovers anchored to the selected node's bottom edge so they don't
  // cover the element the user just clicked. If there isn't enough room below
  // (mobile: the bottom chrome eats the lower part of the viewport), flip the
  // popover above the node so it stays fully reachable.
  const popoverPlacement = (() => {
    const vv = readViewportBounds();
    const bottomReserve = narrowLayout ? MOBILE_BOTTOM_CHROME_RESERVE_PX : 0;
    const usableBottom = vv.bottom - bottomReserve - VIEWPORT_MARGIN_PX;
    const gap = narrowLayout ? 10 : 14;
    const estimatedHeight = stakeholdersExpanded ? 280 : 140;
    const belowTop = Math.max(layout.nodeBottom, layout.centerY) + gap;
    if (belowTop + estimatedHeight <= usableBottom) {
      return { top: belowTop, transform: 'translate(-50%, 0)' };
    }
    const aboveTop = Math.min(layout.nodeTop, layout.centerY) - gap;
    return { top: aboveTop, transform: 'translate(-50%, -100%)' };
  })();

  return (
    <div
      ref={wrapperRef}
      className={`radial-action-menu${popoverMode ? ' is-popover' : ''}`}
      role="menu"
      aria-label="Diagram selection actions"
    >
      <div
        className="radial-action-hit-area"
        style={{
          left: layout.centerX,
          top: layout.centerY,
          width: layout.hoverDiskDiameter,
          height: layout.hoverDiskDiameter
        }}
        onPointerDown={handleBackdropPointerDown}
        onPointerEnter={onHoverHold}
        onPointerLeave={onHoverRelease}
        aria-hidden="true"
        data-testid="radial-hit-area"
      />
      {!popoverMode
        ? layout.positions.map((pos, index) => {
            const action = visibleActions[index];
            if (!action) return null;
            const personaShort = action.persona ? action.persona.replace(/^The\s+/i, '') : '';
            const title = action.personaTitle
              ? `${action.label} — ${action.personaTitle}`
              : personaShort
                ? `${action.label} — ${personaShort}`
                : action.label;
            const behavior = action.behavior;
            const isExpander = behavior === 'expandStakeholders';
            const isExplainer = behavior === 'showExplanation';
            const handleClick = () => {
              if (isExplainer) {
                setStakeholdersExpanded(false);
                setExplainerOpen(true);
                return;
              }
              if (isExpander) {
                setExplainerOpen(false);
                setStakeholdersExpanded(true);
                return;
              }
              onActionPick?.(action, descriptor);
            };
            const className = `radial-action-button ${action.variant ? `is-${action.variant}` : ''}`.trim();
            return (
              <button
                key={action.id}
                type="button"
                className={className}
                style={{ left: pos.x, top: pos.y }}
                disabled={(busy && !(isExplainer || isExpander)) || action.disabled}
                onClick={handleClick}
                onPointerEnter={onHoverHold}
                onPointerLeave={onHoverRelease}
                aria-label={personaShort ? `${action.label} (${personaShort})` : action.label}
                aria-pressed={isExplainer || isExpander ? false : undefined}
                aria-expanded={isExpander ? false : undefined}
                title={title}
                data-persona={personaShort || undefined}
                data-action-id={action.id}
              >
                <span className="radial-action-button-icon" aria-hidden="true">
                  {action.icon}
                </span>
              </button>
            );
          })
        : null}
      {!popoverMode ? (
        <div
          ref={chipRef}
          className="radial-action-chip"
          style={chipStyle}
          onPointerDown={handleBackdropPointerDown}
          onPointerEnter={onHoverHold}
          onPointerLeave={onHoverRelease}
        >
          <span className="radial-action-chip-type">{chipTypeLabel}</span>
          {chipName ? <span className="radial-action-chip-name">{chipName}</span> : null}
        </div>
      ) : null}
      {explainerOpen && !slopPrompt ? (
        <div
          className="radial-explainer-popover"
          role="dialog"
          aria-label={`What does ${explainTarget || 'this'} mean?`}
          style={{
            left: layout.centerX,
            top: popoverPlacement.top,
            transform: popoverPlacement.transform
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
          onPointerLeave={onHoverRelease}
        >
          <div className="radial-explainer-head">
            <span className="radial-explainer-eyebrow" aria-hidden="true">?</span>
            <span className="radial-explainer-heading">
              {explainTarget ? <>What is <strong>“{explainTarget}”</strong>?</> : 'What is this?'}
            </span>
            <button
              type="button"
              className="radial-explainer-close"
              onClick={() => onClose?.()}
              aria-label="Close explanation"
            >
              ×
            </button>
          </div>
          {explanation.status === 'loading' ? (
            <p className="radial-explainer-body is-loading" aria-live="polite">
              <span className="radial-explainer-dot" aria-hidden="true" />
              <span className="radial-explainer-dot" aria-hidden="true" />
              <span className="radial-explainer-dot" aria-hidden="true" />
              <span className="sr-only">Asking the architect…</span>
            </p>
          ) : explanation.status === 'error' ? (
            <p className="radial-explainer-body is-error" role="status">
              {explanation.error}
            </p>
          ) : explanation.status === 'ready' ? (
            <p className="radial-explainer-body">{explanation.text}</p>
          ) : null}
        </div>
      ) : null}
      {stakeholdersExpanded && !slopPrompt ? (
        <div
          className="radial-stakeholders-popover"
          role="dialog"
          aria-label="Stakeholders for this element"
          style={{
            left: layout.centerX,
            top: popoverPlacement.top,
            transform: popoverPlacement.transform
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
          onPointerLeave={onHoverRelease}
        >
          <div className="radial-stakeholders-head">
            <span className="radial-stakeholders-eyebrow" aria-hidden="true">🏛️</span>
            <span className="radial-stakeholders-heading">
              {chipName ? <>Stakeholders · <strong>{chipName}</strong></> : 'Stakeholders'}
            </span>
            <button
              type="button"
              className="radial-stakeholders-close"
              onClick={() => onClose?.()}
              aria-label="Close stakeholders"
            >
              ×
            </button>
          </div>
          <div className="radial-stakeholders-list" role="menu">
            {personaActions.map((action) => {
              const personaShort = action.persona ? action.persona.replace(/^The\s+/i, '') : '';
              const title = action.personaTitle
                ? `${action.label} — ${action.personaTitle}`
                : action.label;
              return (
                <button
                  key={action.id}
                  type="button"
                  className={`radial-stakeholders-row slop-action-button ${action.variant ? `is-${action.variant}` : ''}`.trim()}
                  disabled={busy || action.disabled}
                  onClick={() => onActionPick?.(action, descriptor)}
                  aria-label={personaShort ? `${action.label} (${personaShort})` : action.label}
                  title={title}
                  data-action-id={action.id}
                >
                  <span className="radial-stakeholders-row-icon" aria-hidden="true">
                    {action.icon}
                  </span>
                  <span className="radial-stakeholders-row-text">
                    <span className="radial-stakeholders-row-name">{personaShort || action.label}</span>
                    {action.personaTitle ? (
                      <span className="radial-stakeholders-row-title">
                        {action.personaTitle.replace(/^[^·]*·\s*/, '')}
                      </span>
                    ) : null}
                  </span>
                  <span className="radial-stakeholders-row-chip" aria-hidden="true">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {slopPrompt ? (
        <div
          className="radial-slop-prompt-tray"
          style={{
            left: layout.centerX,
            top: layout.centerY + layout.chipHalfHeight + (narrowLayout ? 14 : 18),
            transform: 'translate(-50%, 0)'
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
          onPointerLeave={onHoverRelease}
        >
          {slopPrompt}
        </div>
      ) : null}
    </div>
  );
}
