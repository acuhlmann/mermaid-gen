import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import ConcentrationControl from './ConcentrationControl.jsx';
import DeskOsPresenceStrip from './DeskOsPresenceStrip.jsx';
import DeskOsTray from './DeskOsTray.jsx';
import DeskStandUpButton from './DeskStandUpButton.jsx';
import LevelUpInfoPanel from './LevelUpInfoPanel.jsx';
import XpProgressBar from './XpProgressBar.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { useDeskSlotRef } from '../hooks/useDeskSlotRef.js';
import { usePhoneLayout } from '../hooks/useAppLayoutMedia.js';
import { officeChromeCopy } from '../utils/officeCast.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';
import { resolveUserName } from '../state/userIdentityStore.js';
import {
  getOfficeViewMode,
  standUp,
  subscribe as subscribeOfficeViewMode
} from '../state/officeViewModeStore.js';

const PANEL_GAP_PX = 8;
const SAFE_INSET_PX = 8;
const MAX_PANEL_WIDTH_PX = 352; // ~22rem

/**
 * The level panel used to hang *below* the brand chip. From the taskbar it has
 * to rise, like every other tray popover — same clamp, flipped axis.
 *
 * @param {DOMRect} anchorRect
 * @returns {import('react').CSSProperties}
 */
function computeTrayPanelStyle(anchorRect) {
  const viewportWidth = window.innerWidth;
  const maxWidth = Math.min(MAX_PANEL_WIDTH_PX, viewportWidth - SAFE_INSET_PX * 2);
  let left = anchorRect.right - maxWidth;
  left = Math.max(SAFE_INSET_PX, Math.min(left, viewportWidth - maxWidth - SAFE_INSET_PX));
  const width = Math.min(maxWidth, viewportWidth - left - SAFE_INSET_PX);

  return {
    position: 'fixed',
    left,
    top: 'auto',
    bottom: Math.max(SAFE_INSET_PX, window.innerHeight - anchorRect.top + PANEL_GAP_PX),
    width,
    maxWidth: width
  };
}

/**
 * The parody-OS taskbar (docs/office-isometric-mode.md §4) — the bottom edge of
 * the workstation, and the second half of the ADR-0011 rule-3 frame whose top
 * half is `DeskOsMenuBar`.
 *
 * Three zones, in the order every desktop OS has used since 1995:
 *
 * - **Leading cluster — the office.** `Stand up` (the one verb that leaves this
 *   renderer for the other one; still `Shift+O`), then the three ways the office
 *   reaches you — mail / Slop Chat / meeting — then what the room is doing.
 *   The comms icons arrive by **portal** through `deskSlotStore`, exactly as they
 *   did when the anchor lived on the composer band: the bar still owns no office
 *   state, it owns a hole that `OfficeLayer` fills. The presence strip keeps
 *   sharing this cluster (ADR-0011 rule 3 — the diegetic floor affordance is only
 *   allowed beside the labelled control it duplicates) and is the part that grows,
 *   because "what is going on in the office" is a sentence and needs room.
 * - **Window list** — `DeskOsTray`, the open office windows.
 * - **Tray end** — persistent status an OS puts by the clock. Below 720px this
 *   whole cluster's *optional* half retires: Concentration and the HR chip both
 *   have a second home (Admin, and the desk menu), and on a phone the bar's job
 *   is the office and the windows, not a scorecard.
 *
 * The taskbar owns no office state. Standing/sitting is read straight off
 * `officeViewModeStore` (a global store, exactly like the overlay stack the
 * window list reads), which is why this can live in the shell tree instead of
 * inside `OfficeLayer` — and why it does not violate "one state, two
 * renderers": the floor renderer reads the same store and this bar hides
 * entirely while you are standing.
 *
 * @param {object} props
 */
