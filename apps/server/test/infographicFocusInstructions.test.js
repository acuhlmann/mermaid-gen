import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInfographicFocusScopeInstructions,
  buildInfographicAnalyzeFocusInstructions
} from '../src/agents/infographicFocusInstructions.js';

test('returns empty string when selection kind is not infographic-item', () => {
  assert.equal(buildInfographicFocusScopeInstructions(null), '');
  assert.equal(buildInfographicFocusScopeInstructions({ id: 'x' }), '');
  assert.equal(buildInfographicFocusScopeInstructions({ id: 'x', selectionKind: 'node' }), '');
  assert.equal(buildInfographicAnalyzeFocusInstructions(null, 'richard'), '');
});

test('item-label selection cites the indexed path and the visible label', () => {
  const text = buildInfographicFocusScopeInstructions({
    id: 'infographic:item-label:2',
    selectionKind: 'infographic-item',
    label: 'Acquire',
    elementType: 'item-label',
    indexes: '2'
  });
  assert.match(text, /Focus scope/);
  assert.match(text, /label of the data item at <main-data-field>\[2\]/);
  assert.match(text, /"Acquire"/);
  assert.match(text, /Keep sibling items/);
});

test('nested indexes format as `[i].children[j]`', () => {
  const text = buildInfographicFocusScopeInstructions({
    id: 'infographic:item-label:1,0',
    selectionKind: 'infographic-item',
    label: 'Strong brand',
    elementType: 'item-label',
    indexes: '1,0'
  });
  assert.match(text, /<main-data-field>\[1\]\.children\[0\]/);
  assert.match(text, /"Strong brand"/);
});

test('icon selection cites the icon and the parent label', () => {
  const text = buildInfographicFocusScopeInstructions({
    id: 'infographic:item-icon:0',
    selectionKind: 'infographic-item',
    label: 'Strong brand',
    clickedLabel: 'star',
    elementType: 'item-icon',
    indexes: '0'
  });
  assert.match(text, /icon of the data item at <main-data-field>\[0\]/);
  assert.match(text, /"Strong brand"/);
  // clickedLabel is surfaced as a hint distinct from the visible label
  assert.match(text, /Clicked sub-text: "star"/);
});

test('title selection scopes edits to the title only', () => {
  const text = buildInfographicFocusScopeInstructions({
    id: 'infographic:title',
    selectionKind: 'infographic-item',
    label: 'Growth funnel',
    elementType: 'title',
    indexes: ''
  });
  assert.match(text, /diagram-level title/);
  assert.match(text, /"Growth funnel"/);
  assert.match(text, /Prefer edits to that title only/);
  assert.match(text, /Leave the main data items/);
});

test('top-level desc selection scopes to the desc', () => {
  const text = buildInfographicFocusScopeInstructions({
    id: 'infographic:desc',
    selectionKind: 'infographic-item',
    label: 'Three stages we care about',
    elementType: 'desc',
    indexes: ''
  });
  assert.match(text, /diagram-level top-level description/);
  assert.match(text, /Prefer edits to that top-level description only/);
});

test('explain analyze instructions lead with the selected item', () => {
  const text = buildInfographicAnalyzeFocusInstructions(
    {
      id: 'infographic:item-label:2',
      selectionKind: 'infographic-item',
      label: 'Acquire',
      elementType: 'item-label',
      indexes: '2'
    },
    'richard'
  );
  assert.match(text, /Selection focus/);
  assert.match(text, /Lead with this specific item/);
  assert.match(text, /## Explanation/);
  assert.match(text, /## Key data points/);
  assert.match(text, /"Acquire"/);
});

test('critique analyze instructions prioritize issues with the selected item', () => {
  const text = buildInfographicAnalyzeFocusInstructions(
    {
      id: 'infographic:item-label:0',
      selectionKind: 'infographic-item',
      label: 'Convert',
      elementType: 'item-label',
      indexes: '0'
    },
    'jared'
  );
  assert.match(text, /prioritize issues with this specific item/);
  assert.match(text, /## Weaknesses and limits/);
  assert.match(text, /"Convert"/);
});

test('explain on title centers framing/scope language', () => {
  const text = buildInfographicAnalyzeFocusInstructions(
    {
      id: 'infographic:title',
      selectionKind: 'infographic-item',
      label: 'Quarterly revenue',
      elementType: 'title',
      indexes: ''
    },
    'richard'
  );
  assert.match(text, /Lead with what this title communicates/);
  assert.match(text, /framing, scope/);
});

test('malformed indexes are dropped (negative, NaN, whitespace)', () => {
  // -1 is filtered out (not >= 0); "abc" is NaN; trailing comma yields empty token.
  const text = buildInfographicFocusScopeInstructions({
    id: 'infographic:item-label:bad',
    selectionKind: 'infographic-item',
    label: 'X',
    elementType: 'item-label',
    indexes: '-1, abc , 3,'
  });
  // Only the valid 3 survives.
  assert.match(text, /<main-data-field>\[3\]/);
  assert.doesNotMatch(text, /\[-1\]/);
});
