import DeskOsMenuBar from '../../components/DeskOsMenuBar.jsx';
import DiagramFullscreenButton from '../../components/DiagramFullscreenButton.jsx';
import { ArchiSlopMarkIcon } from '../../components/AppIcons.jsx';
import { TopShell } from '../../components/TopShell.jsx';
import { SlopitectTipSlot } from '../prompt/SlopitectTipSlot.jsx';

/**
 * Top shell — the parody-OS **menu bar** (ADR-0011 rule 3;
 * docs/office-isometric-mode.md §4).
 *
 * The brand keeps the leading slot, the way an OS keeps its logo in the corner
 * you reach for first, and keeps its Slopitect Tip™ click. What changed is what
 * follows it: the strip used to carry an XP bar and one fullscreen button, and
 * now carries the menus that used to be scattered across the bottom row (the
 * Desk tray's Deliverable format, the export panel buried inside the desk menu,
 * Shredder, the panel toggles, and the once-a-session admin verbs).
 *
 * The XP bar, prestige badge and `LevelUpInfoPanel` moved to the taskbar tray
 * (`DeskOsTaskbar`) — persistent status belongs next to the clock, not next to
 * the logo. The gamification parody is not being removed; it is being given the
 * place an OS puts standing status.
 *
 * `menuBar` arrives as one object rather than ~18 loose props: it is a single
 * cohesive group and `AppWorkspaceSlot` is already carrying more pass-through
 * props than it should.
 *
 * @param {object} props
 */
export function BrandChromeSlot({
  narrowLayout,
  slopitectTip,
  slopitectTipRef,
  onDismissSlopitectTip,
  controls,
  onBrandClick,
  menuBar = null,
  fullscreenSupported,
  hasCanvasContent,
  editorOpen,
  isFullscreen,
  streamingPreview,
  onToggleFullscreen
}) {
  return (
    <TopShell>
      <div
        className={`brand-control ${narrowLayout ? 'is-mobile' : ''} ${slopitectTip ? 'has-tip' : ''}`}
        aria-label="ArchiSlop"
        onClick={onBrandClick}
      >
        <div className="brand-control-chip">
          <div className="brand-control-chip-row">
            <span className="brand-mark" aria-hidden="true">
              <ArchiSlopMarkIcon />
            </span>
            <span className="brand-name">ArchiSlop</span>
          </div>
        </div>
        <SlopitectTipSlot
          tip={slopitectTip}
          tipRef={slopitectTipRef}
          tipLabel={controls.insights.tipLabel}
          onDismiss={onDismissSlopitectTip}
        />
      </div>

      {menuBar ? <DeskOsMenuBar {...menuBar} /> : null}

      {/* Fullscreen keeps its own corner button *and* a View-menu entry: it is
          the one control that acts on the canvas itself, and burying a
          one-click canvas verb two clicks deep would be a downgrade. The menu
          entry is the labelled, discoverable duplicate (ADR-0011 rule 3). */}
      {fullscreenSupported && (hasCanvasContent || editorOpen) ? (
        <div className="top-corner-controls" aria-label={controls.diagramSurface.controls}>
          <DiagramFullscreenButton
            isFullscreen={isFullscreen}
            disabled={streamingPreview}
            onToggle={onToggleFullscreen}
          />
        </div>
      ) : null}
    </TopShell>
  );
}
