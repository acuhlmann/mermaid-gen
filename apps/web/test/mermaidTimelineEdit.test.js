import { describe, expect, it } from 'vitest';
import {
  addLinkedTimelineNode,
  deleteTimelineNode,
  isTimelineFamilySource,
  parseTimelineDoc,
  parseTimelineLine,
  renameTimelineNode,
  timelineLabelRef
} from '../src/utils/mermaidTimelineEdit.js';

const TIMELINE = `timeline
  title Product history
  section 2000s
    Facebook : 2004
    Twitter : 2006
  section 2010s
    Instagram : 2010
`;

describe('isTimelineFamilySource', () => {
  it('accepts timeline diagrams only', () => {
    expect(isTimelineFamilySource(TIMELINE)).toBe(true);
    expect(isTimelineFamilySource('flowchart LR\n  A --> B')).toBe(false);
  });
});

describe('parseTimelineLine', () => {
  it('parses section and event lines', () => {
    expect(parseTimelineLine('section 2000s')).toMatchObject({
      lineKind: 'section',
      primary: '2000s'
    });
    expect(parseTimelineLine('Facebook : 2004')).toMatchObject({
      lineKind: 'event',
      primary: 'Facebook',
      tail: '2004'
    });
  });
});

describe('timeline Connect / Delete / Rename', () => {
  it('adds a sibling event after the selected row', () => {
    const result = addLinkedTimelineNode(TIMELINE, '0', 'MySpace');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('1');
    expect(result.source).toMatch(/Facebook : 2004\n\s+MySpace : 2004/);
  });

  it('resolves clicks by label', () => {
    const result = addLinkedTimelineNode(TIMELINE, timelineLabelRef('Twitter'), 'Friendster');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Twitter : 2006\n\s+Friendster : 2006/);
  });

  it('refuses deleting the last remaining event', () => {
    const single = `timeline
  title Solo
  Alpha : one
`;
    expect(deleteTimelineNode(single, '0')).toMatchObject({ ok: false, reason: 'last' });
  });

  it('deletes a selected event', () => {
    const result = deleteTimelineNode(TIMELINE, '1');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Twitter : 2006/);
    expect(result.source).toMatch(/Instagram : 2010/);
  });

  it('renames only the primary label and keeps tail segments', () => {
    const result = renameTimelineNode(TIMELINE, '2', 'IG');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/IG : 2010/);
    expect(result.source).not.toMatch(/Instagram : 2010/);
  });

  it('refuses rename when the label is empty', () => {
    expect(renameTimelineNode(TIMELINE, '0', '   ')).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('parses events in source order', () => {
    const doc = parseTimelineDoc(TIMELINE);
    expect(doc?.events.map((event) => event.primary)).toEqual(['Facebook', 'Twitter', 'Instagram']);
  });
});
