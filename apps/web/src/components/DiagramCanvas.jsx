import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import { DEFAULT_DIAGRAM_STYLE, styleConfigToMermaidConfig } from '@mermaid-architect/shared';

mermaid.initialize({ startOnLoad: false, ...styleConfigToMermaidConfig(DEFAULT_DIAGRAM_STYLE) });

function extractErrorMessage(error) {
  if (!error) return 'Unknown Mermaid error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'Mermaid render failed';
}

function touchDistance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function touchMidpoint(a, b) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2
  };
}

function clampScale(value) {
  return Math.min(4, Math.max(0.2, value));
}

/** Pan/zoom surface; `key={revisionId}` from parent resets transform when the diagram revision changes. */
function DiagramInteractiveViewport({ svgMarkup, streamingPreview, displayedRenderError, editorOpen }) {
  const outputRef = useRef(null);
  const pinchRef = useRef(null);
  const singleTouchPanRef = useRef(null);
  const dragStateRef = useRef({ active: false, pointerId: null, x: 0, y: 0 });
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  function zoomAtPoint(pointerX, pointerY, zoomFactor, rect) {
    const localX = pointerX - rect.left;
    const localY = pointerY - rect.top;
    setViewport((current) => {
      const nextScale = clampScale(current.scale * zoomFactor);
      if (nextScale === current.scale) {
        return current;
      }
      const worldX = (localX - current.x) / current.scale;
      const worldY = (localY - current.y) / current.scale;
      const next = {
        scale: nextScale,
        x: localX - worldX * nextScale,
        y: localY - worldY * nextScale
      };
      viewportRef.current = next;
      return next;
    });
  }

  function handleWheel(event) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    zoomAtPoint(event.clientX, event.clientY, zoomFactor, rect);
  }

  useEffect(() => {
    const el = outputRef.current;
    if (!el) return undefined;

    function onTouchStart(event) {
      if (event.touches.length === 2) {
        singleTouchPanRef.current = null;
        const [a, b] = [event.touches[0], event.touches[1]];
        const d0 = touchDistance(a, b);
        if (d0 < 1) return;
        const mid = touchMidpoint(a, b);
        const rect = el.getBoundingClientRect();
        pinchRef.current = {
          d0,
          rect,
          localMidX: mid.x - rect.left,
          localMidY: mid.y - rect.top,
          viewport0: { ...viewportRef.current }
        };
        dragStateRef.current = { active: false, pointerId: null, x: 0, y: 0 };
        setIsPanning(false);
        event.preventDefault();
        return;
      }

      if (event.touches.length === 1) {
        pinchRef.current = null;
        const t = event.touches[0];
        singleTouchPanRef.current = {
          id: t.identifier,
          x: t.clientX,
          y: t.clientY
        };
      }
    }

    function onTouchMove(event) {
      if (event.touches.length === 2 && pinchRef.current) {
        const pinch = pinchRef.current;
        const [a, b] = [event.touches[0], event.touches[1]];
        const d = touchDistance(a, b);
        if (d < 1 || pinch.d0 < 1) return;

        const { localMidX, localMidY, viewport0 } = pinch;
        const nextScale = clampScale((viewport0.scale * d) / pinch.d0);
        if (nextScale === viewport0.scale) {
          event.preventDefault();
          return;
        }

        const worldX = (localMidX - viewport0.x) / viewport0.scale;
        const worldY = (localMidY - viewport0.y) / viewport0.scale;
        const next = {
          scale: nextScale,
          x: localMidX - worldX * nextScale,
          y: localMidY - worldY * nextScale
        };
        viewportRef.current = next;
        setViewport(next);
        event.preventDefault();
        return;
      }

      if (event.touches.length === 1 && singleTouchPanRef.current && !pinchRef.current) {
        const t = event.touches[0];
        const st = singleTouchPanRef.current;
        if (t.identifier !== st.id) return;
        const dx = t.clientX - st.x;
        const dy = t.clientY - st.y;
        singleTouchPanRef.current = { ...st, x: t.clientX, y: t.clientY };
        setViewport((current) => {
          const next = {
            ...current,
            x: current.x + dx,
            y: current.y + dy
          };
          viewportRef.current = next;
          return next;
        });
        event.preventDefault();
      }
    }

    function onTouchEnd(event) {
      if (event.touches.length < 2) {
        pinchRef.current = null;
      }
      if (event.touches.length === 0) {
        singleTouchPanRef.current = null;
      } else if (singleTouchPanRef.current) {
        const t = event.touches[0];
        singleTouchPanRef.current = { ...singleTouchPanRef.current, id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [editorOpen]);

  function handlePointerDown(event) {
    if (event.pointerType === 'touch') return;
    if (event.button !== 0) return;
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    dragStateRef.current = {
      ...dragState,
      x: event.clientX,
      y: event.clientY
    };

    setViewport((current) => {
      const next = {
        ...current,
        x: current.x + dx,
        y: current.y + dy
      };
      viewportRef.current = next;
      return next;
    });
  }

  function endPointerPan(event) {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = { active: false, pointerId: null, x: 0, y: 0 };
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="diagram-output-wrap">
      {streamingPreview ? <p className="diagram-streaming-banner">Applying update…</p> : null}
      {displayedRenderError ? <p className="diagram-error-banner">{displayedRenderError}</p> : null}
      <div
        ref={outputRef}
        className={`diagram-output ${isPanning ? 'is-panning' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerPan}
        onPointerCancel={endPointerPan}
      >
        <div
          className="diagram-viewport"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>
    </div>
  );
}

export default function DiagramCanvas({
  mermaidSource,
  styleConfig = DEFAULT_DIAGRAM_STYLE,
  revisionId,
  onManualEdit,
  onValidationChange,
  streamingPreview = false,
  editorOpen = false
}) {
  const [editorSource, setEditorSource] = useState(mermaidSource);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [renderError, setRenderError] = useState('');
  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  const lastAppliedSourceRef = useRef(mermaidSource);
  const lastReportedValidationRef = useRef({ source: null, error: null });

  const reportValidation = useCallback(
    (source, error) => {
      if (!onValidationChange) return;
      const previous = lastReportedValidationRef.current;
      if (previous.source === source && previous.error === error) {
        return;
      }
      lastReportedValidationRef.current = { source, error };
      onValidationChange({ source, error });
    },
    [onValidationChange]
  );

  useEffect(() => {
    if (mermaidSource === lastAppliedSourceRef.current) {
      return;
    }

    lastAppliedSourceRef.current = mermaidSource;
    setEditorSource(mermaidSource);
  }, [mermaidSource]);

  useEffect(() => {
    let cancelled = false;

    if (streamingPreview) {
      return undefined;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      async function runRender() {
        try {
          const diagramId = `diagram-${requestId}`;
          mermaid.initialize({
            startOnLoad: false,
            ...styleConfigToMermaidConfig(styleConfig)
          });
          const { svg } = await mermaid.render(diagramId, editorSource);
          if (cancelled || requestRef.current !== requestId) {
            return;
          }

          setSvgMarkup(svg);
          setRenderError('');
          reportValidation(editorSource, null);
        } catch (error) {
          if (cancelled || requestRef.current !== requestId) {
            return;
          }
          const message = extractErrorMessage(error);
          setRenderError(message);
          reportValidation(editorSource, message);
        }
      }

      runRender();
    }, 200);

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [editorSource, reportValidation, streamingPreview, styleConfig]);

  const displayedRenderError = streamingPreview ? '' : renderError;

  function handleEditorChange(value) {
    const nextValue = value ?? '';
    setEditorSource(nextValue);
    lastAppliedSourceRef.current = nextValue;
    if (onManualEdit) {
      onManualEdit(nextValue);
    }
  }

  const viewport = (
    <DiagramInteractiveViewport
      key={revisionId}
      svgMarkup={svgMarkup}
      streamingPreview={streamingPreview}
      displayedRenderError={displayedRenderError}
      editorOpen={editorOpen}
    />
  );

  if (!editorOpen) {
    return <div className="diagram-stage diagram-stage-full">{viewport}</div>;
  }

  return (
    <div className="diagram-stage diagram-stage-split">
      <div className="diagram-split-pane diagram-split-pane-preview">{viewport}</div>
      <div className="diagram-split-pane diagram-split-pane-editor">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          value={editorSource}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: streamingPreview,
            fontSize: 13,
            ariaLabel: 'Mermaid DSL'
          }}
        />
      </div>
    </div>
  );
}
