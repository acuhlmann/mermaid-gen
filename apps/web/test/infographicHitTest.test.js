// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  findInfographicTapTarget,
  infographicIndexesFor,
  infographicItemLabelFor
} from '../src/utils/infographicHitTest.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeElement(name, attrs = {}, text = '') {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  if (text) el.textContent = text;
  return el;
}

/**
 * Builds a small SVG fixture that mirrors the AntV-rendered tree for a `list-grid-badge-card`
 * with two items, plus a top-level title.
 *
 *   svg
 *     g[title]   ← title text
 *     g[items-group]
 *       g[item-icon-group][data-indexes="0"]
 *         ellipse[shape]
 *         rect[item-icon][data-indexes="0"]
 *       text[item-label][data-indexes="0"]   "Acquire"
 *       text[item-desc][data-indexes="0"]    "Multi-channel"
 *       g[item-icon-group][data-indexes="1"]
 *         rect[item-icon][data-indexes="1"]
 *       text[item-label][data-indexes="1"]   "Convert"
 *       text[item-desc][data-indexes="1"]    "Reduce drop-off"
 *     rect[shape]   ← decorative background
 */
function buildFixture() {
  const boundary = document.createElement('div');
  const svg = makeElement('svg');
  boundary.appendChild(svg);

  const title = makeElement('text', { 'data-element-type': 'title' }, 'Growth funnel');
  svg.appendChild(title);

  const itemsGroup = makeElement('g', { 'data-element-type': 'items-group' });
  svg.appendChild(itemsGroup);

  // Item 0
  const iconGroup0 = makeElement('g', { 'data-element-type': 'item-icon-group', 'data-indexes': '0' });
  const ellipse0 = makeElement('ellipse', { 'data-element-type': 'shape' });
  const iconRect0 = makeElement('rect', { 'data-element-type': 'item-icon', 'data-indexes': '0' });
  iconGroup0.appendChild(ellipse0);
  iconGroup0.appendChild(iconRect0);
  itemsGroup.appendChild(iconGroup0);

  const label0 = makeElement('text', { 'data-element-type': 'item-label', 'data-indexes': '0' }, 'Acquire');
  itemsGroup.appendChild(label0);

  const desc0 = makeElement('text', { 'data-element-type': 'item-desc', 'data-indexes': '0' }, 'Multi-channel');
  itemsGroup.appendChild(desc0);

  // Item 1
  const iconGroup1 = makeElement('g', { 'data-element-type': 'item-icon-group', 'data-indexes': '1' });
  const iconRect1 = makeElement('rect', { 'data-element-type': 'item-icon', 'data-indexes': '1' });
  iconGroup1.appendChild(iconRect1);
  itemsGroup.appendChild(iconGroup1);

  const label1 = makeElement('text', { 'data-element-type': 'item-label', 'data-indexes': '1' }, 'Convert');
  itemsGroup.appendChild(label1);

  const desc1 = makeElement('text', { 'data-element-type': 'item-desc', 'data-indexes': '1' }, 'Reduce drop-off');
  itemsGroup.appendChild(desc1);

  // Background decorative shape (no indexes, no selectable element-type up the chain)
  const bgShape = makeElement('rect', { 'data-element-type': 'shape' });
  svg.appendChild(bgShape);

  return {
    boundary,
    svg,
    title,
    itemsGroup,
    iconGroup0,
    ellipse0,
    iconRect0,
    label0,
    desc0,
    iconGroup1,
    iconRect1,
    label1,
    desc1,
    bgShape
  };
}

