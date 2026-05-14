import { useEffect, useRef, useState } from 'react';
import { sanitizeMermaid } from '@archislop/shared';
import mermaid from 'mermaid';
import InfographicRenderer from './InfographicRenderer.jsx';

const MERMAID_INIT = {
  startOnLoad: false,
  deterministicIds: true,
  deterministicIDSeed: 'archislop-insights-embed'
};

function extractErrorMessage(error) {
  if (!error) return 'Unknown Mermaid error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'Mermaid render failed';
}

/**
 * Small, non-interactive diagram preview for the thinking pane (Mermaid SVG or Infographic canvas).
 */
export default function InsightsEmbeddedDiagram({
  source,
  kind,
  idPrefix = 'embed',
  streamingPreview = false
}) {
  const debounceRef = useRef(0);
  const requestRef = useRef(0);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    if (kind !== 'mermaid') return undefined;

    const dsl = (source ?? '').trim();
    if (!dsl) {
      setSvgMarkup('');
      setRenderError('');
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
          const diagramId = `insights-embed-${idPrefix}-${requestId}`.replace(/[^a-zA-Z0-9_-]/g, '');
          mermaid.initialize({ ...MERMAID_INIT });
          const { sanitized } = sanitizeMermaid(dsl);
          const { svg } = await mermaid.render(diagramId, sanitized);
          if (requestRef.current !== requestId) return;
          setSvgMarkup(svg);
          setRenderError('');
        } catch (error) {
          if (requestRef.current !== requestId) return;
          setSvgMarkup('');
          setRenderError(extractErrorMessage(error));
        }
      }

      runRender();
    }, streamingPreview ? 120 : 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [kind, source, idPrefix, streamingPreview]);

  if (kind === 'infographic') {
    return (
      <div
        className="insights-embedded-diagram insights-embedded-diagram--infographic"
        data-testid="insights-embedded-diagram"
        aria-label="Infographic preview (read-only)"
      >
        <div className="insights-embedded-diagram-inner">
          <InfographicRenderer
            diagramSource={source}
            selectedNode={null}
            streamingPreview={streamingPreview}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="insights-embedded-diagram insights-embedded-diagram--mermaid"
      data-testid="insights-embedded-diagram"
      aria-label="Mermaid preview (read-only)"
    >
      <div className="insights-embedded-diagram-inner">
        {renderError ? <p className="diagram-error insights-embedded-diagram-error">{renderError}</p> : null}
        {!renderError && svgMarkup ? (
          <div className="insights-embedded-mermaid-svg-host" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
        ) : null}
      </div>
    </div>
  );
}
