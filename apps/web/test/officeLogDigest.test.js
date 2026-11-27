import { describe, expect, it } from 'vitest';
import {
  OFFICE_LOG_DIGEST_MAX_CHARS,
  OFFICE_LOG_DIGEST_MAX_LINES,
  OFFICE_LOG_KINDS,
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
      '09:02 the user shipped a mermaid diagram',
      "09:14 gilfoyle stopped by the user's desk"
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
    expect(digest).toEqual(['09:02 the user took a coffee break']);
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
    expect(digest).toEqual(['11:05 the user and jared traded messages']);
    expect(digest.join('\n')).not.toContain(secret);
  });

  /**
   * The other half of §11's DM privacy, and the half that was missing: the
   * body stayed between the two of you, and the line saying it happened went
   * to everybody. A digest is "what the office remembers", but it is always
   * read out *to* somebody, and a chat is the one entry with no witness.
   */
  it('withholds a direct message from everybody who was not in it', () => {
    const entries = [
      { at: at(9, 0), kind: 'walkby', colleagueId: 'greybeard' },
      { at: at(11, 5), kind: 'chat', colleagueId: 'jared' }
    ];
    const bystander = buildOfficeLogDigest(entries, { audience: ['gary'] });
    expect(bystander).toEqual(["09:00 greybeard stopped by the user's desk"]);

    // And the person who was in it still has it — they are the one character
    // who may say "about those messages".
    const jared = buildOfficeLogDigest(entries, { audience: ['jared'] });
    expect(jared).toHaveLength(2);
    expect(jared.at(-1)).toContain('the user and jared traded messages');
  });

  it('is the unscoped digest when nobody has been named', () => {
    // The default every ensemble sender still uses. A narrower default would
    // silently change three prompts no case here covers.
    const digest = buildOfficeLogDigest([{ at: at(11, 5), kind: 'chat', colleagueId: 'jared' }]);
    expect(digest).toEqual(['11:05 the user and jared traded messages']);
    expect(
      buildOfficeLogDigest([{ at: at(11, 5), kind: 'chat', colleagueId: 'jared' }], {})
    ).toEqual(digest);
  });

  it('withholds a private entry that names nobody, rather than guessing', () => {
    // A `chat` with no `colleagueId` is malformed; the audience cannot be shown
    // to be party to it, so it is withheld from everybody rather than read out
    // because the check could not be made.
    expect(
      buildOfficeLogDigest([{ at: at(11, 5), kind: 'chat' }], { audience: ['jared'] })
    ).toEqual([]);
  });

  /**
   * Scoping happens before the caps, which is the half of this that is not
   * about privacy at all: a withheld line hands its budget back.
   */
  it('gives the budget back rather than spending it on what it withheld', () => {
    const entries = [
      ...Array.from({ length: 6 }, (_, i) => ({
        at: at(9, i),
        kind: 'run',
        detail: `type${i}`
      })),
      ...Array.from({ length: OFFICE_LOG_DIGEST_MAX_LINES }, (_, i) => ({
        at: at(14, i),
        kind: 'chat',
        colleagueId: 'jared'
      }))
    ];
    // Unscoped, an afternoon of one thread is the whole of everybody's memory.
    const everything = buildOfficeLogDigest(entries);
    expect(everything).toHaveLength(OFFICE_LOG_DIGEST_MAX_LINES);
    expect(everything.join('\n')).not.toContain('type0');

    const bystander = buildOfficeLogDigest(entries, { audience: ['gary'] });
    expect(bystander).toHaveLength(6);
    expect(bystander[0]).toContain('type0');
  });

  it('scopes to a whole room, which is how a meeting knows things collectively', () => {
    const entries = [
      { at: at(11, 0), kind: 'chat', colleagueId: 'jared' },
      { at: at(11, 30), kind: 'chat', colleagueId: 'gilfoyle' }
    ];
    const room = buildOfficeLogDigest(entries, { audience: ['gilfoyle', 'pam'] });
    expect(room).toHaveLength(1);
    expect(room[0]).toContain('gilfoyle');
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
    expect(digest[1]).toBe('14:00 the user sat through a meeting');
    expect(digest[2]).toBe('15:00 the user left a meeting early');
  });

  /**
   * The room's view of a collision, which is the half the floor never filed.
   * Both reactions get a line because the difference is visible from across the
   * room — whether they walked back with the thing or without it.
   */
  it('says you got in somebody’s way, and whether it cost them the errand', () => {
    const digest = buildOfficeLogDigest([
      { at: at(10, 0), kind: 'interrupt', colleagueId: 'intern', detail: 'gaveUp' },
      { at: at(10, 30), kind: 'interrupt', colleagueId: 'chad', detail: 'gotIt' }
    ]);
    expect(digest[0]).toBe(
      "10:00 the user got in intern's way and they went back to their desk empty-handed"
    );
    expect(digest[1]).toBe('10:30 the user took the spot chad was using');
  });

  /**
   * The prop is on the beat (`interruptedProp`) and not on the line, which
   * `useFloorInterruptMemory.js` calls "a fact for the floor, not a fact for a
   * mouth". Two records that never name a machine cannot name two different
   * ones.
   */
  it('never names the machine the errand was for', () => {
    const digest = buildOfficeLogDigest([
      { at: at(10, 0), kind: 'interrupt', colleagueId: 'intern', detail: 'gaveUp' }
    ]);
    expect(digest[0]).not.toMatch(/printer|whiteboard|coffee/i);
  });

  /**
   * An interruption is public — more public than an email subject, which this
   * module already carries on the grounds that a subject line is what the
   * office gossips about. So it reaches a third colleague who was neither of
   * the two people in it.
   */
  it('tells the collision to somebody who was not in it', () => {
    const digest = buildOfficeLogDigest(
      [{ at: at(10, 0), kind: 'interrupt', colleagueId: 'intern', detail: 'gaveUp' }],
      { audience: 'gilfoyle' }
    );
    expect(digest).toHaveLength(1);
    expect(digest[0]).toContain("intern's way");
  });

  /**
   * The room supports two huddles and had one sentence. A mob is the team
   * dragged over; a pair is one named colleague pulling their chair up, and
   * calling that "the team" is the false fact that kept the write shut
   * (`docs/office-isometric-mode.md` § 8, `pair-huddle-is-never-huddled`).
   */
  it('tells a pair at your desk apart from the team crowding round it', () => {
    const digest = buildOfficeLogDigest([
      { at: at(11, 0), kind: 'huddle', colleagueId: 'gilfoyle' },
      { at: at(16, 0), kind: 'huddle' }
    ]);
    expect(digest[0]).toBe('11:00 the user and gilfoyle talked something through at their desk');
    expect(digest[1]).toBe("16:00 the team crowded around the user's screen");
    expect(digest[0]).not.toContain('the team');
  });

  /**
   * Bodiless, like a chat and like an interruption's line: the transcript is on
   * the partner's working-memory beat, which only they are handed. Nothing the
   * entry carries could put it here — there is no `detail` on a huddle — and
   * this pins that there never is one.
   */
  it('never carries what was said in the huddle', () => {
    const digest = buildOfficeLogDigest([
      { at: at(11, 0), kind: 'huddle', colleagueId: 'gilfoyle', detail: 'the retry loop' }
    ]);
    expect(digest).toHaveLength(1);
    expect(digest[0]).toBe('11:00 the user and gilfoyle talked something through at their desk');
  });

  /**
   * Public — a chair pulled up to your desk is drawn by both renderers and has
   * witnesses, so this is the `walkby` case and not the `chat` one.
   */
  it('tells a desk conversation to somebody who was not in it', () => {
    const digest = buildOfficeLogDigest(
      [{ at: at(11, 0), kind: 'huddle', colleagueId: 'gilfoyle' }],
      { audience: 'dinesh' }
    );
    expect(digest).toHaveLength(1);
    expect(digest[0]).toContain('gilfoyle');
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

  /**
   * The POV convention, swept over the whole vocabulary rather than asserted on
   * the sentence somebody happened to be editing.
   *
   * Every line here lands in a prompt whose frame addresses the **colleague**
   * as "you" (`buildOfficeLogBlock`, under a system prompt that opens "You are
   * writing ONE office moment"). A digest line that says "you" therefore names
   * the reader, not the user — which is how the same defect on the
   * working-memory block had the model reporting 23 of 24 facts with the two
   * people swapped until the parties were named out loud
   * (`officeWorkingMemoryStore.js`, measured 2026-11-10; re-measured on these
   * two projections 2026-11-27 at 12 of 40 attributions reversed → 0 of 40).
   *
   * Swept over `OFFICE_LOG_KINDS` because the way this re-breaks is a
   * **sixteenth kind** written in the obvious register, not a reworded
   * fifteenth — and with the companion non-empty assertion the domain file
   * demands of a derived-set sweep, since a sweep over sentences that all came
   * back `''` would be green while examining nothing.
   */
  it('never addresses the user as "you", for any kind the log can record', () => {
    const PROBE_DETAILS = {
      run: 'mermaid',
      pitch: 'a retry box',
      email: 'does billing read the ledger?',
      chat: 'the reorg',
      battle: 'gilfoyle',
      meeting: 'left',
      errand: 'linda',
      training: '7',
      security: 'reported',
      levelUp: 'Senior Diagram Associate',
      prop: 'printer',
      interrupt: 'gotIt'
    };
    // One call per kind rather than one log of fifteen: the digest keeps only
    // the newest `MAX_LINES`, so a single batch would silently drop three.
    const digest = OFFICE_LOG_KINDS.flatMap((kind) =>
      buildOfficeLogDigest([
        {
          at: at(9, 0),
          kind,
          colleagueId: 'gilfoyle',
          ...(PROBE_DETAILS[kind] ? { detail: PROBE_DETAILS[kind] } : {})
        }
      ])
    );

    // Companion non-empty assertion: every kind in the vocabulary renders.
    expect(digest).toHaveLength(OFFICE_LOG_KINDS.length);

    for (const line of digest) {
      expect(line).not.toMatch(/\byou\b|\byour\b|\byours\b/i);
    }
    // And the party is named rather than merely un-addressed: the only line
    // that may omit the user is the one about nobody in particular.
    for (const line of digest) {
      if (/cubicle argument/.test(line)) continue;
      expect(line).toContain('the user');
    }
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
      'you and the user have crossed paths 2 times today, most recently at 09:40'
    );
    // Noun phrases with counts: who did what stays unambiguous across items.
    expect(lines[1]).toBe('that was: 1 email you sent the user, 1 chat with the user');
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
    expect(lines).toEqual(['you and the user have crossed paths once today, at 11:30']);
  });

  it('gives a taken suggestion its own line, because it changed the work', () => {
    const lines = buildOfficeRelationship(
      [
        { at: at(10, 0), kind: 'pitch', colleagueId: 'gilfoyle' },
        { at: at(10, 5), kind: 'chat', colleagueId: 'gilfoyle' }
      ],
      'gilfoyle'
    );
    expect(lines.at(-1)).toBe('the user took your suggestion earlier');

    const twice = buildOfficeRelationship(
      [
        { at: at(10, 0), kind: 'pitch', colleagueId: 'gilfoyle' },
        { at: at(12, 0), kind: 'pitch', colleagueId: 'gilfoyle' }
      ],
      'gilfoyle'
    );
    expect(twice.at(-1)).toBe('the user has taken 2 of your suggestions');
  });

  /**
   * The other half of the POV convention, and the sharper half: this block is
   * handed to one named speaker under the heading "You and this user, today
   * (yours alone)", so **the colleague is the "you"**. Naming them in the line
   * as well told them they had crossed paths with themselves — "you and
   * gilfoyle have crossed paths 3 times today", read by gilfoyle — which is why
   * the cast id is the thing that must be absent here and the thing that must
   * be *present* in the shared digest. Same facts, two audiences, opposite
   * rules; stating both as assertions is what stops a later reader "fixing" one
   * into the other.
   */
  it('never names the colleague it is handed to, because they are the "you"', () => {
    const lines = buildOfficeRelationship(
      [
        { at: at(9, 2), kind: 'email', colleagueId: 'gilfoyle' },
        { at: at(9, 40), kind: 'chat', colleagueId: 'gilfoyle' },
        { at: at(10, 0), kind: 'walkby', colleagueId: 'gilfoyle' },
        { at: at(10, 30), kind: 'pitch', colleagueId: 'gilfoyle' }
      ],
      'gilfoyle'
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain('gilfoyle');
      expect(line).toContain('the user');
    }
  });

  it('leaves a cubicle battle out, because its colleague is the winner not the correspondent', () => {
    // `battle` puts an id in `detail`, not `colleagueId`. Counting it would mean
    // reading one kind's detail as an id, and the fact is about the argument
    // rather than about the two of you — the global digest already says who won.
    expect(
      buildOfficeRelationship([{ at: at(9, 0), kind: 'battle', detail: 'gilfoyle' }], 'gilfoyle')
    ).toEqual([]);
  });

  /**
   * `interrupt` names a colleague and would therefore qualify, and is left out
   * on purpose: the person it names carries the richer version of the same
   * collision in working memory — a beat with the line they said in it — and
   * both blocks ride on the same `/moment` request. A count here would be the
   * third telling of one event in one prompt.
   */
  it('leaves an interruption out, because the person it names already remembers it', () => {
    expect(
      buildOfficeRelationship(
        [{ at: at(9, 0), kind: 'interrupt', colleagueId: 'intern', detail: 'gaveUp' }],
        'intern'
      )
    ).toEqual([]);
  });

  /**
   * `interrupt`'s exclusion at its strongest. A pair `huddle` names a colleague
   * and would qualify, and the person it names carries the exchange *verbatim*
   * on a working-memory beat that rides on the same `/moment` request — so "1
   * chat at your desk" here is a worse telling of the conversation than the
   * conversation. A mob carries no `colleagueId` and cannot reach this either
   * way.
   */
  it('leaves a desk conversation out, because the partner carries it verbatim', () => {
    expect(
      buildOfficeRelationship(
        [{ at: at(11, 0), kind: 'huddle', colleagueId: 'gilfoyle' }],
        'gilfoyle'
      )
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
