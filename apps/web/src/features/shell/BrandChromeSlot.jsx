import { useRef } from 'react';
import { createPortal } from 'react-dom';
import DiagramFullscreenButton from '../../components/DiagramFullscreenButton.jsx';
import { ArchiSlopMarkIcon } from '../../components/AppIcons.jsx';
import XpProgressBar from '../../components/XpProgressBar.jsx';
import LevelUpInfoPanel from '../../components/LevelUpInfoPanel.jsx';
import { TopShell } from '../../components/TopShell.jsx';
import { SlopitectTipSlot } from '../prompt/SlopitectTipSlot.jsx';
import { resolveUserName } from '../../state/userIdentityStore.js';
import { useAdvisorFloatAnchor } from '../../hooks/useAdvisorFloatAnchor.js';
import { overlayLayerStyle, useOverlayLayer } from '../../hooks/useOverlayLayer.js';

const PANEL_GAP_PX = 8;
const SAFE_INSET_PX = 8;
const MAX_PANEL_WIDTH_PX = 352; // ~22rem

/**
 * @param {DOMRect} anchorRect
 * @param {boolean} narrowLayout
 * @returns {import('react').CSSProperties}
 */
function computePortaledLevelPanelStyle(anchorRect, narrowLayout) {
  const viewportWidth = window.innerWidth;
  const maxWidth = Math.min(
    MAX_PANEL_WIDTH_PX,
    viewportWidth - SAFE_INSET_PX * 2,
    narrowLayout ? viewportWidth - SAFE_INSET_PX * 2 : MAX_PANEL_WIDTH_PX
  );
  let left = anchorRect.left;
  left = Math.max(SAFE_INSET_PX, Math.min(left, viewportWidth - maxWidth - SAFE_INSET_PX));
  const width = Math.min(maxWidth, viewportWidth - left - SAFE_INSET_PX);

  return {
    position: 'fixed',
    left,
    top: anchorRect.bottom + PANEL_GAP_PX,
    width,
    maxWidth: width,
    zIndex: undefined // applied via overlayLayerStyle
  };
}

/**
 * Top shell: brand chip, XP/progression chrome, Slopitect tip, and fullscreen control.
 *
 * @param {object} props
 */
export function BrandChromeSlot({
  narrowLayout,
  compactBrand,
  xpBarMobileOpen,
  onToggleXpBarMobile,
  slopitectTip,
  slopitectTipRef,
  onDismissSlopitectTip,
  xpInfoPanelOpen,
  onToggleXpInfoPanel,
  onCloseXpInfoPanel,
  gamification,
  xpBarFlashKey,
  liveVariant,
  controls,
  onBrandClick,
  costTrackingEnabled,
  fullscreenSupported,
  hasCanvasContent,
  editorOpen,
  isFullscreen,
  streamingPreview,
  onToggleFullscreen
}) {
  const brandRef = useRef(null);
  const levelUpZIndex = useOverlayLayer('levelup-info-panel', xpInfoPanelOpen);
  const brandRect = useAdvisorFloatAnchor(brandRef, xpInfoPanelOpen);

  const levelPanel =
    xpInfoPanelOpen && gamification?.level && brandRect && typeof document !== 'undefined'
      ? createPortal(
          <div
            id="levelup-info-panel"
            className={`levelup-info-panel-mount levelup-info-panel-mount--portaled${narrowLayout ? ' is-mobile' : ''}`}
            style={overlayLayerStyle(
              levelUpZIndex,
              computePortaledLevelPanelStyle(brandRect, narrowLayout)
            )}
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
    <TopShell>
      <div
        ref={brandRef}
        className={`brand-control ${narrowLayout ? 'is-mobile' : ''} ${narrowLayout && compactBrand ? 'is-compact' : ''} ${narrowLayout && (xpBarMobileOpen || !compactBrand) ? 'is-xp-open' : ''} ${slopitectTip ? 'has-tip' : ''} ${xpInfoPanelOpen ? 'is-info-panel-open' : ''}`}
        aria-label="ArchiSlop"
        onClick={onBrandClick}
      >
        <div className="brand-control-chip">
          <div className="brand-control-chip-row">
            <span className="brand-mark" aria-hidden="true">
              <ArchiSlopMarkIcon />
            </span>
            <span className="brand-name">ArchiSlop</span>
            {gamification?.prestigeShortLabel ? (
              narrowLayout && compactBrand ? (
                <button
                  type="button"
                  className="brand-prestige-badge"
                  title={`${controls.brand.totalSlopRuns.replace('{count}', String(gamification.totalRuns ?? 0))} · ${xpBarMobileOpen ? controls.brand.tapToHideXp : controls.brand.tapToShowXp}`}
                  data-testid="brand-prestige-badge"
                  aria-expanded={xpBarMobileOpen}
                  aria-controls="brand-xp-mobile-slot"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleXpBarMobile();
                  }}
                >
                  {gamification.prestigeShortLabel}
                </button>
              ) : (
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
              )
            ) : null}
            {gamification?.level && !narrowLayout ? (
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
            ) : null}
          </div>
          {gamification?.level && narrowLayout ? (
            <div
              id="brand-xp-mobile-slot"
              className={`brand-xp-mobile-slot ${xpBarMobileOpen || !compactBrand ? 'is-open' : ''} ${compactBrand ? '' : 'is-always-on'}`}
              aria-hidden={compactBrand ? !xpBarMobileOpen : false}
            >
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
        <SlopitectTipSlot
          tip={slopitectTip}
          tipRef={slopitectTipRef}
          tipLabel={controls.insights.tipLabel}
          onDismiss={onDismissSlopitectTip}
        />
      </div>
      {levelPanel}

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
