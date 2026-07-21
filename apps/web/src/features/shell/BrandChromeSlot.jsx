import DiagramFullscreenButton from '../../components/DiagramFullscreenButton.jsx';
import { ArchiSlopMarkIcon } from '../../components/AppIcons.jsx';
import XpProgressBar from '../../components/XpProgressBar.jsx';
import LevelUpInfoPanel from '../../components/LevelUpInfoPanel.jsx';
import { TopShell } from '../../components/TopShell.jsx';
import { SlopitectTipSlot } from '../prompt/SlopitectTipSlot.jsx';
import { resolveUserName } from '../../state/userIdentityStore.js';

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
  return (
    <TopShell>
      <div
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
        {xpInfoPanelOpen && gamification?.level ? (
          <div
            id="levelup-info-panel"
            className="levelup-info-panel-mount"
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
          </div>
        ) : null}
        <SlopitectTipSlot
          tip={slopitectTip}
          tipRef={slopitectTipRef}
          tipLabel={controls.insights.tipLabel}
          onDismiss={onDismissSlopitectTip}
        />
      </div>

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
