import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
mermaid.initialize({ startOnLoad: false });

const TAP_MOVE_THRESHOLD_PX = 14;

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

function nodeTitleFromElement(nodeEl) {
  const parts = [];
  nodeEl.querySelectorAll('text').forEach((textEl) => {
    const t = textEl.textContent?.trim();
    if (t) parts.push(t);
  });
  const merged = parts.join(' · ');
  return merged.slice(0, 240);
}

export default function DiagramCanvas({
  mermaidSource,
  onManualEdit,
  onValidationChange,
  streamingPreview = false,
  editorOpen = false,
  insightsOpen = false,
  insightsSlot = null,
  selectedNode = null,
  onSelectedNodeChange,
  onNodeToolbarAnchor
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
  const viewportRef = useRef(null);
  const tapCandidateRef = useRef(null);
  const backgroundTapRef = useRef(null);

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

    if (!editorSource.trim()) {
      setSvgMarkup('');
      setRenderError('');
      reportValidation(editorSource, null);
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
            startOnLoad: false
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
  }, [editorSource, reportValidation, streamingPreview]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    root.querySelectorAll('g.node.is-diagram-selected').forEach((el) => el.classList.remove('is-diagram-selected'));
    if (!selectedNode?.id) return;
    try {
      const el = root.querySelector(`[id="${CSS.escape(selectedNode.id)}"]`);
      el?.classList.add('is-diagram-selected');
    } catch {
      // Invalid selector id — skip highlight.
    }
  }, [svgMarkup, selectedNode]);

  useLayoutEffect(() => {
    if (!onNodeToolbarAnchor) return;
    const root = viewportRef.current;
    if (!selectedNode?.id || !root) {
      onNodeToolbarAnchor(null);
      return;
    }
    try {
      const el = root.querySelector(`[id="${CSS.escape(selectedNode.id)}"]`);
      if (!el) {
        onNodeToolbarAnchor(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      onNodeToolbarAnchor({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 10
      });
    } catch {
      onNodeToolbarAnchor(null);
    }
  }, [selectedNode, onNodeToolbarAnchor, svgMarkup, viewport]);

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

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    const nodeEl = event.target?.closest?.('g.node');

    event.preventDefault();

    pointersRef.current.set(event.pointerId, {
      x: localX,
      y: localY
    });

    const pointers = getPointers(pointersRef.current);
    gestureRef.current = {
      centroid: getCentroid(pointers),
      distance: pointers.length >= 2 ? getDistance(pointers[0], pointers[1]) : null
    };

    if (nodeEl && pointers.length === 1) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        nodeEl
      };
    } else {
      tapCandidateRef.current = null;
    }

    if (pointers.length === 1 && !nodeEl) {
      backgroundTapRef.current = {
        pointerId: event.pointerId,
        sx: event.clientX,
        sy: event.clientY
      };
    } else {
      backgroundTapRef.current = null;
    }

    setIsPanning(true);
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event) {
    const tap = tapCandidateRef.current;
    if (tap && tap.pointerId === event.pointerId) {
      event.preventDefault();
      const moved = Math.hypot(event.clientX - tap.startClientX, event.clientY - tap.startClientY);
      if (moved <= TAP_MOVE_THRESHOLD_PX) {
        return;
      }
      tapCandidateRef.current = null;
    }

    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();

    const bgTap = backgroundTapRef.current;
    if (bgTap && bgTap.pointerId === event.pointerId) {
      const movedBg = Math.hypot(event.clientX - bgTap.sx, event.clientY - bgTap.sy);
      if (movedBg > TAP_MOVE_THRESHOLD_PX) {
        backgroundTapRef.current = null;
      }
    }

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
    const tap = tapCandidateRef.current;
    if (tap && tap.pointerId === event.pointerId) {
      event.preventDefault();
      const moved = Math.hypot(event.clientX - tap.startClientX, event.clientY - tap.startClientY);
      tapCandidateRef.current = null;
      pointersRef.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const remaining = getPointers(pointersRef.current);
      if (remaining.length === 0) {
        gestureRef.current = { centroid: null, distance: null };
        setIsPanning(false);
      } else {
        gestureRef.current = {
          centroid: getCentroid(remaining),
          distance: remaining.length >= 2 ? getDistance(remaining[0], remaining[1]) : null
        };
      }
      if (moved <= TAP_MOVE_THRESHOLD_PX && tap.nodeEl?.id && onSelectedNodeChange) {
        const label = nodeTitleFromElement(tap.nodeEl);
        onSelectedNodeChange({ id: tap.nodeEl.id, label });
      }
      return;
    }

    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const pointers = getPointers(pointersRef.current);
    if (pointers.length === 0) {
      gestureRef.current = { centroid: null, distance: null };
      setIsPanning(false);

      const bgTap = backgroundTapRef.current;
      if (
        bgTap &&
        bgTap.pointerId === event.pointerId &&
        onSelectedNodeChange &&
        !event.target?.closest?.('g.node')
      ) {
        const movedBg = Math.hypot(event.clientX - bgTap.sx, event.clientY - bgTap.sy);
        if (movedBg <= TAP_MOVE_THRESHOLD_PX) {
          onSelectedNodeChange(null);
        }
      }
      backgroundTapRef.current = null;

      return;
    }

    gestureRef.current = {
      centroid: getCentroid(pointers),
      distance: pointers.length >= 2 ? getDistance(pointers[0], pointers[1]) : null
    };
  }

  const shellClass = [
    'diagram-canvas',
    editorOpen ? 'is-editor-open' : '',
    insightsOpen && insightsSlot ? 'is-insights-open' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={shellClass}>
      <div className="diagram-main-column">
        <div
          className={`diagram-output ${isPanning ? 'is-panning' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerGesture}
          onPointerCancel={endPointerGesture}
          aria-label="Mermaid renderer. Drag to pan from anywhere including nodes. Pinch or wheel to zoom. Tap a node to select."
        >
          {streamingPreview ? <p className="streaming-note">Updating diagram...</p> : null}
          {displayedRenderError ? <p className="diagram-error">{displayedRenderError}</p> : null}
          <div
            ref={viewportRef}
            className="diagram-viewport"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </div>
      </div>

      {insightsSlot}

      {editorOpen ? (
        <aside className="diagram-editor-panel" aria-label="Mermaid code editor">
          {streamingPreview ? <p className="streaming-note">Streaming validated source...</p> : null}
          <div className="diagram-monaco-wrap">
            <Editor
              height="100%"
              defaultLanguage="plaintext"
              theme="vs-dark"
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
          </div>
        </aside>
      ) : null}
    </section>
  );
}
