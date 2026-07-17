import { useEffect, useState } from 'react';
import { renderMermaidPreviewSvg } from '../utils/renderMermaidPreview.js';

/**
 * Compact first-run purpose card on the empty canvas. States what archislop is
 * for in a short beat sequence (brand → job → sample → CTA), shows a small
 * finished sample that matches the CTA, and offers one clear action
 * ("Generate this") so "try" is never ambiguous.
 *
 * Fails silent on Mermaid errors: the headline + CTA still render so a broken
 * preview never blocks the entry path. Never touches session/diagram state.
 *
 * The card wrapper is mostly decorative (`pointer-events: none`) behind the
 * bottom chrome; the CTA re-enables pointer events on itself.
 */
export default function ExampleDiagramPreview({
  source,
  eyebrow,
  headline,
  body,
  topicLabel,
  ariaLabel,
  ctaLabel,
  onTry,
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
        if (!cancelled) setSvgMarkup('');
      });

    return () => {
      cancelled = true;
    };
  }, [active, source]);

  if (!active) return null;
  if (!headline && !body && !svgMarkup && !onTry) return null;

  return (
    <div className="entry-example" data-testid="entry-example" aria-label={ariaLabel}>
      <div className="entry-example-card">
        {eyebrow ? <p className="entry-example-eyebrow">{eyebrow}</p> : null}
        {headline ? <h2 className="entry-example-headline">{headline}</h2> : null}
        {body ? <p className="entry-example-body">{body}</p> : null}
        {svgMarkup ? (
          <div className="entry-example-demo">
            <div
              className="entry-example-svg"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
            {topicLabel ? <p className="entry-example-topic">{topicLabel}</p> : null}
          </div>
        ) : null}
        {onTry && ctaLabel ? (
          <button
            type="button"
            className="overlay-button primary-button entry-example-try"
            onClick={onTry}
            data-testid="entry-example-try"
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
