import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Infographic, parseSyntax } from '@antv/infographic';

const STREAMING_RENDER_THROTTLE_MS = 90;

function InfographicRendererImpl(
  { diagramSource, selectedNode = null, streamingPreview = false },
  ref
) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const lastSourceRef = useRef(null);
  const lastSelectedElRef = useRef(null);
  const streamingFrameRef = useRef(0);
  const streamingTimeoutRef = useRef(0);
  const lastStreamingRenderRef = useRef(0);
  const [renderError, setRenderError] = useState('');

  useImperativeHandle(ref, () => ({ getContainer: () => containerRef.current }), []);

  // Streaming preview path: tolerate partial DSL, throttle render to keep
  // CPU bounded on fast token streams. We never surface parse errors here —
  // we just hold the last good frame until valid DSL arrives.
  useEffect(() => {
    if (!streamingPreview) return undefined;
    if (!containerRef.current) return undefined;
    const dsl = (diagramSource ?? '').trim();
    if (!dsl) return undefined;
    if (lastSourceRef.current === dsl) return undefined;

    const renderPartial = () => {
      lastStreamingRenderRef.current = Date.now();
      if (!containerRef.current) return;
      try {
        const parsed = parseSyntax(dsl);
        // Allow up to a handful of in-progress errors — the partial DSL almost
        // always has a dangling token at the tail until the next chunk arrives.
        if (parsed?.errors && parsed.errors.length > 3) return;
        if (!instanceRef.current) {
          instanceRef.current = new Infographic({
            container: containerRef.current,
            width: '100%',
            height: '100%',
            editable: false
          });
        }
        instanceRef.current.render(dsl);
        lastSourceRef.current = dsl;
        setRenderError('');
      } catch {
        // Hold last good frame on transient errors.
      }
    };

    cancelAnimationFrame(streamingFrameRef.current);
    clearTimeout(streamingTimeoutRef.current);
    const sinceLast = Date.now() - lastStreamingRenderRef.current;
    if (sinceLast >= STREAMING_RENDER_THROTTLE_MS) {
      streamingFrameRef.current = requestAnimationFrame(renderPartial);
    } else {
      streamingTimeoutRef.current = setTimeout(() => {
        streamingFrameRef.current = requestAnimationFrame(renderPartial);
      }, STREAMING_RENDER_THROTTLE_MS - sinceLast);
    }

    return () => {
      cancelAnimationFrame(streamingFrameRef.current);
      clearTimeout(streamingTimeoutRef.current);
    };
  }, [diagramSource, streamingPreview]);

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
    <div
      className={`infographic-output${streamingPreview ? ' is-streaming-preview' : ''}`}
      style={{ width: '100%', height: '100%' }}
    >
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
