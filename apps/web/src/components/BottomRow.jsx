import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Outer .bottom-chrome wrapper plus the unified bottom row: the four left
 * action icons share a baseline with the right cluster (Settings, Thinking).
 *
 * Slots:
 * - `statusRow`      — optional, rendered above the row in flow (keeps
 *                       aria-live semantics; minor vertical shift acceptable).
 * - `promptPopover`  — optional, the SlopNextPrompt input. Caller supplies
 *                       it with the bottom-row-popover classes so it floats
 *                       upward into the canvas anchored to the Prompt button.
 * - `actions`        — left side: PromptControlForm (empty-state) OR the
 *                       prompt-actions icon row (Prompt, Render as,
 *                       Stakeholders, Mute, Fix, Clear).
 * - `aiControls`     — right side: AiCornerControlsInner (Settings + Thinking).
 *
 * `narrowLayout` toggles mobile class hooks so the right cluster keeps the
 * existing inline-stacked settings panel layout instead of popover mode.
 */
export function BottomRow({ statusRow, promptPopover, actions, aiControls, narrowLayout }) {
  const { controls } = useUiCopy();
  const aiClass = narrowLayout ? 'bottom-row-ai is-narrow' : 'bottom-row-ai';
  return (
    <div className="corner-control bottom-chrome">
      {statusRow}
      <div className="bottom-row">
        {promptPopover}
        <div className="bottom-row-actions">
          <div id="office-desk-bottom-slot" className="bottom-office-desk-slot" />
          {actions}
        </div>
        <div className={aiClass} aria-label={controls.settings.aiCluster}>
          {aiControls}
        </div>
      </div>
    </div>
  );
}
