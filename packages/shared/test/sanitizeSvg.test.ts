import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseViewBoxPixelSize,
  patchMermaidClassDefContainerCollisions,
  sanitizeSvgMarkup
} from '../src/sanitizeSvg.js';

test('sanitizeSvgMarkup strips script and on* handlers', () => {
  const dirty = '<svg><script>alert(1)</script><rect onload="alert(2)" width="1"/></svg>';
  const clean = sanitizeSvgMarkup(dirty);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onload=/i);
  assert.match(clean, /<rect/);
});

test('parseViewBoxPixelSize reads width and height from viewBox string', () => {
  assert.deepEqual(parseViewBoxPixelSize('-20 -20 320 130'), { width: 320, height: 130 });
  assert.equal(parseViewBoxPixelSize('bad'), null);
});

test('sanitizeSvgMarkup pins root width/height from viewBox (fixes 100% collapse)', () => {
  const mermaidLike =
    '<svg viewBox="0 0 200 100" width="100%" style="max-width: 200px;"><rect width="10"/></svg>';
  const clean = sanitizeSvgMarkup(mermaidLike);
  assert.match(clean, /width="200"/);
  assert.match(clean, /height="100"/);
  assert.doesNotMatch(clean, /width="100%"/);
});

test('patchMermaidClassDefContainerCollisions scopes classDef root away from g.root', () => {
  const style =
    '#diagram-1 .root path{fill:lime!important;}' +
    '#diagram-1 .root .anchor path{fill:#000!important;}' +
    '#diagram-1 .hub rect{fill:blue;}';
  const patched = patchMermaidClassDefContainerCollisions(`<svg><style>${style}</style></svg>`);
  assert.match(patched, /#diagram-1 g\.node\.root path\{fill:lime/);
  assert.match(patched, /#diagram-1 \.root \.anchor path\{fill:#000/);
  assert.match(patched, /#diagram-1 \.hub rect\{fill:blue/);
});

test('sanitizeSvgMarkup preserves foreignObject (neo / HTML labels)', () => {
  const tag = ['d', 'iv'].join('');
  const dirty = `<svg><foreignObject><${tag} class="nodeLabel">Hello</${tag}></foreignObject></svg>`;
  const clean = sanitizeSvgMarkup(dirty);
  assert.match(clean, /foreignObject/i);
  assert.match(clean, /nodeLabel/);
});
