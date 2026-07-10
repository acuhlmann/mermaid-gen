import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderMarkdown } from '@a2ui/markdown-it';
import { MessageProcessor } from '@a2ui/web_core/v0_9';
import { A2uiSurface, basicCatalog, MarkdownContext } from '@a2ui/react/v0_9';
import '@a2ui/react/styles';
import { A2UI_CRITIQUE_SURFACE_ID } from '@archislop/shared';

function readCheckboxMask(root) {
  if (!root) return [];
  return [...root.querySelectorAll('input[type="checkbox"]')].map((el) => el.checked);
}

function findFixSelectedButton(root) {
  if (!root) return null;
  return (
    [...root.querySelectorAll('button')].find(
      (btn) => btn.textContent?.trim() === 'Fix selected'
    ) ?? null
  );
}

/**
 * Renders critique "Fix selected / Fix all" using A2UI v0.9 + basic catalog only.
 * Messages are produced server-side from the same critique markdown.
 */
export default function CritiqueA2uiSurface({
  messages,
  busy,
  onFixAll,
  onFixSelected,
  onUnavailable
}) {
  const callbacksRef = useRef({ onFixAll, onFixSelected, busy });
  callbacksRef.current = { onFixAll, onFixSelected, busy };

  const rootRef = useRef(null);
  const unavailableReportedRef = useRef(false);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const processorRef = useRef(null);
  if (!processorRef.current) {
    processorRef.current = new MessageProcessor([basicCatalog], async (action) => {
      const { busy: isBusy, onFixAll: fixAll, onFixSelected: fixSelected } = callbacksRef.current;
      if (isBusy) return;
      const p = processorRef.current;
      const surface = p?.model.getSurface(A2UI_CRITIQUE_SURFACE_ID);
      const checks = surface?.dataModel?.get('/checks');
      const mask = Array.isArray(checks) ? checks.map((c) => Boolean(c?.value)) : [];
      if (action.name === 'archislop_fixAll') {
        fixAll?.();
        return;
      }
      if (action.name === 'archislop_fixSelected') {
        if (!mask.some(Boolean)) return;
        fixSelected?.(mask);
      }
    });
  }

  const [surfaces, setSurfaces] = useState([]);

  const syncFixSelectedDisabled = useCallback(() => {
    const root = rootRef.current;
    const fixSelectedBtn = findFixSelectedButton(root);
    if (!fixSelectedBtn) return;
    const mask = readCheckboxMask(root);
    const anySelected = mask.some(Boolean);
    const isBusy = callbacksRef.current.busy;
    fixSelectedBtn.disabled = isBusy || !anySelected;
  }, []);

  useLayoutEffect(() => {
    const p = processorRef.current;
    const sync = () => setSurfaces(Array.from(p.model.surfacesMap.values()));

    const subA = p.onSurfaceCreated(() => sync());
    const subB = p.onSurfaceDeleted(() => sync());

    const existing = p.model.getSurface(A2UI_CRITIQUE_SURFACE_ID);
    if (existing) {
      p.model.deleteSurface(A2UI_CRITIQUE_SURFACE_ID);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      if (!unavailableReportedRef.current) {
        unavailableReportedRef.current = true;
        onUnavailableRef.current?.();
      }
      return () => {
        subA.unsubscribe();
        subB.unsubscribe();
      };
    }

    try {
      p.processMessages(messages);
    } catch (err) {
      console.error('CritiqueA2uiSurface: invalid A2UI messages', err);
    }
    sync();
    if (p.model.surfacesMap.size === 0) {
      if (!unavailableReportedRef.current) {
        unavailableReportedRef.current = true;
        onUnavailableRef.current?.();
      }
    }

    return () => {
      subA.unsubscribe();
      subB.unsubscribe();
    };
  }, [messages]);

  useEffect(() => {
    syncFixSelectedDisabled();
  }, [surfaces, busy, syncFixSelectedDisabled]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const onCheckboxChange = () => syncFixSelectedDisabled();
    root.addEventListener('change', onCheckboxChange);
    return () => root.removeEventListener('change', onCheckboxChange);
  }, [surfaces, syncFixSelectedDisabled]);

  if (!Array.isArray(messages) || messages.length === 0 || !surfaces.length) {
    return null;
  }

  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <section
        className="insights-a2ui-block insights-prose-section insights-tone-actionable"
        aria-label="Actionable improvements"
      >
        <div
          ref={rootRef}
          className={`insights-a2ui-surface-root a2ui-surface a2ui-light${busy ? ' is-busy' : ''}`}
        >
          {surfaces.map((surface) => (
            <A2uiSurface key={surface.id} surface={surface} />
          ))}
        </div>
      </section>
    </MarkdownContext.Provider>
  );
}
