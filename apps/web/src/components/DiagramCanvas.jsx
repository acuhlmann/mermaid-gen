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

function getPointers(map) {
  return Array.from(map.values());
}

function getCentroid(pointers) {
  const total = pointers.reduce(
    (sum, pointer) => ({
      x: sum.x + pointer.x,
      y: sum.y + pointer.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / pointers.length,
    y: total.y / pointers.length
  };
}

function getDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function configureEditorTheme(monaco) {
  monaco.editor.defineTheme('mermaidgen-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'E5EDF7', background: '0F172A' },
      { token: 'delimiter', foreground: '93C5FD' },
      { token: 'string', foreground: 'BAE6FD' },
      { token: 'number', foreground: 'C4B5FD' }
    ],
    colors: {
      'editor.background': '#0F172A',
      'editor.foreground': '#E5EDF7',
      'editorLineNumber.foreground': '#64748B',
      'editorLineNumber.activeForeground': '#CBD5E1',
      'editorCursor.foreground': '#F8FAFC',
      'editor.selectionBackground': '#1D4ED866',
      'editor.inactiveSelectionBackground': '#33415599',
      'editorIndentGuide.background1': '#334155',
      'editorIndentGuide.activeBackground1': '#64748B'
    }
  });
}

export default function DiagramCanvas({
  mermaidSource,
  styleConfig = DEFAULT_DIAGRAM_STYLE,
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
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ centroid: null, distance: null });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

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

  function clampScale(value) {
    return Math.min(4, Math.max(0.2, value));
  }

  function zoomAtPoint(pointX, pointY, scaleFactor) {
    setViewport((current) => {
      const nextScale = clampScale(current.scale * scaleFactor);
      if (nextScale === current.scale) {
        return current;
      }

      const worldX = (pointX - current.x) / current.scale;
      const worldY = (pointY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointX - worldX * nextScale,
        y: pointY - worldY * nextScale
      };
    });
  }

  function handleWheel(event) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);

    zoomAtPoint(pointerX, pointerY, zoomFactor);
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    pointersRef.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });

    const pointers = getPointers(pointersRef.current);
    gestureRef.current = {
      centroid: getCentroid(pointers),
      distance: pointers.length >= 2 ? getDistance(pointers[0], pointers[1]) : null
    };

    setIsPanning(true);
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    pointersRef.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });

    const pointers = getPointers(pointersRef.current);
    const nextCentroid = getCentroid(pointers);
    const previousCentroid = gestureRef.current.centroid ?? nextCentroid;
    const dx = nextCentroid.x - previousCentroid.x;
    const dy = nextCentroid.y - previousCentroid.y;

    if (pointers.length >= 2) {
      const nextDistance = getDistance(pointers[0], pointers[1]);
      const previousDistance = gestureRef.current.distance ?? nextDistance;
      const zoomFactor = previousDistance > 0 ? nextDistance / previousDistance : 1;

      setViewport((current) => {
        const panned = {
          ...current,
          x: current.x + dx,
          y: current.y + dy
        };
        const nextScale = clampScale(panned.scale * zoomFactor);
        const worldX = (nextCentroid.x - panned.x) / panned.scale;
        const worldY = (nextCentroid.y - panned.y) / panned.scale;

        return {
          scale: nextScale,
          x: nextCentroid.x - worldX * nextScale,
          y: nextCentroid.y - worldY * nextScale
        };
      });

      gestureRef.current = {
        centroid: nextCentroid,
        distance: nextDistance
      };
      return;
    }

    setViewport((current) => ({
      ...current,
      x: current.x + dx,
      y: current.y + dy
    }));

    gestureRef.current = {
      centroid: nextCentroid,
      distance: null
    };
  }

  function endPointerGesture(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const pointers = getPointers(pointersRef.current);
    if (pointers.length === 0) {
      gestureRef.current = { centroid: null, distance: null };
      setIsPanning(false);
      return;
    }

    gestureRef.current = {
      centroid: getCentroid(pointers),
      distance: pointers.length >= 2 ? getDistance(pointers[0], pointers[1]) : null
    };
  }

  return (
    <section className={`diagram-canvas ${editorOpen ? 'is-editor-open' : ''}`}>
      <div
        className={`diagram-output ${isPanning ? 'is-panning' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerGesture}
        onPointerCancel={endPointerGesture}
        aria-label="Mermaid renderer. Drag to pan. Pinch or wheel to zoom."
      >
        {streamingPreview ? <p className="streaming-note">Updating diagram...</p> : null}
        {displayedRenderError ? <p className="diagram-error">{displayedRenderError}</p> : null}
        <div
          className="diagram-viewport"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>

      {editorOpen ? (
        <aside className="diagram-editor-panel" aria-label="Mermaid code editor">
          {streamingPreview ? <p className="streaming-note">Streaming validated source...</p> : null}
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            theme="mermaidgen-dark"
            beforeMount={configureEditorTheme}
            value={editorSource}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: streamingPreview,
              fontSize: 13
            }}
          />
        </aside>
      ) : null}
    </section>
  );
}
