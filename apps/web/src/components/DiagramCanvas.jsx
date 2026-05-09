import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

function extractErrorMessage(error) {
  if (!error) return 'Unknown Mermaid error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'Mermaid render failed';
}

export default function DiagramCanvas({ mermaidSource, revisionId, onManualEdit }) {
  const [editorSource, setEditorSource] = useState(mermaidSource);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [renderError, setRenderError] = useState('');
  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  const lastAppliedSourceRef = useRef(mermaidSource);

  useEffect(() => {
    if (mermaidSource === lastAppliedSourceRef.current) {
      return;
    }

    lastAppliedSourceRef.current = mermaidSource;
    setEditorSource(mermaidSource);
  }, [mermaidSource]);

  useEffect(() => {
    let cancelled = false;

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
        } catch (error) {
          if (cancelled || requestRef.current !== requestId) {
            return;
          }
          setRenderError(extractErrorMessage(error));
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
  }, [editorSource]);

  function handleEditorChange(value) {
    const nextValue = value ?? '';
    setEditorSource(nextValue);
    lastAppliedSourceRef.current = nextValue;
    if (onManualEdit) {
      onManualEdit(nextValue);
    }
  }

  return (
    <section className="diagram-canvas">
      <header>
        <h2>Live Diagram</h2>
        <span>Revision {revisionId}</span>
      </header>
      <div className="diagram-content">
        <div className="diagram-editor">
          <h3>Mermaid DSL</h3>
          <Editor
            height="360px"
            defaultLanguage="plaintext"
            value={editorSource}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true
            }}
          />
        </div>
        <div className="diagram-preview">
          <h3>Renderer</h3>
          {renderError ? <p className="diagram-error">{renderError}</p> : null}
          <div className="diagram-output" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
        </div>
      </div>
    </section>
  );
}