describe('findInfographicTapTarget', () => {
  it('returns null for null inputs', () => {
    expect(findInfographicTapTarget(null, null)).toBeNull();
    expect(findInfographicTapTarget(document.body, null)).toBeNull();
    expect(findInfographicTapTarget(null, document.body)).toBeNull();
  });

  it('clicking the label text returns item-label with the right indexes and label', () => {
    const f = buildFixture();
    const hit = findInfographicTapTarget(f.label0, f.boundary);
    expect(hit).not.toBeNull();
    expect(hit.elementType).toBe('item-label');
    expect(hit.indexes).toBe('0');
    expect(hit.label).toBe('Acquire');
    expect(hit.node).toBe(f.label0);
  });

  it('clicking the second label returns indexes=1', () => {
    const f = buildFixture();
    const hit = findInfographicTapTarget(f.label1, f.boundary);
    expect(hit.indexes).toBe('1');
    expect(hit.label).toBe('Convert');
  });

  it('clicking the desc returns item-desc but resolves the parent item label', () => {
    const f = buildFixture();
    const hit = findInfographicTapTarget(f.desc1, f.boundary);
    expect(hit.elementType).toBe('item-desc');
    expect(hit.indexes).toBe('1');
    // label resolves to the sibling item-label, not the desc text
    expect(hit.label).toBe('Convert');
    // clickedLabel preserves what the user actually tapped
    expect(hit.clickedLabel).toBe('Reduce drop-off');
  });

  it('clicking the icon rect returns item-icon with the parent label', () => {
    const f = buildFixture();
    const hit = findInfographicTapTarget(f.iconRect0, f.boundary);
    expect(hit.elementType).toBe('item-icon');
    expect(hit.indexes).toBe('0');
    expect(hit.label).toBe('Acquire');
  });

  it('clicking inside the icon group (e.g. its decorative ellipse) walks up to item-icon-group', () => {
    const f = buildFixture();
    const hit = findInfographicTapTarget(f.ellipse0, f.boundary);
    // ellipse is type=shape (not selectable) → walks up to item-icon-group
    expect(hit.elementType).toBe('item-icon-group');
    expect(hit.indexes).toBe('0');
    expect(hit.label).toBe('Acquire');
  });

  it('clicking the title returns elementType=title with no indexes', () => {
    const f = buildFixture();
    const hit = findInfographicTapTarget(f.title, f.boundary);
    expect(hit.elementType).toBe('title');
    expect(hit.indexes).toBe('');
    expect(hit.label).toBe('Growth funnel');
  });

  it('clicking the items-group container returns null (background)', () => {
    const f = buildFixture();
    expect(findInfographicTapTarget(f.itemsGroup, f.boundary)).toBeNull();
  });

  it('clicking a decorative background shape returns null', () => {
    const f = buildFixture();
    expect(findInfographicTapTarget(f.bgShape, f.boundary)).toBeNull();
  });

  it('clicking the bare svg returns null', () => {
    const f = buildFixture();
    expect(findInfographicTapTarget(f.svg, f.boundary)).toBeNull();
  });

  it('stops the walk at the boundary even if an ancestor element-type would match', () => {
    const f = buildFixture();
    // Pretend the boundary IS the items-group — walking from a label up to it stops first at the label.
    const hit = findInfographicTapTarget(f.label0, f.itemsGroup);
    expect(hit.elementType).toBe('item-label');
    expect(hit.indexes).toBe('0');
  });
});

describe('infographicIndexesFor', () => {
  it('reads the closest data-indexes from the walked element', () => {
    const f = buildFixture();
    expect(infographicIndexesFor(f.iconRect0, f.boundary)).toBe('0');
    expect(infographicIndexesFor(f.iconRect1, f.boundary)).toBe('1');
  });

  it('walks up when the clicked node has no data-indexes', () => {
    const f = buildFixture();
    // The decorative ellipse has no data-indexes, but its parent (item-icon-group) has one.
    expect(infographicIndexesFor(f.ellipse0, f.boundary)).toBe('0');
  });

  it('returns null when no ancestor up to the boundary has data-indexes', () => {
    const f = buildFixture();
    expect(infographicIndexesFor(f.bgShape, f.boundary)).toBeNull();
  });
});

describe('infographicItemLabelFor', () => {
  it('matches a sibling item-label with the same data-indexes', () => {
    const f = buildFixture();
    expect(infographicItemLabelFor(f.boundary, '0', f.iconRect0)).toBe('Acquire');
    expect(infographicItemLabelFor(f.boundary, '1', f.desc1)).toBe('Convert');
  });

  it('falls back to the clicked element text when no sibling label exists', () => {
    const f = buildFixture();
    // Index "99" has no sibling label — use the clicked element's own text.
    expect(infographicItemLabelFor(f.boundary, '99', f.desc1)).toBe('Reduce drop-off');
  });

  it('returns an empty string when there is no boundary and no fallback text', () => {
    expect(infographicItemLabelFor(null, '0', null)).toBe('');
  });
});
