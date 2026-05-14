import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageProcessor } from '@a2ui/web_core/v0_9';
import { A2uiSurface, basicCatalog } from '@a2ui/react/v0_9';
import { A2UI_CRITIQUE_SURFACE_ID } from '@archislop/shared';

/**
 * Renders critique "Fix selected / Fix all" using A2UI v0.9 + basic catalog only.
 * Messages are produced server-side from the same markdown as the streamed critique.
 */
export default function CritiqueA2uiSurface({ messages, busy, onFixAll, onFixSelected }) {
  const callbacksRef = useRef({ onFixAll, onFixSelected, busy });
  callbacksRef.current = { onFixAll, onFixSelected, busy };

  const processor = useMemo(() => {
    const p = new MessageProcessor([basicCatalog], async (action) => {
      const { busy: isBusy, onFixAll: fixAll, onFixSelected: fixSelected } = callbacksRef.current;
      if (isBusy) return;
      const surface = p.model.getSurface(A2UI_CRITIQUE_SURFACE_ID);
      const checks = surface?.dataModel?.get('/checks');
      const mask = Array.isArray(checks) ? checks.map((c) => Boolean(c?.value)) : [];
      if (action.name === 'archislop_fixAll') {
        fixAll?.();
        return;
      }
      if (action.name === 'archislop_fixSelected') {
        fixSelected?.(mask);
      }
    });

    try {
      p.processMessages(messages);
    } catch (err) {
      console.error('CritiqueA2uiSurface: invalid A2UI messages', err);
    }
    return p;
  }, [messages]);

  const [surfaces, setSurfaces] = useState([]);

  useEffect(() => {
    const p = processor;
    const sync = () => setSurfaces(Array.from(p.model.surfacesMap.values()));
    sync();
    const subA = p.onSurfaceCreated(() => sync());
    const subB = p.onSurfaceDeleted(() => sync());
    return () => {
      subA.unsubscribe();
      subB.unsubscribe();
      if (p.model.getSurface(A2UI_CRITIQUE_SURFACE_ID)) {
        p.model.deleteSurface(A2UI_CRITIQUE_SURFACE_ID);
      }
    };
  }, [processor]);

  return (
    <section className="insights-a2ui-block" aria-label="Actionable improvements">
      <p className="insights-a2ui-caption">Pick fixes, then apply</p>
      <div className={`insights-a2ui-surface-root${busy ? ' is-busy' : ''}`}>
        {surfaces.map((surface) => (
          <A2uiSurface key={surface.id} surface={surface} />
        ))}
      </div>
    </section>
  );
}
