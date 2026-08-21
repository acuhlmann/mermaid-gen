import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Outer .bottom-chrome wrapper plus the unified bottom row: your desk. The
 * always-visible primaries (the Work Order and Your Team) share a baseline with
 * headless Outbox / Settings panels (opened from desk verbs) on the right.
 *
 * Slots:
 * - `actions`        — left side: the empty-state entry form OR the desk row
 *                       (Work Order · Your Team · Notebook). Run status moved
 *                       to the taskbar tray (`DeskOsTaskbar`).
 * - `aiControls`     — right side: AiCornerControlsInner (headless Outbox +
 *                       Settings panels — contractors & code; concentration is
 *                       in the desk menu footer).
 *
 * `narrowLayout` toggles mobile class hooks so the right cluster keeps the
 * existing inline-stacked settings panel layout instead of popover mode.
 *
 * `data-app-chrome` marks the band as external chrome the metaphor3d canvas
 * must stay clear of. The 3D canvas is full-bleed — `.diagram-output` runs the
 * whole viewport — so this band paints over the bottom 97px of a phone canvas
 * and the bottom 60px of a desktop one. Without the marker the metaphor's own
 * bottom-anchored panels (the layer key, the tap inspector, the guided read and
 * its Back/Next) are drawn underneath it, and the camera frames the subject
 * into pixels the composer covers. See overlaySafeArea.js.
 */
export function BottomRow({ actions, aiControls, narrowLayout }) {
  const { controls } = useUiCopy();
  const aiClass = narrowLayout ? 'bottom-row-ai is-narrow' : 'bottom-row-ai';
  return (
    <div className="corner-control bottom-chrome" data-app-chrome="bottom">
      <div className="bottom-row">
        <div className="bottom-row-actions">{actions}</div>
        <div className={aiClass} aria-label={controls.settings.aiCluster}>
          {aiControls}
        </div>
      </div>
    </div>
  );
}
