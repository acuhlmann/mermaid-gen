import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderMarkdown } from '@a2ui/markdown-it';
import { MessageProcessor } from '@a2ui/web_core/v0_9';
import { A2uiSurface, basicCatalog, MarkdownContext } from '@a2ui/react/v0_9';
import '@a2ui/react/styles';
import { A2UI_STYLE_EDITS_SURFACE_ID, ACTION_APPLY_STYLE_EDITS, type A2uiV09Message } from '@archislop/shared';

export default function StyleEditsA2uiSurface({
  messages,
  busy,
  onApply,
  onUnavailable
}: {
  messages?: A2uiV09Message[];
  busy?: boolean;
  onApply?: () => void;
  onUnavailable?: () => void;
}) {
  const callbacksRef = useRef({ onApply, busy });
  callbacksRef.current = { onApply, busy };

  const rootRef = useRef<HTMLDivElement>(null);
  const unavailableReportedRef = useRef(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processorRef = useRef<any>(null);
  if (!processorRef.current) {
    processorRef.current = new MessageProcessor([basicCatalog], async (action) => {
      const { busy: isBusy, onApply: apply } = callbacksRef.current;
      if (isBusy) return;
      if (action.name === ACTION_APPLY_STYLE_EDITS) {
        apply?.();
      }
    });
  }

  const [surfaces, setSurfaces] = useState<unknown[]>([]);

  useLayoutEffect(() => {
    const p = processorRef.current!;
    const sync = () => setSurfaces(Array.from(p.model.surfacesMap.values()));

    const subA = p.onSurfaceCreated(() => sync());
    const subB = p.onSurfaceDeleted(() => sync());

    const existing = p.model.getSurface(A2UI_STYLE_EDITS_SURFACE_ID);
    if (existing) {
      p.model.deleteSurface(A2UI_STYLE_EDITS_SURFACE_ID);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      if (!unavailableReportedRef.current) {
        unavailableReportedRef.current = true;
        onUnavailable?.();
      }
      return () => {
        subA.unsubscribe();
        subB.unsubscribe();
      };
    }

    try {
      p.processMessages(messages as never);
    } catch (err) {
      console.error('StyleEditsA2uiSurface: invalid A2UI messages', err);
    }
    sync();

    return () => {
      subA.unsubscribe();
      subB.unsubscribe();
    };
  }, [messages, onUnavailable]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const btn = [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Apply style tweaks'
    );
    if (btn) btn.disabled = Boolean(callbacksRef.current.busy);
  }, [surfaces, busy]);

  if (!Array.isArray(messages) || messages.length === 0 || !surfaces.length) {
    return null;
  }

  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <div
        className={`insights-style-edits-a2ui insights-a2ui-surface-root a2ui-surface${busy ? ' is-busy' : ''}`}
        ref={rootRef}
        data-testid="style-edits-a2ui"
      >
        {surfaces.map((surface) => (
          <A2uiSurface key={(surface as { id: string }).id} surface={surface as never} />
        ))}
      </div>
    </MarkdownContext.Provider>
  );
}
