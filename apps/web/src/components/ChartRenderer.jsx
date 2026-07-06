import { useEffect, useMemo, useRef, useState } from 'react';
import { parseChartDsl } from '@archislop/shared';
import { applyChartThemeToSpec, resolveChartThemePreset } from '../utils/chartThemePresets.js';
import { expressionInterpreter } from 'vega-interpreter';

/** Default rendered dimensions when the spec doesn't set width/height. Picked to feel
 *  presentation-sized inside the viewport so the first render isn't a tiny square. */
const DEFAULT_CHART_WIDTH = 720;
const DEFAULT_CHART_HEIGHT = 440;
const COMPACT_CHART_WIDTH = 380;
const COMPACT_CHART_HEIGHT = 260;

const EMBED_DEFAULT_OPTIONS = {
  actions: false,
  // SVG renderer so the canvas pan/zoom layer's CSS transform scales the chart cleanly.
  renderer: 'svg',
  tooltip: { theme: 'light' },
  // CSP: production blocks 'unsafe-eval', but Vega's default expression compiler uses
  // `new Function`. `ast: true` makes vega.parse emit ASTs instead of compiled functions,
  // and `expr: expressionInterpreter` walks those ASTs at runtime. Both are required —
  // passing the interpreter without `ast: true` is a no-op (vega-embed gates it on `ast`).
  ast: true,
  expr: expressionInterpreter
};

/**
 * Lazy-load vega-embed only when the chart slot is actually mounted.
 * Keeps Vega out of the bundle for users who never open this mode.
 */
let vegaEmbedPromise = null;
function loadVegaEmbed() {
  if (!vegaEmbedPromise) {
    vegaEmbedPromise = import('vega-embed').then((mod) => mod.default || mod);
  }
  return vegaEmbedPromise;
}

function ChartErrorState({ error }) {
  return (
    <div className="chart-error-state" role="alert">
      <p>Chart could not render.</p>
      <pre className="chart-error-detail">{error}</pre>
    </div>
  );
}

/** Inject reasonable default dimensions so the first render fills the viewport instead of
 *  rendering at vega's tiny defaults. We only set width/height when the spec hasn't already. */
function withDefaultSize(spec, compact = false) {
  if (!spec || typeof spec !== 'object') return spec;
  const hasWidth = spec.width != null;
  const hasHeight = spec.height != null;
  if (hasWidth && hasHeight) return spec;
  const width = compact ? COMPACT_CHART_WIDTH : DEFAULT_CHART_WIDTH;
  const height = compact ? COMPACT_CHART_HEIGHT : DEFAULT_CHART_HEIGHT;
  return {
    ...spec,
    ...(hasWidth ? {} : { width }),
    ...(hasHeight ? {} : { height })
  };
}

export default function ChartRenderer({ diagramSource, compact = false }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [renderError, setRenderError] = useState(null);

  const parsed = useMemo(() => {
    if (!diagramSource || !diagramSource.trim()) return { ok: false, empty: true };
    const result = parseChartDsl(diagramSource);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, dsl: result.dsl };
  }, [diagramSource]);

  useEffect(() => {
    if (!parsed.ok || !containerRef.current) {
      if (viewRef.current) {
        try {
          viewRef.current.finalize();
        } catch {
          // ignore — view was already torn down
        }
        viewRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const themed = applyChartThemeToSpec(withDefaultSize(parsed.dsl.spec, compact), parsed.dsl.theme);
    const preset = resolveChartThemePreset(parsed.dsl.theme);
    const options = {
      ...EMBED_DEFAULT_OPTIONS,
      ...(preset.embedTheme ? { theme: preset.embedTheme } : {})
    };

    loadVegaEmbed()
      .then((embed) => {
        if (cancelled || !containerRef.current) return null;
        return embed(containerRef.current, themed, options);
      })
      .then((result) => {
        if (cancelled || !result) return;
        if (viewRef.current) {
          try {
            viewRef.current.finalize();
          } catch {
            // ignore
          }
        }
        viewRef.current = result.view;
        setRenderError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setRenderError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [compact, parsed]);

  useEffect(
    () => () => {
      if (viewRef.current) {
        try {
          viewRef.current.finalize();
        } catch {
          // ignore
        }
        viewRef.current = null;
      }
    },
    []
  );

  if (!parsed.ok && parsed.empty) {
    return null;
  }
  if (!parsed.ok) {
    return <ChartErrorState error={parsed.error ?? 'Invalid chart DSL.'} />;
  }
  if (renderError) {
    return <ChartErrorState error={renderError} />;
  }

  return (
    <div className="chart-renderer-root">
      <div ref={containerRef} className="chart-embed-container" />
    </div>
  );
}
