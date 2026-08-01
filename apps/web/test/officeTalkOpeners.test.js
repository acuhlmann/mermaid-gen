import { describe, expect, it } from 'vitest';
import { FLOOR_OPENER_MAX, buildFloorTalkOpeners } from '../src/utils/officeTalkOpeners.js';

/**
 * Node environment: openers are a pure function of the office log, which is
 * what lets the floor offer them without reaching for diagram context it does
 * not have.
 */

const COPY = {
  label: 'Things you could open with',
  pitch: 'About “{topic}”…',
  email: 'About your email…',
  visit: 'About earlier…',
  battle: 'About who was right…',
  run: 'About what I just shipped…',
  generic: 'Got a minute?'
};

const at = (minute) => new Date(2026, 7, 1, 9, minute).getTime();

describe('buildFloorTalkOpeners', () => {
  it('always offers something, even with an empty log', () => {
    expect(buildFloorTalkOpeners([], 'gilfoyle', COPY)).toEqual(['Got a minute?']);
    expect(buildFloorTalkOpeners(undefined, 'gilfoyle', COPY)).toEqual(['Got a minute?']);
  });

  it('quotes an adopted pitch, which is the only real diagram text it has', () => {
    const openers = buildFloorTalkOpeners(
      [
        {
          at: at(2),
          kind: 'pitch',
          colleagueId: 'gilfoyle',
          detail: 'Split Auth into Authentication and Authorization'
        }
      ],
      'gilfoyle',
      COPY
    );
    // Clipped to fit a chip — a pitch is an instruction, a chip is a phrase.
    expect(openers[0]).toBe('About “Split Auth into Authentication an…”…');
  });

  it('cuts a pitch at its first clause when that reads as the subject', () => {
    const openers = buildFloorTalkOpeners(
      [{ at: at(2), kind: 'pitch', detail: 'The Gateway node, which fans out to four services' }],
      'gilfoyle',
      COPY
    );
    expect(openers[0]).toBe('About “The Gateway node”…');
  });

  /**
   * Something *they* did outranks something *you* did — the difference between
   * an office and a tool is that the other people in it have been busy.
   */
  it('prefers what this colleague did over what you did', () => {
    const log = [
      { at: at(1), kind: 'run', detail: 'mermaid' },
      { at: at(2), kind: 'email', colleagueId: 'facilities', detail: 'FRIDGE AMNESTY' }
    ];
    expect(buildFloorTalkOpeners(log, 'facilities', COPY)[0]).toBe('About your email…');
  });

  it('ignores what somebody else did', () => {
    const log = [{ at: at(2), kind: 'email', colleagueId: 'facilities', detail: 'FRIDGE' }];
    const openers = buildFloorTalkOpeners(log, 'gilfoyle', COPY);
    expect(openers).not.toContain('About your email…');
    expect(openers).toEqual(['Got a minute?']);
  });

  /** You already talked to them; "about our chat" is the one nobody needs. */
  it('never offers to talk about the conversation you already had', () => {
    const log = [{ at: at(3), kind: 'chat', colleagueId: 'gilfoyle' }];
    expect(buildFloorTalkOpeners(log, 'gilfoyle', COPY)).toEqual(['Got a minute?']);
  });

  it('caps the menu and keeps the generic option last', () => {
    const log = [
      { at: at(1), kind: 'run', detail: 'mermaid' },
      { at: at(2), kind: 'battle', detail: 'gilfoyle' },
      { at: at(3), kind: 'walkby', colleagueId: 'gilfoyle' },
      { at: at(4), kind: 'pitch', colleagueId: 'jared', detail: 'Rename the Gateway node' }
    ];
    const openers = buildFloorTalkOpeners(log, 'gilfoyle', COPY);
    expect(openers).toHaveLength(FLOOR_OPENER_MAX);
    // Newest first, so the pitch leads.
    expect(openers[0]).toBe('About “Rename the Gateway node”…');
    expect(openers).not.toContain('Got a minute?');
  });

  it('does not repeat an opener when the log repeats a kind', () => {
    const log = [
      { at: at(1), kind: 'run', detail: 'mermaid' },
      { at: at(2), kind: 'run', detail: 'chart' }
    ];
    const openers = buildFloorTalkOpeners(log, 'gilfoyle', COPY);
    expect(openers).toEqual(['About what I just shipped…', 'Got a minute?']);
  });

  it('returns nothing without copy rather than rendering undefined chips', () => {
    expect(buildFloorTalkOpeners([{ at: at(1), kind: 'run' }], 'gilfoyle', null)).toEqual([]);
  });
});
