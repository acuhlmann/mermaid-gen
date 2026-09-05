// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { stampPieSliceHitTargets } from '../src/utils/mermaidPieHitTargets.js';
import {
  findFlowchartNodeWrapByLogicalId,
  logicalIdFromNodeWrap
} from '../src/utils/diagramGraphEditNodeResolve.js';
import { graphEditIdFromDescriptor } from '../src/utils/canvasGraphEdit.js';
import { deletePieNode, renamePieNode } from '../src/utils/mermaidPieEdit.js';

const PIE_SOURCE = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15';

/**
 * Captured from `mermaid.render` in apps/web's own jsdom+vitest environment against the pinned
 * `mermaid ^11.17.2` — not hand-written. Hand-written is how #523 stayed invisible: the canvas
 * suite feeds `renderMermaidSvg` a mock whose SVG the test author drew to match the selectors,
 * so it agreed with the code instead of with mermaid. Slice order in this markup is DOM order.
 */
const REAL_PIE_SLICES = [
  '<path d="M0,-185A185,185,0,1,1,-177.899,-50.763L0,0Z" fill="#ECECFF" class="pieCircle"></path>',
  '<path d="M-177.899,-50.763A185,185,0,0,1,-35.652,-181.532L0,0Z" fill="#ffffde" class="pieCircle"></path>',
  '<path d="M-35.652,-181.532A185,185,0,0,1,0,-185L0,0Z" fill="hsl(80, 100%, 56.2745098039%)" class="pieCircle"></path>'
].join('');

const REAL_PIE_MARKUP =
  `<svg id="probepie" viewBox="0 0 450 450"><style>#probepie .slice{fill:#333}</style>` +
  `<g></g><g transform="translate(225,225)"><g>` +
  `<circle cx="0" cy="0" r="186" class="pieOuterCircle"></circle>` +
  REAL_PIE_SLICES +
  '<text class="slice">79%</text><text class="slice">17%</text><text class="slice">4%</text>' +
  '</g></g><g class="legend"><rect></rect><text>Dogs</text></g></svg>';

function parseInto(markup) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  return doc.documentElement;
}

describe('stampPieSliceHitTargets (#523)', () => {
  it('gives every pie wedge the identity the canvas plumbing already expects', () => {
    const stamped = stampPieSliceHitTargets(REAL_PIE_MARKUP, PIE_SOURCE);
    const root = parseInto(stamped);
    const wraps = [...root.querySelectorAll('g.node')];

    expect(wraps).toHaveLength(3);
    expect(wraps.map((g) => g.id)).toEqual([
      'diagram-0-node-0',
      'diagram-0-node-1',
      'diagram-0-node-2'
    ]);
    // The wedge keeps its own class and geometry: the wrapper adds identity, it does not restyle.
    const sourcePaths = [...parseInto(REAL_PIE_MARKUP).querySelectorAll('path.pieCircle')];
    for (const [i, wrap] of wraps.entries()) {
      const path = wrap.querySelector('path.pieCircle');
      expect(path).toBeTruthy();
      expect(path.getAttribute('d')).toBe(sourcePaths[i].getAttribute('d'));
      expect(path.getAttribute('fill')).toBe(sourcePaths[i].getAttribute('fill'));
      expect(wrap.getAttribute('transform')).toBe(null);
      expect(path.closest('g.node')).toBe(wrap);
    }
    // Nothing outside the wedges moved: the outer circle and the percentage labels stay siblings.
    expect(root.querySelector('circle.pieOuterCircle').closest('g.node')).toBe(null);
    expect(root.querySelectorAll('text.slice')).toHaveLength(3);
    expect(root.querySelectorAll('text.slice')[0].closest('g.node')).toBe(null);
  });

  it('carries the section name on a <title>, where no label scanner already looks', () => {
    const stamped = stampPieSliceHitTargets(REAL_PIE_MARKUP, PIE_SOURCE);
    const root = parseInto(stamped);
    expect([...root.querySelectorAll('g.node > title')].map((t) => t.textContent)).toEqual([
      'Dogs',
      'Cats',
      'Rats'
    ]);
    // A <text> would be picked up by visibleDiagramLabels and the diff highlighters as an on-canvas
    // label that is not drawn. <title> is the only child shape that cannot leak into a text scan.
    expect(root.querySelectorAll('g.node > text')).toHaveLength(0);
  });

  it('idempotent: a second pass does not nest a wrapper inside a wrapper', () => {
    const once = stampPieSliceHitTargets(REAL_PIE_MARKUP, PIE_SOURCE);
    const twice = stampPieSliceHitTargets(once, PIE_SOURCE);
    expect(twice).toBe(once);
    expect([...parseInto(twice).querySelectorAll('g.node')]).toHaveLength(3);
  });

  it('leaves non-pie markup byte-identical', () => {
    const flowchart =
      '<svg><g class="node" id="mermaid-flowchart-A-0"><rect/><text>A</text></g></svg>';
    expect(stampPieSliceHitTargets(flowchart, 'flowchart TD\n  A')).toBe(flowchart);
    expect(stampPieSliceHitTargets('', PIE_SOURCE)).toBe('');
    expect(stampPieSliceHitTargets(undefined, PIE_SOURCE)).toBe(undefined);
  });

  it('still stamps wedges when the source cannot be parsed, rather than shipping no identity', () => {
    // A pie whose source the parser rejects is still clickable wedges on screen: index identity is
    // the whole fix, the <title> is a nicety. Dropping the pass would re-creak #523 at an edge case.
    const stamped = stampPieSliceHitTargets(REAL_PIE_MARKUP, 'pie showData\n"BROKEN" :');
    const root = parseInto(stamped);
    expect([...root.querySelectorAll('g.node')].map((g) => g.id)).toEqual([
      'diagram-0-node-0',
      'diagram-0-node-1',
      'diagram-0-node-2'
    ]);
    expect(root.querySelectorAll('g.node > title')).toHaveLength(0);
  });

  it('fewer parsed slices than wedges: names the ones it can, keeps every wedge selectable', () => {
    const twoSlices = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';
    const stamped = stampPieSliceHitTargets(REAL_PIE_MARKUP, twoSlices);
    const root = parseInto(stamped);
    expect([...root.querySelectorAll('g.node')]).toHaveLength(3);
    expect([...root.querySelectorAll('g.node > title')].map((t) => t.textContent)).toEqual([
      'Dogs',
      'Cats'
    ]);
  });
});