export default function DeskOsTaskbar({
  status = null,
  error = false,
  stoppable = false,
  stopLabel = null,
  onStop,
  gamification = null,
  xpBarFlashKey = 0,
  liveVariant = null,
  xpInfoPanelOpen = false,
  onToggleXpInfoPanel,
  onCloseXpInfoPanel,
  costTrackingEnabled = false,
  modelProfile = 'fast',
  onSelectModelProfile = null
}) {
  const viewMode = useSyncExternalStore(
    subscribeOfficeViewMode,
    getOfficeViewMode,
    getOfficeViewMode
  );
  const { controls } = useUiCopy();
  const copy = officeChromeCopy().osTray ?? {};
  const deskSlotRef = useDeskSlotRef();
  // Space-constrained means *phone*, not "mobile": a tablet has room for the
  // status half. Concentration and the HR chip both have a second home (Admin,
  // the desk menu), so the bar sheds them rather than shedding the office.
  const phone = usePhoneLayout();
  const xpAnchorRef = useRef(null);
  const [xpAnchorRect, setXpAnchorRect] = useState(/** @type {DOMRect | null} */ (null));
  const levelUpZIndex = useOverlayLayer('levelup-info-panel', xpInfoPanelOpen);
  const onFloor = viewMode === 'floor';
  const showStatusHalf = !phone;
  const hasLevel = Boolean(gamification?.level) && showStatusHalf;
  const panelOpen = xpInfoPanelOpen && hasLevel && !onFloor;

  useLayoutEffect(() => {
    if (!panelOpen) {
      setXpAnchorRect(null);
      return undefined;
    }
    const measure = () => {
      const node = xpAnchorRef.current;
      if (!node) return;
      setXpAnchorRect(node.getBoundingClientRect());
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (xpAnchorRef.current) ro?.observe(xpAnchorRef.current);
    window.addEventListener('resize', measure);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
    };
  }, [panelOpen]);

  // The floor is the physical world — no OS chrome while you are standing.
  if (onFloor) return null;

  const levelPanel =
    panelOpen && xpAnchorRect && typeof document !== 'undefined'
      ? createPortal(
          <div
            id="levelup-info-panel"
            className="levelup-info-panel-mount levelup-info-panel-mount--portaled levelup-info-panel-mount--tray"
            style={overlayLayerStyle(levelUpZIndex, computeTrayPanelStyle(xpAnchorRect))}
            onClick={(event) => event.stopPropagation()}
          >
            <LevelUpInfoPanel
              level={gamification.level}
              levelTitle={gamification.levelTitle}
              levelFlair={gamification.levelFlair}
              levelShortLabel={gamification.levelShortLabel}
              progressRatio={gamification.levelProgressRatio}
              xpInto={gamification.xpIntoLevel}
              xpForNext={gamification.xpForNextLevel}
              totalXp={gamification.xp}
              isMaxLevel={gamification.xpForNextLevel == null}
              prestigeShortLabel={gamification.prestigeShortLabel}
              totalRuns={gamification.totalRuns}
              runsByVariant={gamification.runsByVariant}
              achievements={gamification.achievements}
              lifetimeLlmCostUsd={gamification.lifetimeLlmCostUsd ?? 0}
              costTrackingEnabled={costTrackingEnabled}
              userName={resolveUserName()}
              onClose={onCloseXpInfoPanel}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className="desk-os-taskbar"
      data-testid="desk-os-taskbar"
      role="toolbar"
      aria-label={copy.taskbarAria ?? copy.aria}
    >
      {/* Always the sit-down half of the pair is missing on purpose: this bar is
          desk chrome, and the floor carries its own way back (`FloorTopBar`).

          The presence strip shares this cluster rather than standing alone: it
          is the *diegetic* way onto the floor, and ADR-0011 rule 3 only permits
          that next to the labelled control it duplicates. Grouped, the pairing
          is structural instead of a coincidence of flex order. */}
      <div className="desk-os-taskbar-lead">
        <DeskStandUpButton standing={false} onStandUp={standUp} />
        {/* Portal target for OfficeLayer's comms cluster. Rendered unconditionally
            so the anchor exists before the office mounts; OfficeLayer decides
            whether to fill it (`deskActionsAnchorReady`), which is also what keeps
            the entry tour able to reveal it one step at a time. */}
        <div
          id="office-desk-bottom-slot"
          ref={deskSlotRef}
          className="desk-os-taskbar-comms desk-tour-piece desk-tour-piece--desk"
        />
        <DeskOsPresenceStrip />
      </div>

      <DeskOsTray />

      <div
        className="desk-os-taskbar-end"
        role="group"
        aria-label={copy.trayAria ?? copy.taskbarAria ?? copy.aria}
      >
        {status ? (
          <div className="desk-os-taskbar-status">
            <p
              id="app-status"
              className={`overlay-status ${error ? 'is-error' : ''}`}
              role="status"
            >
              {status}
            </p>
            {stoppable ? (
              <button
                type="button"
                className="overlay-button compact-button overlay-status-stop"
                onClick={onStop}
              >
                {stopLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        {onSelectModelProfile && showStatusHalf ? (
          <ConcentrationControl
            variant="tray"
            compact
            modelProfile={modelProfile}
            onSelectModelProfile={onSelectModelProfile}
          />
        ) : null}

        {hasLevel ? (
          <div className="desk-os-taskbar-xp" ref={xpAnchorRef}>
            {gamification.prestigeShortLabel ? (
              <span
                className="brand-prestige-badge"
                title={controls.brand.totalSlopRuns.replace(
                  '{count}',
                  String(gamification.totalRuns ?? 0)
                )}
                data-testid="brand-prestige-badge"
              >
                {gamification.prestigeShortLabel}
              </span>
            ) : null}
            <XpProgressBar
              level={gamification.level}
              short={gamification.levelShortLabel}
              flair={gamification.levelFlair}
              progressRatio={gamification.levelProgressRatio}
              xpInto={gamification.xpIntoLevel}
              xpForNext={gamification.xpForNextLevel}
              totalXp={gamification.xp}
              isMaxLevel={gamification.xpForNextLevel == null}
              flashKey={xpBarFlashKey}
              variant={liveVariant}
              onClick={onToggleXpInfoPanel}
              expanded={xpInfoPanelOpen}
              controlsId="levelup-info-panel"
            />
          </div>
        ) : null}
      </div>
      {levelPanel}
    </div>
  );
}
