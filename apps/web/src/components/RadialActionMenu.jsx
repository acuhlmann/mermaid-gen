import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { partKindLabel } from '../utils/partKindLabel.js';
import { MOBILE_MEDIA_QUERY } from '../utils/layoutBreakpoints.js';
import { chipBoundingClearancePx, resolveArcGeometry } from '../utils/radialMenuLayout.js';
import { fetchLabelExplanation } from '../utils/fetchLabelExplanation.js';
import { getVariantPersona } from '../utils/slopitectCopy.js';

const WISE_ARCHITECT_EMOJI = getVariantPersona('explain').avatarEmoji || '🧙';
const STAKEHOLDERS_EMOJI = '👥';

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
  onDrillDeeper,
  onHoverHold,
  onHoverRelease,
  onBackdropPointerDown,
  onClose
}) {
  const wrapperRef = useRef(null);
  const chipRef = useRef(null);
  const popoverRef = useRef(null);
  const dragStateRef = useRef(null);
  const [chipSize, setChipSize] = useState(null);
  const [popoverWidth, setPopoverWidth] = useState(0);
  const [popoverHeight, setPopoverHeight] = useState(0);
  const [dragPos, setDragPos] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportTick, setViewportTick] = useState(0);
  const [stakeholdersExpanded, setStakeholdersExpanded] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [explainStyle, setExplainStyle] = useState('brief');
  const [explainSimpleRefresh, setExplainSimpleRefresh] = useState(0);
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

  // When the arc-buttons toggle into popover mode, the buttons unmount and
  // their `onPointerLeave` fires a `scheduleMenuClose` (450ms timer) in the
  // parent. The popover is a modal — it should stay until the user explicitly
  // closes it — so cancel that pending close as soon as we enter popoverMode.
  useEffect(() => {
    if (popoverMode) onHoverHold?.();
  }, [popoverMode, onHoverHold]);

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

  // Measure the rendered popover so popoverPlacement can clamp against the
  // visual viewport in both axes. Without the height measurement, a tall
  // explanation (or many stakeholders) could overflow the bottom of the
  // viewport even after our above/below flip, leaving the user unable to
  // read the popover.
  useLayoutEffect(() => {
    if (!popoverMode) {
      setPopoverWidth(0);
      setPopoverHeight(0);
      return undefined;
    }
    const el = popoverRef.current;
    if (!el) return undefined;
    function measure() {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setPopoverWidth((prev) => (Math.abs(prev - rect.width) < 0.5 ? prev : rect.width));
      setPopoverHeight((prev) => (Math.abs(prev - rect.height) < 0.5 ? prev : rect.height));
    }
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [popoverMode, explainerOpen, stakeholdersExpanded, explanation.status, viewportTick]);

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
      style: explainStyle,
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
  }, [contentType, descriptor, diagramSource, explainerOpen, explainStyle, explainSimpleRefresh, sessionId]);

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

  // Place popovers anchored to the selected node so they don't cover the
  // element the user just clicked. Prefer below the node, then above, and if
  // neither fits (small viewport + tall popover) center inside the visible
  // viewport so the user can always read it. Horizontally we always clamp
  // to the visual viewport — important on mobile where a node clicked near
  // a screen edge would otherwise cut off the panel.
  //
  // The popover is rendered with `transform: translate(-50%, 0)` so `top`
  // here is the popover's top edge. This keeps the drag math (which uses
  // absolute pixel coords) consistent with the anchored placement math.
  const popoverPlacement = (() => {
    const vv = readViewportBounds();
    const bottomReserve = narrowLayout ? MOBILE_BOTTOM_CHROME_RESERVE_PX : 0;
    const usableTop = vv.top + VIEWPORT_MARGIN_PX;
    const usableBottom = vv.bottom - bottomReserve - VIEWPORT_MARGIN_PX;
    const usableHeight = Math.max(0, usableBottom - usableTop);
    const gap = narrowLayout ? 10 : 14;
    // Use measured height when available; on first paint fall back to a
    // generous estimate. Once measured, the actual rendered size drives
    // placement so a long Wise Architect explanation can't silently overflow.
    const estimatedHeight = popoverHeight || (stakeholdersExpanded ? 280 : 220);
    const popHeight = Math.min(estimatedHeight, usableHeight);
    const nodeBottom = Math.max(layout.nodeBottom, layout.centerY);
    const nodeTop = Math.min(layout.nodeTop, layout.centerY);
    const belowTop = nodeBottom + gap;
    const aboveTop = nodeTop - gap - popHeight;

    let top;
    if (belowTop + popHeight <= usableBottom) {
      top = belowTop;
    } else if (aboveTop >= usableTop) {
      top = aboveTop;
    } else {
      // Neither side fits the popover within the visible viewport. Center it
      // vertically so the user can still read the content; they can drag it
      // closer to the original anchor if they want.
      top = usableTop + Math.max(0, (usableHeight - popHeight) / 2);
    }

    const halfWidth = (popoverWidth || 280) / 2;
    const minLeft = vv.left + VIEWPORT_MARGIN_PX + halfWidth;
    const maxLeft = vv.right - VIEWPORT_MARGIN_PX - halfWidth;
    const clampedLeft = maxLeft >= minLeft
      ? Math.max(minLeft, Math.min(maxLeft, layout.centerX))
      : (vv.left + vv.right) / 2;
    return { left: clampedLeft, top, transform: 'translate(-50%, 0)' };
  })();

  // When the user drags, store absolute pixel coords for the popover's
  // top-left corner. Render-time re-clamping below keeps the dragged popover
  // visible if the viewport shrinks (e.g. mobile keyboard opens).
  const draggedPlacement = (() => {
    if (!dragPos) return null;
    const vv = readViewportBounds();
    const bottomReserve = narrowLayout ? MOBILE_BOTTOM_CHROME_RESERVE_PX : 0;
    const width = popoverWidth || 280;
    const height = popoverHeight || (stakeholdersExpanded ? 280 : 220);
    const minLeft = vv.left + VIEWPORT_MARGIN_PX;
    const minTop = vv.top + VIEWPORT_MARGIN_PX;
    const maxLeft = Math.max(minLeft, vv.right - VIEWPORT_MARGIN_PX - width);
    const maxTop = Math.max(minTop, vv.bottom - bottomReserve - VIEWPORT_MARGIN_PX - height);
    const left = Math.max(minLeft, Math.min(maxLeft, dragPos.left));
    const top = Math.max(minTop, Math.min(maxTop, dragPos.top));
    return { left, top, transform: 'none' };
  })();

  const popoverStyle = draggedPlacement ?? popoverPlacement;

  function handleDragPointerDown(event) {
    // Don't start a drag from interactive children (close button, follow-up
    // chips, stakeholder rows) — those should keep their normal click semantics.
    if (event.target.closest('button, a, input, textarea, select')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const el = popoverRef.current;
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = el.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    setIsDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; drag still works via the document
      // listeners attached during the drag.
    }
  }

  function handleDragPointerMove(event) {
    const state = dragStateRef.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const left = event.clientX - state.offsetX;
    const top = event.clientY - state.offsetY;
    setDragPos({ left, top });
  }

  function endDrag(event) {
    const state = dragStateRef.current;
    if (!state) return;
    if (event && event.pointerId !== state.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
    if (event) {
      try {
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={`radial-action-menu${popoverMode ? ' is-popover' : ''}${slopPrompt ? ' is-slop-prompt' : ''}`}
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
        onPointerLeave={popoverMode ? undefined : onHoverRelease}
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
          ref={popoverRef}
          className={`radial-explainer-popover${isDragging ? ' is-dragging' : ''}${draggedPlacement ? ' is-repositioned' : ''}`}
          role="dialog"
          aria-label={`What does ${explainTarget || 'this'} mean?`}
          style={{
            left: popoverStyle.left,
            top: popoverStyle.top,
            transform: popoverStyle.transform
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
        >
          <div
            className="radial-explainer-head"
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to reposition"
          >
            <span
              className="radial-explainer-eyebrow"
              role="img"
              aria-label="The Wise Architect"
              title="The Wise Architect"
            >
              {WISE_ARCHITECT_EMOJI}
            </span>
            <span className="radial-explainer-heading">
              <span className="radial-explainer-attribution">The Wise Architect on</span>
              {explainTarget ? <strong>“{explainTarget}”</strong> : <strong>this element</strong>}
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
              <span className="sr-only">
                {explainStyle === 'simple' ? 'Dumbing it down…' : 'Consulting the Wise Architect…'}
              </span>
            </p>
          ) : explanation.status === 'error' ? (
            <p className="radial-explainer-body is-error" role="status">
              {explanation.error}
            </p>
          ) : explanation.status === 'ready' ? (
            <p className="radial-explainer-body">{explanation.text}</p>
          ) : null}
          <div className="radial-explainer-followups" role="group" aria-label="Rephrase options">
            <button
              type="button"
              className={`radial-explainer-followup is-simple${explainStyle === 'simple' ? ' is-active' : ''}`}
              onClick={() => {
                if (explainStyle === 'simple') setExplainSimpleRefresh((n) => n + 1);
                else setExplainStyle('simple');
              }}
              disabled={explanation.status === 'loading'}
              aria-pressed={explainStyle === 'simple'}
              title="Rephrase in plain language for the back row"
            >
              <span className="radial-explainer-followup-emoji" aria-hidden="true">🍼</span>
              <span className="radial-explainer-followup-label">Dumb it Down</span>
            </button>
            <button
              type="button"
              className="radial-explainer-followup is-detail"
              onClick={() => {
                onDrillDeeper?.(descriptor);
              }}
              disabled={typeof onDrillDeeper !== 'function'}
              title="Spin up a full architecture deep-dive in the Thinking panel"
            >
              <span className="radial-explainer-followup-emoji" aria-hidden="true">🔍</span>
              <span className="radial-explainer-followup-label">Drill Deeper</span>
            </button>
          </div>
        </div>
      ) : null}
      {stakeholdersExpanded && !slopPrompt ? (
        <div
          ref={popoverRef}
          className={`radial-stakeholders-popover${isDragging ? ' is-dragging' : ''}${draggedPlacement ? ' is-repositioned' : ''}`}
          role="dialog"
          aria-label="Stakeholders for this element"
          style={{
            left: popoverStyle.left,
            top: popoverStyle.top,
            transform: popoverStyle.transform
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
        >
          <div
            className="radial-stakeholders-head"
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to reposition"
          >
            <span className="radial-stakeholders-eyebrow" aria-hidden="true">{STAKEHOLDERS_EMOJI}</span>
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
