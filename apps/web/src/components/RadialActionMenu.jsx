import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { partKindLabel } from '../utils/partKindLabel.js';
import { useNarrowLayout } from '../hooks/useAppLayoutMedia.js';
import { MOBILE_BOTTOM_CHROME_RESERVE_PX } from '../utils/layoutBreakpoints.js';
import { chipBoundingClearancePx, resolveArcGeometry } from '../utils/radialMenuLayout.js';
import {
  fallbackLabelGibberish,
  getLabelExplainDumbLevel,
  isLabelExplainGiveUpLevel,
  isLabelExplainGibberishLevel,
  LABEL_EXPLAIN_GIBBERISH_LEVEL,
  labelExplainDumbAudienceBadge,
  labelExplainDumbChipLabel,
  labelExplainDumbLoadingText,
  MAX_LABEL_EXPLAIN_DUMB_LEVEL
} from '@archislop/shared';
import { fetchLabelExplanation } from '../utils/fetchLabelExplanation.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { getVariantPersona } from '../utils/slopitectCopy.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

const WISE_ARCHITECT_EMOJI = getVariantPersona('richard').avatarEmoji || '🧙';
const STAKEHOLDERS_EMOJI = '👥';
const RENDER_MODE_EMOJI = '🔄';

const ARC_RADIUS_DESKTOP_PX = 82;
const ARC_RADIUS_MOBILE_PX = 62;
const BUTTON_HALF_DESKTOP_PX = 34;
const BUTTON_HALF_MOBILE_PX = 32;
const VIEWPORT_MARGIN_PX = 8;
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
    x: Math.max(
      vv.left + VIEWPORT_MARGIN_PX + buttonHalfPx,
      Math.min(vv.right - VIEWPORT_MARGIN_PX - buttonHalfPx, x)
    ),
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
  onClose,
  onAdvisorUsage
}) {
  const { controls } = useUiCopy();
  const radial = controls.radial;
  const explainDumb = controls.explainDumb;
  const wrapperRef = useRef(null);
  const chipRef = useRef(null);
  const popoverRef = useRef(null);
  const dragStateRef = useRef(null);
  const [chipSize, setChipSize] = useState(null);
  const [popoverWidth, setPopoverWidth] = useState(0);
  const [popoverHeight, setPopoverHeight] = useState(0);
  // Until the popover is measured at least once, placement math uses an
  // estimated height that may not match the actual rendered box. Hide the
  // popover during this first paint to avoid a one-frame flash where the
  // popover briefly sits offscreen before re-rendering with the real height.
  const [popoverMeasured, setPopoverMeasured] = useState(false);
  const [dragPos, setDragPos] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportTick, setViewportTick] = useState(0);
  const [stakeholdersExpanded, setStakeholdersExpanded] = useState(false);
  const [renderModesExpanded, setRenderModesExpanded] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  /** 0 = Wise Architect brief; 1–6 = younger; 7 = pre-verbal babble. */
  const [dumbLevel, setDumbLevel] = useState(0);
  const [explainerSurrendering, setExplainerSurrendering] = useState(false);
  const surrenderTimerRef = useRef(null);
  const [explanation, setExplanation] = useState({ status: 'idle', text: '', error: '' });
  const narrowLayout = useNarrowLayout();

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

  const popoverMode = explainerOpen || stakeholdersExpanded || renderModesExpanded;
  const radialPopoverZIndex = useOverlayLayer('radial-action-popover', popoverMode);
  /** Modal trays (explainer, stakeholders, slop prompt) must not inherit the
   * 450ms hover-close grace timer from the arc buttons they replace. */
  const modalSurfaceOpen = popoverMode || slopPromptOpen;

  // When the arc-buttons toggle into a modal tray, the buttons unmount and
  // their `onPointerLeave` fires a `scheduleMenuClose` (450ms timer) in the
  // parent. The tray is modal — it should stay until the user explicitly
  // closes it — so cancel that pending close as soon as we enter modal mode.
  useEffect(() => {
    if (modalSurfaceOpen) onHoverHold?.();
  }, [modalSurfaceOpen, onHoverHold]);

  const visibleActions = useMemo(() => {
    if (!Array.isArray(actions)) return [];
    const cleaned = actions.filter((action) => action && !action.hidden);
    const hasPrimaryGroup = cleaned.some((action) => action.group === 'primary');
    if (!hasPrimaryGroup) return cleaned;
    // Primary actions stay on the arc; persona actions move into the
    // stakeholders tray so the radial menu stays compact.
    return cleaned.filter((action) => (action.group || 'persona') === 'primary');
  }, [actions]);

  const personaActions = useMemo(() => {
    if (!Array.isArray(actions)) return [];
    return actions.filter(
      (action) => action && !action.hidden && (action.group || 'persona') !== 'primary'
    );
  }, [actions]);

  const renderModeAction = useMemo(() => {
    if (!Array.isArray(actions)) return null;
    return actions.find((action) => action && action.behavior === 'expandRenderModes') ?? null;
  }, [actions]);
  const renderModeOptions = Array.isArray(renderModeAction?.modeOptions)
    ? renderModeAction.modeOptions
    : [];

  const chipTypeLabel = descriptor ? partKindLabel(descriptor.partKind) : '';
  const chipName = descriptor ? descriptor.partName || descriptor.label || descriptor.id || '' : '';
  const explainTarget =
    (descriptor &&
      (descriptor.clickedLabel || descriptor.partName || descriptor.label || descriptor.id)) ||
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
      setPopoverMeasured(false);
      return undefined;
    }
    const el = popoverRef.current;
    if (!el) return undefined;
    function measure() {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setPopoverWidth((prev) => (Math.abs(prev - rect.width) < 0.5 ? prev : rect.width));
      setPopoverHeight((prev) => (Math.abs(prev - rect.height) < 0.5 ? prev : rect.height));
      setPopoverMeasured(true);
    }
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    popoverMode,
    explainerOpen,
    stakeholdersExpanded,
    renderModesExpanded,
    explanation.status,
    viewportTick
  ]);

  // The parent re-mounts this component with `key={descriptor.id}` whenever the
  // selected element changes, so popover state (explainer / stakeholders) starts
  // fresh per selection — no manual reset needed here.

  // Closing the explainer (or swapping to stakeholders) resets dumb-down depth
  // so reopening starts at the Wise Architect brief again.
  useEffect(() => {
    if (!explainerOpen) {
      setDumbLevel(0);
      setExplainerSurrendering(false);
    }
  }, [explainerOpen]);

  useEffect(
    () => () => {
      if (surrenderTimerRef.current != null) {
        window.clearTimeout(surrenderTimerRef.current);
        surrenderTimerRef.current = null;
      }
    },
    []
  );

  function triggerExplainerSurrender() {
    if (explainerSurrendering) return;
    setExplainerSurrendering(true);
    surrenderTimerRef.current = window.setTimeout(() => {
      surrenderTimerRef.current = null;
      setExplainerSurrendering(false);
      onClose?.();
    }, 1400);
  }

  function handleDumbDownClick() {
    if (explainerSurrendering || explanation.status === 'loading') return;
    if (isLabelExplainGiveUpLevel(dumbLevel)) {
      triggerExplainerSurrender();
      return;
    }
    if (dumbLevel >= MAX_LABEL_EXPLAIN_DUMB_LEVEL) {
      setDumbLevel(LABEL_EXPLAIN_GIBBERISH_LEVEL);
      return;
    }
    setDumbLevel((level) => (level <= 0 ? 1 : level + 1));
  }

  // When the explainer opens (or the focused part changes while it's open),
  // kick off a fresh fast-agent fetch. Cancel any in-flight call.
  useEffect(() => {
    if (!explainerOpen || !descriptor || explainerSurrendering) return undefined;
    const isGibberish = isLabelExplainGibberishLevel(dumbLevel);
    const controller = new AbortController();
    let alive = true;
    setExplanation({ status: 'loading', text: '', error: '' });
    fetchLabelExplanation({
      descriptor,
      contentType,
      diagramSource,
      sessionId,
      style: isGibberish ? 'gibberish' : dumbLevel > 0 ? 'simple' : 'brief',
      simpleLevel: dumbLevel > 0 && !isGibberish ? dumbLevel : undefined,
      signal: controller.signal
    })
      .then(({ explanation: text, usage, model }) => {
        if (!alive) return;
        onAdvisorUsage?.({ usage, model });
        const resolved = text || (isGibberish ? fallbackLabelGibberish(explainTarget) : '');
        if (resolved) {
          setExplanation({ status: 'ready', text: resolved, error: '' });
        } else {
          setExplanation({
            status: 'error',
            text: '',
            error: radial.explanationMissing
          });
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err?.name === 'AbortError') return;
        setExplanation({
          status: 'error',
          text: '',
          error: err?.message || radial.explanationFailed
        });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [
    contentType,
    descriptor,
    diagramSource,
    explainerOpen,
    dumbLevel,
    sessionId,
    explainTarget,
    explainerSurrendering,
    radial.explanationMissing,
    radial.explanationFailed,
    onAdvisorUsage
  ]);

  const dumbChipLabel = labelExplainDumbChipLabel(dumbLevel);
  const dumbChipEmoji = isLabelExplainGiveUpLevel(dumbLevel)
    ? '🏳️'
    : dumbLevel > 0
      ? (getLabelExplainDumbLevel(dumbLevel)?.emoji ?? '🍼')
      : (getLabelExplainDumbLevel(1)?.emoji ?? '🍼');
  const dumbAudienceBadge = dumbLevel > 0 ? labelExplainDumbAudienceBadge(dumbLevel) : '';
  const isGibberishAnswer = isLabelExplainGibberishLevel(dumbLevel);

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
    const centerX =
      typeof anchor.left === 'number' ? anchor.left : (anchor.nodeLeft + anchor.nodeRight) / 2;
    const centerY =
      typeof anchor.centerY === 'number'
        ? anchor.centerY
        : (anchor.nodeTop + anchor.nodeBottom) / 2;
    const side = pickArcSide(anchor, vv);
    const positions = computeButtonPositions(
      side,
      visibleActions.length,
      arcRadiusPx,
      arcSpreadDeg
    );
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
  }, [
    anchor,
    effectiveChipSize.height,
    effectiveChipSize.width,
    narrowLayout,
    visibleActions.length,
    viewportTick
  ]);

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

  // Roving tabindex across visibleActions. Tab into the menu lands on the active
  // index; arrow keys cycle within. Reset to 0 when the descriptor changes.
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef([]);
  useEffect(() => {
    setFocusedIndex(0);
  }, [descriptor?.id, popoverMode]);
  useEffect(() => {
    if (popoverMode || !visibleActions.length) return;
    const safe = Math.min(focusedIndex, visibleActions.length - 1);
    const el = buttonRefs.current[safe];
    if (el && document.activeElement && el !== document.activeElement) {
      // Only steal focus if we're already inside the menu — never yank focus
      // away from inputs or the canvas when the menu just rendered.
      const active = document.activeElement;
      const insideMenu = buttonRefs.current.some((b) => b === active);
      if (insideMenu) el.focus();
    }
  }, [focusedIndex, popoverMode, visibleActions.length]);
  function handleArcKeyDown(event) {
    if (popoverMode) return;
    if (!visibleActions.length) return;
    const last = visibleActions.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((i) => (i >= last ? 0 : i + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((i) => (i <= 0 ? last : i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setFocusedIndex(last);
    }
  }

  if (!descriptor || !anchor || !layout) return null;

  const slopTrayStyle = (() => {
    const gap = narrowLayout ? 14 : 18;
    if (!slopPromptOpen) {
      return {
        left: layout.centerX,
        top: layout.centerY + layout.chipHalfHeight + gap,
        transform: 'translate(-50%, 0)'
      };
    }
    // On small screens, anchor the prompt inside the visible viewport so the
    // virtual keyboard cannot shove a node-anchored tray off-screen.
    if (narrowLayout) {
      const vv = readViewportBounds();
      const width = Math.min(360, Math.max(280, vv.right - vv.left - VIEWPORT_MARGIN_PX * 2));
      const halfWidth = width / 2;
      const estimatedHeight = 168;
      const usableTop = vv.top + VIEWPORT_MARGIN_PX;
      const usableBottom = vv.bottom - MOBILE_BOTTOM_CHROME_RESERVE_PX - VIEWPORT_MARGIN_PX;
      const top = Math.max(
        usableTop,
        Math.min(usableBottom - estimatedHeight, layout.centerY + layout.chipHalfHeight + gap)
      );
      const clampedLeft = Math.max(
        vv.left + VIEWPORT_MARGIN_PX + halfWidth,
        Math.min(vv.right - VIEWPORT_MARGIN_PX - halfWidth, layout.centerX)
      );
      return { left: clampedLeft, top, transform: 'translate(-50%, 0)' };
    }
    return {
      left: layout.centerX,
      top: layout.centerY + layout.chipHalfHeight + gap,
      transform: 'translate(-50%, 0)'
    };
  })();

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
    const estimatedHeight =
      popoverHeight || (stakeholdersExpanded ? 280 : renderModesExpanded ? 300 : 220);
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
    const clampedLeft =
      maxLeft >= minLeft
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
    const height = popoverHeight || (stakeholdersExpanded ? 280 : renderModesExpanded ? 300 : 220);
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
      style={overlayLayerStyle(popoverMode ? radialPopoverZIndex : undefined)}
      role="menu"
      aria-label={radial.selectionActions}
      onKeyDown={handleArcKeyDown}
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
        onPointerLeave={modalSurfaceOpen ? undefined : onHoverRelease}
        aria-hidden="true"
        data-testid="radial-hit-area"
      />
      {!modalSurfaceOpen
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
            const isModeRenderer = behavior === 'expandRenderModes';
            const handleClick = () => {
              if (isExplainer) {
                setStakeholdersExpanded(false);
                setRenderModesExpanded(false);
                setExplainerOpen(true);
                return;
              }
              if (isExpander) {
                setExplainerOpen(false);
                setRenderModesExpanded(false);
                setStakeholdersExpanded(true);
                return;
              }
              if (isModeRenderer) {
                setExplainerOpen(false);
                setStakeholdersExpanded(false);
                setRenderModesExpanded(true);
                return;
              }
              onActionPick?.(action, descriptor);
            };
            const className =
              `radial-action-button ${action.variant ? `is-${action.variant}` : ''}`.trim();
            return (
              <button
                key={action.id}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={index === Math.min(focusedIndex, visibleActions.length - 1) ? 0 : -1}
                className={className}
                style={{ left: pos.x, top: pos.y }}
                disabled={
                  (busy && !(isExplainer || isExpander || isModeRenderer)) || action.disabled
                }
                onClick={handleClick}
                onFocus={() => setFocusedIndex(index)}
                onPointerEnter={onHoverHold}
                onPointerLeave={onHoverRelease}
                aria-label={personaShort ? `${action.label} (${personaShort})` : action.label}
                aria-pressed={isExplainer || isExpander || isModeRenderer ? false : undefined}
                aria-expanded={isExpander || isModeRenderer ? false : undefined}
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
      {!modalSurfaceOpen ? (
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
          className={`radial-explainer-popover${isDragging ? ' is-dragging' : ''}${draggedPlacement ? ' is-repositioned' : ''}${explainerSurrendering ? ' is-surrendering' : ''}`}
          role="dialog"
          aria-label={
            explainTarget
              ? formatLocale(radial.whatDoesMean, { target: explainTarget })
              : radial.whatDoesThisMean
          }
          style={{
            left: popoverStyle.left,
            top: popoverStyle.top,
            transform: popoverStyle.transform,
            opacity: popoverMeasured || dragPos ? 1 : 0,
            pointerEvents: popoverMeasured || dragPos ? undefined : 'none'
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
        >
          {explainerSurrendering ? (
            <div className="radial-explainer-surrender-debris" aria-hidden="true">
              <span className="radial-explainer-surrender-tag">{radial.outOfScope}</span>
              <span className="radial-explainer-surrender-tag">{radial.wontFix}</span>
              <span className="radial-explainer-surrender-tag">{radial.toBacklog}</span>
              <span className="radial-explainer-surrender-tag">{radial.deprecated}</span>
            </div>
          ) : null}
          <div
            className={`radial-explainer-panel${explainerSurrendering ? ' is-surrendering' : ''}`}
          >
            <div
              className="radial-explainer-head"
              onPointerDown={handleDragPointerDown}
              onPointerMove={handleDragPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              title={radial.dragToReposition}
            >
              <span
                className="radial-explainer-eyebrow"
                role="img"
                aria-label={explainerSurrendering ? radial.decommissioning : radial.wiseArchitect}
                title={explainerSurrendering ? radial.decommissioning : radial.wiseArchitect}
              >
                {explainerSurrendering ? '📋' : WISE_ARCHITECT_EMOJI}
              </span>
              <span className="radial-explainer-heading">
                <span className="radial-explainer-attribution">
                  {explainerSurrendering ? radial.schedulingDeprecation : radial.wiseArchitectOn}
                </span>
                {explainTarget ? (
                  <strong>“{explainTarget}”</strong>
                ) : (
                  <strong>{radial.thisElement}</strong>
                )}
              </span>
              <button
                type="button"
                className="radial-explainer-close"
                onClick={() => onClose?.()}
                disabled={explainerSurrendering}
                aria-label={radial.closeExplanation}
              >
                ×
              </button>
            </div>
            {explanation.status === 'loading' ? (
              <p className="radial-explainer-body is-loading" aria-live="polite">
                <span className="radial-explainer-dot" aria-hidden="true" />
                <span className="radial-explainer-dot" aria-hidden="true" />
                <span className="radial-explainer-dot" aria-hidden="true" />
                <span className="sr-only">{labelExplainDumbLoadingText(dumbLevel)}</span>
              </p>
            ) : explanation.status === 'error' ? (
              <p className="radial-explainer-body is-error" role="status">
                {explanation.error}
              </p>
            ) : explanation.status === 'ready' ? (
              <>
                {dumbAudienceBadge ? (
                  <p className="radial-explainer-audience" aria-live="polite">
                    {dumbAudienceBadge}
                  </p>
                ) : null}
                <p className={`radial-explainer-body${isGibberishAnswer ? ' is-gibberish' : ''}`}>
                  {explanation.text}
                </p>
              </>
            ) : null}
            {explainerSurrendering ? (
              <p className="radial-explainer-surrender-caption" aria-live="assertive">
                {explainDumb.surrenderCaption}
              </p>
            ) : null}
            <div
              className="radial-explainer-followups"
              role="group"
              aria-label={explainDumb.rephraseGroup}
            >
              <button
                type="button"
                className={`radial-explainer-followup is-simple${dumbLevel > 0 ? ' is-active' : ''}${isLabelExplainGiveUpLevel(dumbLevel) ? ' is-give-up' : ''}`}
                onClick={handleDumbDownClick}
                disabled={explanation.status === 'loading' || explainerSurrendering}
                aria-pressed={dumbLevel > 0}
                title={
                  isLabelExplainGiveUpLevel(dumbLevel)
                    ? explainDumb.decommissionTitle
                    : dumbLevel <= 0
                      ? explainDumb.rephrasePlain
                      : dumbLevel >= MAX_LABEL_EXPLAIN_DUMB_LEVEL
                        ? explainDumb.rephraseGibberish
                        : explainDumb.rephraseYounger
                }
              >
                <span className="radial-explainer-followup-emoji" aria-hidden="true">
                  {dumbChipEmoji}
                </span>
                <span className="radial-explainer-followup-label">{dumbChipLabel}</span>
              </button>
              <button
                type="button"
                className="radial-explainer-followup is-detail"
                onClick={() => {
                  onDrillDeeper?.(descriptor);
                }}
                disabled={typeof onDrillDeeper !== 'function' || explainerSurrendering}
                title={radial.drillDeeperTitle}
              >
                <span className="radial-explainer-followup-emoji" aria-hidden="true">
                  🔍
                </span>
                <span className="radial-explainer-followup-label">{radial.drillDeeper}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {stakeholdersExpanded && !slopPrompt ? (
        <div
          ref={popoverRef}
          className={`radial-stakeholders-popover${isDragging ? ' is-dragging' : ''}${draggedPlacement ? ' is-repositioned' : ''}`}
          role="dialog"
          aria-label={radial.stakeholdersForElement}
          style={{
            left: popoverStyle.left,
            top: popoverStyle.top,
            transform: popoverStyle.transform,
            opacity: popoverMeasured || dragPos ? 1 : 0,
            pointerEvents: popoverMeasured || dragPos ? undefined : 'none'
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
            title={radial.dragToReposition}
          >
            <span className="radial-stakeholders-eyebrow" aria-hidden="true">
              {STAKEHOLDERS_EMOJI}
            </span>
            <span className="radial-stakeholders-heading">
              {chipName ? (
                <>{formatLocale(radial.stakeholdersWithName, { name: chipName })}</>
              ) : (
                radial.stakeholdersHeading
              )}
            </span>
            <button
              type="button"
              className="radial-stakeholders-close"
              onClick={() => onClose?.()}
              aria-label={radial.closeStakeholders}
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
                    <span className="radial-stakeholders-row-name">
                      {personaShort || action.label}
                    </span>
                    {action.personaTitle ? (
                      <span className="radial-stakeholders-row-title">
                        {action.personaTitle.replace(/^[^·]*·\s*/, '')}
                      </span>
                    ) : null}
                  </span>
                  <span className="radial-stakeholders-row-chip" aria-hidden="true">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {renderModesExpanded && !slopPrompt ? (
        <div
          ref={popoverRef}
          className={`radial-render-mode-popover${isDragging ? ' is-dragging' : ''}${draggedPlacement ? ' is-repositioned' : ''}`}
          role="dialog"
          aria-label={radial.renderSelectedInMode}
          style={{
            left: popoverStyle.left,
            top: popoverStyle.top,
            transform: popoverStyle.transform,
            opacity: popoverMeasured || dragPos ? 1 : 0,
            pointerEvents: popoverMeasured || dragPos ? undefined : 'none'
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
        >
          <div
            className="radial-render-mode-head"
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title={radial.dragToReposition}
          >
            <span className="radial-render-mode-eyebrow" aria-hidden="true">
              {RENDER_MODE_EMOJI}
            </span>
            <span className="radial-render-mode-heading">
              {chipName ? (
                <>{formatLocale(radial.renderNameAs, { name: chipName })}</>
              ) : (
                radial.renderAsHeading
              )}
            </span>
            <button
              type="button"
              className="radial-render-mode-close"
              onClick={() => onClose?.()}
              aria-label={radial.closeRenderPicker}
            >
              ×
            </button>
          </div>
          <div
            className="radial-render-mode-list"
            role="menu"
            aria-label={controls.contentModes.renderMenu}
          >
            {renderModeOptions.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`radial-render-mode-row${mode.disabled ? ' is-current' : ''}`}
                disabled={busy || mode.disabled}
                onClick={() => {
                  onActionPick?.({ ...renderModeAction, targetMode: mode.id }, descriptor);
                }}
                aria-label={
                  mode.disabled
                    ? formatLocale(radial.currentModeIs, { mode: mode.label })
                    : formatLocale(radial.renderAs, { mode: mode.label })
                }
                title={
                  mode.disabled
                    ? formatLocale(radial.currentModeActive, { mode: mode.label })
                    : formatLocale(radial.renderSelectionAs, { mode: mode.label })
                }
                data-mode-id={mode.id}
              >
                <span className="radial-render-mode-row-icon" aria-hidden="true">
                  {mode.shortLabel !== mode.label ? mode.shortLabel : ''}
                </span>{' '}
                <span className="radial-render-mode-row-text">
                  <span className="radial-render-mode-row-name">{mode.label}</span>
                  <span className="radial-render-mode-row-title">
                    {mode.disabled ? radial.currentMode : (mode.techLabel ?? mode.subtitle)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {slopPrompt ? (
        <div
          className="radial-slop-prompt-tray"
          style={slopTrayStyle}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onHoverHold}
        >
          {slopPrompt}
        </div>
      ) : null}
    </div>
  );
}
