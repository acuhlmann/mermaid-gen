import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Outer .bottom-chrome wrapper plus the unified bottom row: your desk. The
 * always-visible primaries (the Work Order and Your Team) share a baseline with
 * headless Outbox / Settings panels (opened from desk verbs) on the right.
 *
 * Slots:
 * - `statusRow`      — optional, rendered above the row in flow (keeps
 *                       aria-live semantics; minor vertical shift acceptable).
 * - `actions`        — left side: the empty-state entry form OR the desk row
 *                       (Work Order · Your Team + Headphones · Desk tray).
 * - `aiControls`     — right side: AiCornerControlsInner (headless Outbox +
 *                       Settings panels — contractors & code; concentration is
 *                       in the desk menu footer).
 *
 * `narrowLayout` toggles mobile class hooks so the right cluster keeps the
 * existing inline-stacked settings panel layout instead of popover mode.
 */
export function BottomRow({ statusRow, actions, aiControls, narrowLayout }) {
  const { controls } = useUiCopy();
  const aiClass = narrowLayout ? 'bottom-row-ai is-narrow' : 'bottom-row-ai';
  return (
    <div className="corner-control bottom-chrome">
      {statusRow}
      <div className="bottom-row">
        <div className="bottom-row-actions">{actions}</div>
        <div className={aiClass} aria-label={controls.settings.aiCluster}>
          {aiControls}
        </div>
      </div>
    </div>
  );
}