describe('the stamped id reaches the pie mutator through the existing plumbing', () => {
  it('logicalIdFromNodeWrap → graphEditIdFromDescriptor → the right slice, via index', () => {
    const root = parseInto(stampPieSliceHitTargets(REAL_PIE_MARKUP, PIE_SOURCE));
    const wrap = root.querySelector('#diagram-0-node-1');
    expect(logicalIdFromNodeWrap(wrap)).toBe('1');

    const id = graphEditIdFromDescriptor({
      id: wrap.id,
      label: 'Cats',
      partKind: 'node',
      partName: 'Cats'
    });
    expect(id).toBe('1');

    const renamed = renamePieNode(PIE_SOURCE, id, 'Felines');
    expect(renamed.ok).toBe(true);
    expect(renamed.source).toContain('"Felines" : 85');
    expect(renamed.source).toContain('"Dogs" : 386');
    const deleted = deletePieNode(PIE_SOURCE, id);
    expect(deleted.ok).toBe(true);
    expect(deleted.source).not.toContain('Cats');
  });

  it('the resolver lookup finds a wedge by logical id, unchanged', () => {
    const root = parseInto(stampPieSliceHitTargets(REAL_PIE_MARKUP, PIE_SOURCE));
    expect(findFlowchartNodeWrapByLogicalId(root, '2')?.id).toBe('diagram-0-node-2');
    expect(findFlowchartNodeWrapByLogicalId(root, '9')).toBe(null);
  });

  it('a hit anywhere on the wedge resolves through closest(g.node)', () => {
    const root = parseInto(stampPieSliceHitTargets(REAL_PIE_MARKUP, PIE_SOURCE));
    const path = root.querySelectorAll('path.pieCircle')[0];
    expect(path.closest('g.node')?.id).toBe('diagram-0-node-0');
  });
});

/**
 * Captured the same way as `REAL_PIE_MARKUP`, from `mermaid.render` against the pinned
 * `mermaid ^11.17.2` — because the point of these two fixtures is a disagreement between the
 * source and the DOM that only the real renderer produces.
 *
 * `TINY_SLICE_SOURCE` names three sections and mermaid draws **two**: `createPieArcs` filters
 * `d.value / sum * 100 >= 1`, and Mice is 1/472 = 0.21%. `DUP_LABEL_SOURCE` also names three and
 * also draws two: `addSection` is `if (!sections.has(label))`, so the second `"Dogs"` line is
 * merged into the first. In both, DOM position 1 is source slice **2** — which is the whole
 * finding: a wedge's index is where mermaid drew it, never where the user wrote it.
 */
