import ActionBootSequence from './ActionBootSequence.jsx';
import StreakHud from './StreakHud.jsx';
import SlopitectCompanion from './SlopitectCompanion.jsx';
import LiveRunHud from './LiveRunHud.jsx';

const ANCHOR_CLASS = {
  viewport: 'is-anchor-viewport',
  canvas: 'is-anchor-canvas',
  insights: 'is-anchor-insights'
};

/**
 * Ephemeral run chrome: boot headline, XP toasts, mascot quotes, live pill.
 * App chooses the anchor so overlays stay on the visible canvas when Thinking
 * shares the screen, and on the Thinking pane when it is fullscreen.
 */
export default function RunCeremonyOverlays({
  anchor = 'viewport',
  bootSeq,
  toasts = [],
  achievement = null,
  levelUp = null,
  liveVariant = null,
  liveStreaming = false,
  showLiveRunHud = false,
  liveStreak = 0,
  /** When true, persona pop-ups (boot flash, mascot) stay off the Thinking pane. */
  insightsOpen = false
}) {
  const anchorClass = ANCHOR_CLASS[anchor] || ANCHOR_CLASS.viewport;
  const showPersonaCeremony = !insightsOpen;

  return (
    <div className={`run-ceremony-layer ${anchorClass}`.trim()} data-ceremony-anchor={anchor}>
      {showPersonaCeremony ? (
        <ActionBootSequence trigger={bootSeq?.trigger} variant={bootSeq?.variant} />
      ) : null}
      <StreakHud toasts={toasts} achievement={achievement} levelUp={levelUp} />
      {showPersonaCeremony ? (
        <SlopitectCompanion
          key={`companion-${bootSeq?.trigger ?? 0}`}
          variant={liveVariant}
          streaming={liveStreaming}
        />
      ) : null}
      <LiveRunHud
        key={`live-${bootSeq?.trigger ?? 0}`}
        variant={liveVariant}
        streaming={showLiveRunHud}
        streak={liveStreak}
      />
    </div>
  );
}
