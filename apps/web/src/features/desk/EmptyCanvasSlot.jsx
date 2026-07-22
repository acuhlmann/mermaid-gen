import ExampleDiagramPreview from '../../components/ExampleDiagramPreview.jsx';
import { formatLocale } from '../../i18n/formatLocale.js';
import { EXAMPLE_TRY_PROMPT } from '../../utils/exampleDiagram.js';

/**
 * Empty-canvas guidance: sample preview + CTA in the canvas safe area above the
 * bottom chrome. Shown whenever the desk has no deliverable yet — first visit
 * and after Demolish — so users are not left staring at a blank grid.
 */
export function EmptyCanvasSlot({ active, busy, copy, userName, onPickTopic }) {
  if (!active || !copy) return null;

  const starters = Array.isArray(copy.starters) ? copy.starters : [];
  const tryPrompt = starters[0]?.prompt ?? EXAMPLE_TRY_PROMPT;

  return (
    <div className="empty-canvas-slot" data-testid="empty-canvas-slot">
      <ExampleDiagramPreview
        active={active}
        source={copy.exampleDiagramSource}
        eyebrow={copy.exampleEyebrow}
        headline={formatLocale(copy.exampleHeadline, { name: userName })}
        role={copy.exampleRole}
        body={copy.exampleBody}
        topicLabel={copy.exampleTopic}
        ariaLabel={copy.exampleAria}
        ctaLabel={copy.exampleCta}
        onTry={() => onPickTopic?.(tryPrompt)}
      />
    </div>
  );
}
