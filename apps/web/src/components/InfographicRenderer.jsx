import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Infographic, parseSyntax } from '@antv/infographic';

function InfographicRendererImpl(
  { diagramSource, selectedNode = null, streamingPreview = false },
  ref
) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const lastSourceRef = useRef(null);
  const lastSelectedElRef = useRef(null);
  const [renderError, setRenderError] = useState('');

  // Expose the inner content host so DiagramCanvas's gesture surface can scope
  // tap-target lookups to "inside the infographic" and so the toolbar anchor
  // effect can verify a selected element is still attached.
  useImperativeHandle(ref, () => ({ getContainer: () => containerRef.current }), []);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    if (streamingPreview) {
      return undefined;
    }
    const dsl = (diagramSource ?? '').trim();
    if (!dsl) {
      setRenderError('');
      containerRef.current.innerHTML = '';
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
      lastSourceRef.current = '';
      return undefined;
    }

    if (lastSourceRef.current === dsl && instanceRef.current) {
      return undefined;
    }

    if (instanceRef.current) {
      try { instanceRef.current.destroy(); } catch { /* noop */ }
      instanceRef.current = null;
    }
    containerRef.current.innerHTML = '';

    try {
      const parsed = parseSyntax(dsl);
      if (parsed?.errors?.length) {
        const head = parsed.errors.slice(0, 3).map((e) => e.message).join(' · ');
        setRenderError(`Infographic DSL parse error: ${head}`);
        return undefined;
      }
    } catch {
      // parseSyntax should never throw; fall through to render attempt.
    }

    try {
      const inst = new Infographic({
        container: containerRef.current,
        width: '100%',
        height: '100%',
        editable: false
      });
      inst.render(dsl);
      instanceRef.current = inst;
      lastSourceRef.current = dsl;
      setRenderError('');
      requestAnimationFrame(() => {
        if (containerRef.current && containerRef.current.querySelectorAll('svg').length === 0) {
          setRenderError('Infographic produced no visible output. Try a different template or simplify the data.');
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setRenderError(`Infographic render failed: ${msg}`);
    }
    return undefined;
  }, [diagramSource, streamingPreview]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
  }, []);

  // Visual selection ring: outline the most recently clicked DOM node, but only if
  // the node still belongs to the current render (a re-render destroys references).
  useEffect(() => {
    if (lastSelectedElRef.current) {
      lastSelectedElRef.current.classList?.remove('is-infographic-selected');
      lastSelectedElRef.current.style.outline = '';
      lastSelectedElRef.current.style.outlineOffset = '';
      lastSelectedElRef.current = null;
    }
    const el = selectedNode?.domNode;
    if (el && containerRef.current?.contains(el)) {
      el.classList?.add('is-infographic-selected');
      el.style.outline = '2px solid #58cc02';
      el.style.outlineOffset = '2px';
      lastSelectedElRef.current = el;
    }
  }, [selectedNode]);

  return (
    <div className="infographic-output" style={{ width: '100%', height: '100%' }}>
      {renderError ? <p className="diagram-error">{renderError}</p> : null}
      <div
        ref={containerRef}
        className="infographic-canvas"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

const InfographicRenderer = forwardRef(InfographicRendererImpl);
export default InfographicRenderer;
