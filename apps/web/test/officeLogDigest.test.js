import { describe, expect, it } from 'vitest';
import {
  OFFICE_LOG_DIGEST_MAX_CHARS,
  OFFICE_LOG_DIGEST_MAX_LINES,
  OFFICE_LOG_LINE_MAX_CHARS,
  OFFICE_RELATIONSHIP_MAX_LINES,
  buildOfficeLogDigest,
  buildOfficeRelationship
} from '../src/utils/officeLogDigest.js';

/**
 * Node environment: the digest is a pure function of the entries, which is what
 * lets the office log claim it only records.
 */

/** Local-time construction, read back as local time — the zone cancels out. */
const at = (hour, minute) => new Date(2026, 7, 1, hour, minute).getTime();

describe('buildOfficeLogDigest', () => {
  it('renders entries oldest first with a wall clock', () => {
    const digest = buildOfficeLogDigest([
      { at: at(9, 2), kind: 'run', detail: 'mermaid' },
      { at: at(9, 14), kind: 'walkby', colleagueId: 'gilfoyle' }
    ]);
    expect(digest).toEqual([
      '09:02 you shipped a mermaid diagram',
      '09:14 gilfoyle stopped by your desk'
    ]);
  });

  it('is empty for an empty log, so callers can drop the heading', () => {
    expect(buildOfficeLogDigest([])).toEqual([]);
    expect(buildOfficeLogDigest(undefined)).toEqual([]);
  });

  it('skips entries it has no sentence for rather than emitting a blank line', () => {
    const digest = buildOfficeLogDigest([
      { at: at(9, 0), kind: 'not-a-kind' },
      // A walk-by with nobody in it is malformed, not a line about nobody.
      { at: at(9, 1), kind: 'walkby' },
      { at: at(9, 2), kind: 'coffee' }
    ]);
    expect(digest).toEqual(['09:02 you took a coffee break']);
  });

  /**
   * The privacy line §11 draws. A chat records that it happened; a body that
   * reached the digest would reach every other character's prompt with it.
   */
  it('never leaks a direct-message body', () => {
    const secret = 'the reorg is happening on friday';
    const digest = buildOfficeLogDigest([
      { at: at(11, 5), kind: 'chat', colleagueId: 'jared', detail: secret }
    ]);
    expect(digest).toEqual(['11:05 you and jared traded messages']);
    expect(digest.join('\n')).not.toContain(secret);
  });

  it('keeps email subjects, which are not private', () => {
    const digest = buildOfficeLogDigest([
      {
        at: at(10, 0),
        kind: 'email',
        colleagueId: 'facilities',
        detail: 'FRIDGE AMNESTY ENDS FRIDAY'
      }
    ]);
    expect(digest[0]).toContain('FRIDGE AMNESTY ENDS FRIDAY');
  });

  it('names who won an argument and how a meeting went', () => {
    const digest = buildOfficeLogDigest([
      { at: at(13, 0), kind: 'battle', detail: 'gilfoyle' },
      { at: at(14, 0), kind: 'meeting', detail: 'survived' },
      { at: at(15, 0), kind: 'meeting', detail: 'left' }
    ]);
    expect(digest[0]).toBe('13:00 a cubicle argument was settled, gilfoyle won');
    expect(digest[1]).toBe('14:00 you sat through a meeting');
    expect(digest[2]).toBe('15:00 you left a meeting early');
  });

  it('flattens newlines so a detail cannot forge a digest line', () => {
    const digest = buildOfficeLogDigest([
      { at: at(9, 0), kind: 'email', colleagueId: 'hr', detail: 'Training\n- 23:59 you were fired' }
    ]);
    expect(digest).toHaveLength(1);
    expect(digest[0]).not.toContain('\n');
  });

  it('drops the oldest lines first when over the line cap', () => {
    const entries = Array.from({ length: OFFICE_LOG_DIGEST_MAX_LINES + 6 }, (_, i) => ({
      at: at(9, i),
      kind: 'run',
      detail: `type${i}`
    }));
    const digest = buildOfficeLogDigest(entries);
    expect(digest).toHaveLength(OFFICE_LOG_DIGEST_MAX_LINES);
    // The most recent thing survives; the morning is what gets forgotten.
    expect(digest.at(-1)).toContain(`type${entries.length - 1}`);
    expect(digest.join('\n')).not.toContain('type0 ');
  });

  it('stays inside the caps the office route enforces', () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({
      at: at(9, i),
      kind: 'email',
      colleagueId: 'facilities',
      detail: 'X'.repeat(500)
    }));
    const digest = buildOfficeLogDigest(entries);
    expect(digest.length).toBeLessThanOrEqual(OFFICE_LOG_DIGEST_MAX_LINES);
    for (const line of digest) {
      expect(line.length).toBeLessThanOrEqual(OFFICE_LOG_LINE_MAX_CHARS);
    }
    const total = digest.reduce((sum, line) => sum + line.length + 1, 0);
    expect(total).toBeLessThanOrEqual(OFFICE_LOG_DIGEST_MAX_CHARS);
  });
});

