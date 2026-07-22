import ExampleDiagramPreview from '../../components/ExampleDiagramPreview.jsx';
import EntryDeskIntro from '../../components/EntryDeskIntro.jsx';
import { formatLocale } from '../../i18n/formatLocale.js';
import { EXAMPLE_TRY_PROMPT } from '../../utils/exampleDiagram.js';

/**
 * Empty-canvas guidance: sample preview + CTA in the canvas safe area above the
 * bottom chrome. Shown whenever the desk has no deliverable yet — first visit
 * and after Demolish — so users are not left staring at a blank grid.
 */
export function EmptyCanvasSlot({
  active,
  busy: _busy,
  copy,
  userName,
  onPickTopic,
  showEntryDeskIntro = false,
  entryIntroCopy = null,
  entryRole = 'Architect',
  entryTourCopy = null,
  onAdvanceEntryTour,
  onDismissEntryTour
}) {
  if (!active || !copy) return null;

  const starters = Array.isArray(copy.starters) ? copy.starters : [];
  const tryPrompt = starters[0]?.prompt ?? EXAMPLE_TRY_PROMPT;
  const introCopy = entryIntroCopy ?? copy.entryIntro;

  return (
    <div
      className={`empty-canvas-slot${showEntryDeskIntro ? ' empty-canvas-slot--desk-welcome' : ''}`}
      data-testid="empty-canvas-slot"
    >
      {showEntryDeskIntro && introCopy ? (
        <div className="entry-desk-welcome" data-testid="entry-desk-welcome">
          <EntryDeskIntro copy={introCopy} userName={userName} role={entryRole} />
          <div className="entry-desk-welcome-actions">
            <button
              type="button"
              className="overlay-button primary-button entry-desk-welcome-next"
              onClick={onAdvanceEntryTour}
            >
              {entryTourCopy?.next ?? 'Next'}
            </button>
            <button type="button" className="entry-desk-welcome-skip" onClick={onDismissEntryTour}>
              {entryTourCopy?.skip ?? 'Skip tour'}
            </button>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
