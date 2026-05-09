import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

function extractErrorMessage(error) {
  if (!error) return 'Unknown Mermaid error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'Mermaid render failed';
}

export default function DiagramCanvas({
  mermaidSource,
  revisionId,
  onManualEdit,
  onValidationChange,
  streamingPreview = false
}) {
  const [editorSource, setEditorSource] = useState(mermaidSource);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [renderError, setRenderError] = useState('');
  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  const lastAppliedSourceRef = useRef(mermaidSource);
  const lastReportedValidationRef = useRef({ source: null, error: null });
  const dragStateRef = useRef({ active: false, pointerId: null, x: 0, y: 0 });
  const resizeStateRef = useRef({ active: false, pointerId: null, startX: 0, startPreviewWidth: 50 });
  const contentRef = useRef(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(50);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

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
    setViewport({ x: 0, y: 0, scale: 1 });
  }, [revisionId]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsPreviewFullscreen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

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

  function handleWheel(event) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);

    setViewport((current) => {
      const nextScale = clampScale(current.scale * zoomFactor);
      if (nextScale === current.scale) {
        return current;
      }

      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale
      };
    });
  }

  function handlePointerDown(event) {
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

    setViewport((current) => ({
      ...current,
      x: current.x + dx,
      y: current.y + dy
    }));
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

  function handleResizePointerDown(event) {
    if (event.button !== 0 || !contentRef.current) return;
    resizeStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startPreviewWidth: previewWidth
    };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerMove(event) {
    const resizeState = resizeStateRef.current;
    if (!resizeState.active || resizeState.pointerId !== event.pointerId || !contentRef.current) return;

    const totalWidth = contentRef.current.getBoundingClientRect().width;
    if (totalWidth <= 0) return;
    const deltaX = event.clientX - resizeState.startX;
    const deltaPercent = (deltaX / totalWidth) * 100;
    const nextPreviewWidth = Math.min(80, Math.max(20, resizeState.startPreviewWidth - deltaPercent));
    setPreviewWidth(nextPreviewWidth);
  }

  function handleResizePointerUp(event) {
    const resizeState = resizeStateRef.current;
    if (!resizeState.active || resizeState.pointerId !== event.pointerId) return;
    resizeStateRef.current = { active: false, pointerId: null, startX: 0, startPreviewWidth: previewWidth };
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section className="diagram-canvas">
      <header>
        <h2>Live Diagram</h2>
        <span>Revision {revisionId}</span>
      </header>
      <div
        className={`diagram-content ${isResizing ? 'is-resizing' : ''} ${
          isPreviewFullscreen ? 'preview-fullscreen' : ''
        }`}
        ref={contentRef}
      >
        {!isPreviewFullscreen ? (
          <div className="diagram-editor" style={{ width: `${100 - previewWidth}%` }}>
            <h3>Mermaid DSL</h3>
            {streamingPreview ? <p className="streaming-note">AG-UI is streaming the validated source into the editor...</p> : null}
            <Editor
              height="360px"
              defaultLanguage="plaintext"
              value={editorSource}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                readOnly: streamingPreview
              }}
            />
          </div>
        ) : null}
        {!isPreviewFullscreen ? (
          <div
            className={`diagram-splitter ${isResizing ? 'is-active' : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and preview panes"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
          />
        ) : null}
        <div className="diagram-preview" style={{ width: isPreviewFullscreen ? '100%' : `${previewWidth}%` }}>
          <div className="diagram-preview-header">
            <h3>Renderer</h3>
            <button
              type="button"
              className="preview-maximize-button"
              onClick={() => setIsPreviewFullscreen((current) => !current)}
            >
              {isPreviewFullscreen ? 'Exit full screen' : 'Maximize'}
            </button>
          </div>
          {streamingPreview ? <p className="streaming-note">Renderer will refresh after validation completes.</p> : null}
          {displayedRenderError ? <p className="diagram-error">{displayedRenderError}</p> : null}
          <div
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
      </div>
    </section>
  );
}