const TINY_SLICE_SOURCE = 'pie title Pets\n  "Mice" : 1\n  "Dogs" : 386\n  "Cats" : 85';
const TINY_SLICE_MARKUP =
  `<svg id="probepie" viewBox="0 0 450 450"><g></g><g transform="translate(225,225)"><g>` +
  `<circle cx="0" cy="0" r="186" class="pieOuterCircle"></circle>` +
  `<path d="M0,-185A185,185,0,1,1,-167.623,-78.278L0,0Z" fill="#ffffde" class="pieCircle"></path>` +
  `<path d="M-167.623,-78.278A185,185,0,0,1,0,-185L0,0Z" fill="hsl(80, 100%, 56.2745098039%)" class="pieCircle"></path>` +
  '<text class="slice">82%</text><text class="slice">18%</text>' +
  '</g></g></svg>';

const DUP_LABEL_SOURCE = 'pie title Pets\n  "Dogs" : 386\n  "Dogs" : 40\n  "Cats" : 85';
const DUP_LABEL_MARKUP =
  `<svg id="probedup" viewBox="0 0 450 450"><g></g><g transform="translate(225,225)"><g>` +
  `<circle cx="0" cy="0" r="186" class="pieOuterCircle"></circle>` +
  `<path d="M0,-185A185,185,0,1,1,-167.623,-78.278L0,0Z" fill="#ECECFF" class="pieCircle"></path>` +
  `<path d="M-167.623,-78.278A185,185,0,0,1,0,-185L0,0Z" fill="#ffffde" class="pieCircle"></path>` +
  '<text class="slice">82%</text><text class="slice">18%</text>' +
  '</g></g></svg>';

describe('a wedge is stamped with its source index, not its DOM position', () => {
  it('a section under 1% of the total is never drawn, so every later wedge shifts', () => {
    const root = parseInto(stampPieSliceHitTargets(TINY_SLICE_MARKUP, TINY_SLICE_SOURCE));
    const wraps = [...root.querySelectorAll('g.node')];

    expect(wraps).toHaveLength(2);
    // Not node-0/node-1: slice 0 is Mice, which mermaid dropped.
    expect(wraps.map((g) => g.id)).toEqual(['diagram-0-node-1', 'diagram-0-node-2']);
    expect(wraps.map((g) => g.querySelector('title')?.textContent)).toEqual(['Dogs', 'Cats']);
  });

  it('a repeated label is merged into its first line, so every later wedge shifts', () => {
    const root = parseInto(stampPieSliceHitTargets(DUP_LABEL_MARKUP, DUP_LABEL_SOURCE));
    const wraps = [...root.querySelectorAll('g.node')];

    expect(wraps).toHaveLength(2);
    expect(wraps.map((g) => g.id)).toEqual(['diagram-0-node-0', 'diagram-0-node-2']);
    expect(wraps.map((g) => g.querySelector('title')?.textContent)).toEqual(['Dogs', 'Cats']);
  });

  it('the mutator edits the slice the user clicked, not the one behind it', () => {
    const root = parseInto(stampPieSliceHitTargets(TINY_SLICE_MARKUP, TINY_SLICE_SOURCE));
    // The big lilac wedge on screen is Dogs. Tap it.
    const wrap = root.querySelectorAll('path.pieCircle')[0].closest('g.node');
    const id = graphEditIdFromDescriptor({
      id: wrap.id,
      label: 'Dogs',
      partKind: 'node',
      partName: 'Dogs'
    });

    const renamed = renamePieNode(TINY_SLICE_SOURCE, id, 'Hounds');
    expect(renamed.ok).toBe(true);
    expect(renamed.source).toContain('"Hounds" : 386');
    expect(renamed.source).toContain('"Mice" : 1');

    const deleted = deletePieNode(TINY_SLICE_SOURCE, id);
    expect(deleted.ok).toBe(true);
    expect(deleted.source).not.toContain('Dogs');
    expect(deleted.source).toContain('"Mice" : 1');
  });
});
