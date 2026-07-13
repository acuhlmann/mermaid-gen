import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from '@a2ui/markdown-it';
import { MessageProcessor } from '@a2ui/web_core/v0_9';
import { A2uiSurface, basicCatalog, MarkdownContext } from '@a2ui/react/v0_9';
import '@a2ui/react/styles';
import { buildFormsSeedDoc, FORMS_A2UI_SURFACE_ID, parseFormsA2ui } from '@archislop/shared';
import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Renders Forms-mode content: a **model-authored** A2UI v0.9 document, live and
 * interactive, via `@a2ui/react` + the allowlisted `basicCatalog`. This is the
 * deliberate opposite of `CritiqueA2uiSurface`, where the server builds A2UI
 * from Markdown — here the agent wrote the UI JSON, and `parseFormsA2ui` (shared)
 * already validated it against the catalog/component/action allowlists before it
 * reached the slot.
 *
 * The user fills the controls in place. Any Button collapses to a single
 * capability: capture the current answers and ask the agent for the NEXT form
 * (`onFormSubmit`). No button can route anywhere else — that is the whole
 * trust model for letting the model draw the UI.
 *
 * When the slot is empty, the seed form (`buildFormsSeedDoc`) is shown so the
 * gauntlet is interactive from the first paint.
 */
function FormsErrorState({ error }) {
  const { controls } = useUiCopy();
  return (
    <div className="forms-error-state" role="alert">
      <p>{controls.errors?.formFailed ?? 'This form could not be rendered.'}</p>
      <pre className="forms-error-detail">{error}</pre>
    </div>
  );
}

/** Map each bound field path (e.g. "name") to its human label, for a readable submission summary. */
function collectFieldLabels(components) {
  const labels = {};
  for (const c of components) {
    const path = c?.value?.path;
    if (typeof path === 'string' && typeof c?.label === 'string') {
      labels[path.replace(/^\//, '')] = c.label;
    }
  }
  return labels;
}

/** Find the label of the Button whose action fired, for the next-form prompt. */
function findButtonLabel(components, actionName) {
  const byId = new Map(components.map((c) => [c.id, c]));
  for (const c of components) {
    if (c?.component !== 'Button') continue;
    if (c?.action?.event?.name !== actionName) continue;
    const child = byId.get(c.child);
    if (child && typeof child.text === 'string') return child.text;
  }
  return null;
}

function flattenComponents(messages) {
  const components = [];
  for (const msg of messages) {
    const list = msg?.updateComponents?.components;
    if (Array.isArray(list)) components.push(...list);
  }
  return components;
}

export default function FormsRenderer({
  diagramSource,
  streamingPreview = false,
  busy = false,
  onFormSubmit
}) {
  const { controls } = useUiCopy();

  const parsed = useMemo(() => {
    const source = diagramSource && diagramSource.trim() ? diagramSource : buildFormsSeedDoc();
    const result = parseFormsA2ui(source);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, doc: result.doc };
  }, [diagramSource]);

  // Live refs so the (stable) action handler always sees the current form + guards.
  const stateRef = useRef({ parsed, busy, streamingPreview, onFormSubmit });
  stateRef.current = { parsed, busy, streamingPreview, onFormSubmit };

  const processorRef = useRef(null);
  if (!processorRef.current) {
    processorRef.current = new MessageProcessor([basicCatalog], async (action) => {
      const current = stateRef.current;
      if (current.busy || current.streamingPreview) return;
      if (!current.parsed.ok) return;
      const p = processorRef.current;
      const surface = p?.model.getSurface(FORMS_A2UI_SURFACE_ID);
      let values = {};
      try {
        const root = surface?.dataModel?.get('/');
        if (root && typeof root === 'object') values = root;
      } catch {
        values = {};
      }
      const components = flattenComponents(current.parsed.doc.messages);
      const labelMap = collectFieldLabels(components);
      const answers = Object.entries(values).map(([key, value]) => ({
        label: labelMap[key] ?? key,
        value
      }));
      current.onFormSubmit?.({
        formTitle: current.parsed.doc.formTitle,
        formCode: current.parsed.doc.formCode ?? null,
        buttonLabel: findButtonLabel(components, action.name),
        actionName: action.name,
        answers
      });
    });
  }

  const [surfaces, setSurfaces] = useState([]);

  useLayoutEffect(() => {
    const p = processorRef.current;
    const sync = () => setSurfaces(Array.from(p.model.surfacesMap.values()));
    const subA = p.onSurfaceCreated(() => sync());
    const subB = p.onSurfaceDeleted(() => sync());

    const existing = p.model.getSurface(FORMS_A2UI_SURFACE_ID);
    if (existing) p.model.deleteSurface(FORMS_A2UI_SURFACE_ID);

    if (parsed.ok) {
      try {
        p.processMessages(parsed.doc.messages);
      } catch (err) {
        // Validation already ran server-side; a runtime processing error here is rare.
        console.error('FormsRenderer: A2UI processing failed', err);
      }
      sync();
    }

    return () => {
      subA.unsubscribe();
      subB.unsubscribe();
    };
  }, [parsed]);

  if (!parsed.ok) {
    return <FormsErrorState error={parsed.error ?? 'Invalid form.'} />;
  }

  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <div className={`forms-renderer-root${busy || streamingPreview ? ' is-busy' : ''}`}>
        <div
          className="forms-a2ui-surface-root a2ui-surface a2ui-light"
          aria-label={controls.contentModes?.forms ?? 'Forms'}
        >
          {surfaces.map((surface) => (
            <A2uiSurface key={surface.id} surface={surface} />
          ))}
        </div>
      </div>
    </MarkdownContext.Provider>
  );
}
