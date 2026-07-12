import { useEffect, useState } from 'react';
import { renderMermaidPreviewSvg } from '../utils/renderMermaidPreview.js';

/**
 * Read-only first-run example rendered on the empty canvas. Draws a pre-baked
 * Mermaid diagram to SVG (via the shared preview renderer) with a caption, so a
 * newcomer sees a finished archislop diagram before typing.
 *
 * Fails silent: if the render throws (or is skipped while inactive), it renders
 * nothing rather than a broken state — the entry input and starter chips below
 * remain the working path. It never touches session/diagram state.
 *
 * The caller mounts this only in the empty state; `active` additionally gates the
 * async render so it does no work while hidden.
 */
export default function ExampleDiagramPreview({
  source,
  eyebrow,
  caption,
  ariaLabel,
  active = true
}) {
  const [svgMarkup, setSvgMarkup] = useState('');

  useEffect(() => {
    const dsl = (source ?? '').trim();
    if (!active || !dsl) return undefined;

    let cancelled = false;
    renderMermaidPreviewSvg('entry-example', dsl)
      .then(({ svg }) => {
        if (!cancelled) setSvgMarkup(svg);
      })
      .catch(() => {
        // Illustrative content only — never surface a render error to a newcomer.
        if (!cancelled) setSvgMarkup('');
      });

    return () => {
      cancelled = true;
    };
  }, [active, source]);

  if (!active || !svgMarkup) return null;

  return (
    <div className="entry-example" data-testid="entry-example" aria-label={ariaLabel} role="img">
      <div className="entry-example-card">
        {eyebrow ? <p className="entry-example-eyebrow">{eyebrow}</p> : null}
        <div
          className="entry-example-svg"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
        {caption ? <p className="entry-example-caption">{caption}</p> : null}
      </div>
    </div>
  );
}
