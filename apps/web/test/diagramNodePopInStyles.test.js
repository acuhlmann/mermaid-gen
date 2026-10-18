import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression guard for Mermaid diagrams rendering as "edges only".
//
// DiagramCanvas stamps `data-node-fade="1"` on every `g.node` / `g.cluster` after a
// render, and App.css plays `diagram-node-pop-in` on them with `fill-mode: both`.
// Mermaid positions each node with an SVG `transform="translate(x,y)"` attribute,
// and a CSS `transform` (even `transform: none`, held forever by the fill mode)
// replaces that attribute — so every node collapsed onto the SVG origin, clipped
// in the top-left corner, while edge paths (absolute coordinates) stayed put.
// The individual `translate` / `scale` properties compose with the attribute.
const cssPath = fileURLToPath(new URL('../src/App.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

function keyframesBody(name) {
  const idx = css.indexOf(`@keyframes ${name}`);
  if (idx === -1) return null;
  let depth = 0;
  for (let i = css.indexOf('{', idx); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(idx, i + 1);
  }
  return null;
}

describe('diagram-node-pop-in keyframes', () => {
  it('never animates `transform`, which would override Mermaid node placement', () => {
    const body = keyframesBody('diagram-node-pop-in');
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/(^|[\s;{])transform\s*:/);
  });
});
