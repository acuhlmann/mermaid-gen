import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import AnythingRenderer from './AnythingRenderer.jsx';
import ChartRenderer from './ChartRenderer.jsx';
import FormsRenderer from './FormsRenderer.jsx';
import InfographicRenderer from './InfographicRenderer.jsx';
import MetaphorRenderer from './MetaphorRenderer.jsx';
import { applyDiagramHighlightToSvg } from '../utils/applyDiagramHighlightToSvg.js';
import { applyChartHighlight } from '../utils/applyChartHighlight.js';
import {
  applyEmbeddedDiagramFocus,
  resetEmbeddedDiagramFocus
} from '../utils/embeddedDiagramFocus.js';
import { applyInfographicHighlight } from '@archislop/shared';
import { renderMermaidPreviewSvg } from '../utils/renderMermaidPreview.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

function extractErrorMessage(error) {
  if (!error) return 'Unknown Mermaid error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'Mermaid render failed';
}

/**
 * Mount-while-visible gate for the 3D metaphor preview. Browsers cap live WebGL
 * contexts (~8–16 per page) and a long thinking pane can hold many previews, so the
 * Three.js canvas only exists while its host is in (or near) the scroll viewport.
 */
function useNearViewport(hostRef) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { rootMargin: '160px' }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef]);
  return inView;
}

/**
 * Small, non-interactive diagram preview for the thinking pane (Mermaid SVG, Infographic
 * canvas, Vega-Lite chart, sandboxed Anything page, Three.js metaphor scene, or a
 * read-only A2UI Forms surface).
 */
export default function InsightsEmbeddedDiagram({
  source,
  kind,
  idPrefix = 'embed',
  streamingPreview = false,
  highlight = null
}) {
  const { controls } = useUiCopy();
  const debounceRef = useRef(0);
  const requestRef = useRef(0);
  const outerRef = useRef(null);
  const svgHostRef = useRef(null);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [renderError, setRenderError] = useState('');
  const nearViewport = useNearViewport(outerRef);

  const applyPreviewFocus = useCallback(() => {
    if (streamingPreview) return;
    const host = svgHostRef.current;
    if (!host) return;
    applyEmbeddedDiagramFocus(host, highlight, kind);
  }, [highlight, kind, streamingPreview]);

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

    debounceRef.current = setTimeout(
      () => {
        const requestId = requestRef.current + 1;
        requestRef.current = requestId;

        async function runRender() {
          try {
            const diagramId = `insights-embed-${idPrefix}-${requestId}`.replace(
              /[^a-zA-Z0-9_-]/g,
              ''
            );
            const { svg } = await renderMermaidPreviewSvg(diagramId, dsl);
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
      },
      streamingPreview ? 120 : 200
    );

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [kind, source, idPrefix, streamingPreview]);

  useLayoutEffect(() => {
    if (kind !== 'mermaid') return;
    applyDiagramHighlightToSvg(svgHostRef.current, highlight);
    applyPreviewFocus();
  }, [kind, svgMarkup, highlight, applyPreviewFocus]);

  // Re-apply infographic diff overlay whenever AntV finishes a render. We watch the
  // host subtree because InfographicRenderer renders asynchronously.
  useEffect(() => {
    if (kind !== 'infographic') return undefined;
    const host = svgHostRef.current;
    if (!host) return undefined;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        applyInfographicHighlight(host, highlight);
        applyPreviewFocus();
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [kind, source, highlight, applyPreviewFocus]);

  // Chart canvas is rendered async by Vega; observe DOM mutations and re-apply highlights.
  useEffect(() => {
    if (kind !== 'chart') return undefined;
    const host = svgHostRef.current;
    if (!host) return undefined;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        applyChartHighlight(host, highlight);
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [kind, source, highlight]);

  useEffect(() => {
    if (streamingPreview) return undefined;
    const outer = outerRef.current;
    if (!outer || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => applyPreviewFocus());
    observer.observe(outer);
    return () => observer.disconnect();
  }, [applyPreviewFocus, streamingPreview]);

  useEffect(() => {
    return () => resetEmbeddedDiagramFocus(svgHostRef.current);
  }, []);

  if (kind === 'infographic') {
    return (
      <div
        ref={outerRef}
        className="insights-embedded-diagram insights-embedded-diagram--infographic"
        data-testid="insights-embedded-diagram"
        aria-label={controls.embeddedPreview.infographic}
      >
        <div ref={svgHostRef} className="insights-embedded-diagram-inner">
          <InfographicRenderer
            diagramSource={source}
            selectedNode={null}
            streamingPreview={streamingPreview}
          />
        </div>
      </div>
    );
  }

  if (kind === 'chart') {
    return (
      <div
        ref={outerRef}
        className="insights-embedded-diagram insights-embedded-diagram--chart"
        data-testid="insights-embedded-diagram"
        aria-label={controls.embeddedPreview.chart}
      >
        <div ref={svgHostRef} className="insights-embedded-diagram-inner">
          <ChartRenderer diagramSource={source} compact />
        </div>
      </div>
    );
  }

  if (kind === 'metaphor3d') {
    return (
      <div
        ref={outerRef}
        className="insights-embedded-diagram insights-embedded-diagram--metaphor3d"
        data-testid="insights-embedded-diagram"
        aria-label={controls.embeddedPreview.metaphor3d}
      >
        <div className="insights-embedded-diagram-inner">
          {nearViewport ? (
            <MetaphorRenderer
              diagramSource={source}
              streamingPreview={streamingPreview}
              enableGltfExport={false}
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (kind === 'anything') {
    return (
      <div
        ref={outerRef}
        className="insights-embedded-diagram insights-embedded-diagram--anything"
        data-testid="insights-embedded-diagram"
        aria-label={controls.embeddedPreview.page}
      >
        <div ref={svgHostRef} className="insights-embedded-diagram-inner">
          <AnythingRenderer diagramSource={source} streamingPreview={streamingPreview} />
        </div>
      </div>
    );
  }

  if (kind === 'forms') {
    return (
      <div
        ref={outerRef}
        className="insights-embedded-diagram insights-embedded-diagram--forms"
        data-testid="insights-embedded-diagram"
        aria-label={controls.embeddedPreview.forms}
      >
        <div ref={svgHostRef} className="insights-embedded-diagram-inner">
          <FormsRenderer diagramSource={source} streamingPreview preview />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      className="insights-embedded-diagram insights-embedded-diagram--mermaid"
      data-testid="insights-embedded-diagram"
      aria-label={controls.embeddedPreview.mermaid}
    >
      <div className="insights-embedded-diagram-inner">
        {renderError ? (
          <p className="diagram-error insights-embedded-diagram-error">{renderError}</p>
        ) : null}
        {!renderError && svgMarkup ? (
          <div
            ref={svgHostRef}
            className="insights-embedded-mermaid-svg-host"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : null}
      </div>
    </div>
  );
}