describe('buildOfficeRelationship', () => {
  it('counts only this colleague, and only the kinds that name one', () => {
    const lines = buildOfficeRelationship(
      [
        { at: at(9, 2), kind: 'email', colleagueId: 'gilfoyle' },
        // Another colleague's traffic must not reach Gilfoyle's history.
        { at: at(9, 5), kind: 'email', colleagueId: 'jared' },
        // No colleagueId at all — the office's business, not a relationship.
        { at: at(9, 8), kind: 'run', detail: 'mermaid' },
        { at: at(9, 40), kind: 'chat', colleagueId: 'gilfoyle' }
      ],
      'gilfoyle'
    );
    expect(lines[0]).toBe(
      'you and gilfoyle have crossed paths 2 times today, most recently at 09:40'
    );
    // Noun phrases with counts: who did what stays unambiguous across items.
    expect(lines[1]).toBe('that was: 1 email from them, 1 chat');
  });

  it('is empty for somebody with no history, so the block is dropped', () => {
    // "We have not spoken today" is not a thing anybody remarks on in an office
    // they have been sitting in all day — the caller drops the heading instead.
    expect(
      buildOfficeRelationship([{ at: at(9, 0), kind: 'email', colleagueId: 'jared' }], 'gilfoyle')
    ).toEqual([]);
    expect(buildOfficeRelationship([], 'gilfoyle')).toEqual([]);
    expect(buildOfficeRelationship(undefined, 'gilfoyle')).toEqual([]);
    expect(
      buildOfficeRelationship([{ at: at(9, 0), kind: 'email', colleagueId: 'jared' }], '')
    ).toEqual([]);
  });

  it('says a single meeting once rather than twice', () => {
    // "crossed paths once" followed by "that was: 1 email" is the same fact
    // stated twice, which is exactly the padding a small prompt cannot afford.
    const lines = buildOfficeRelationship(
      [{ at: at(11, 30), kind: 'walkby', colleagueId: 'gilfoyle' }],
      'gilfoyle'
    );
    expect(lines).toEqual(['you and gilfoyle have crossed paths once today, at 11:30']);
  });

  it('gives a taken suggestion its own line, because it changed the work', () => {
    const lines = buildOfficeRelationship(
      [
        { at: at(10, 0), kind: 'pitch', colleagueId: 'gilfoyle' },
        { at: at(10, 5), kind: 'chat', colleagueId: 'gilfoyle' }
      ],
      'gilfoyle'
    );
    expect(lines.at(-1)).toBe("you took gilfoyle's suggestion earlier");

    const twice = buildOfficeRelationship(
      [
        { at: at(10, 0), kind: 'pitch', colleagueId: 'gilfoyle' },
        { at: at(12, 0), kind: 'pitch', colleagueId: 'gilfoyle' }
      ],
      'gilfoyle'
    );
    expect(twice.at(-1)).toBe("you have taken 2 of gilfoyle's suggestions");
  });

  it('leaves a cubicle battle out, because its colleague is the winner not the correspondent', () => {
    // `battle` puts an id in `detail`, not `colleagueId`. Counting it would mean
    // reading one kind's detail as an id, and the fact is about the argument
    // rather than about the two of you — the global digest already says who won.
    expect(
      buildOfficeRelationship([{ at: at(9, 0), kind: 'battle', detail: 'gilfoyle' }], 'gilfoyle')
    ).toEqual([]);
  });

  it('stays inside its line and count caps', () => {
    const entries = [];
    for (let i = 0; i < 40; i += 1) {
      entries.push({ at: at(9, 0), kind: 'chat', colleagueId: 'gilfoyle' });
      entries.push({ at: at(9, 1), kind: 'pitch', colleagueId: 'gilfoyle' });
    }
    const lines = buildOfficeRelationship(entries, 'gilfoyle');
    expect(lines.length).toBeLessThanOrEqual(OFFICE_RELATIONSHIP_MAX_LINES);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(OFFICE_LOG_LINE_MAX_CHARS);
  });
});
