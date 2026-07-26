import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEETING_MAX_BEATS,
  MeetingScriptSchema,
  normalizeMeetingScript,
  OfficeMomentResponseSchema
} from '../src/officeScript.js';

const ATTENDEES = ['scrumMaster', 'barker', 'greybeard', 'intern'];

function beat(overrides: Record<string, unknown> = {}) {
  return {
    speakerId: 'scrumMaster',
    kind: 'procedural',
    text: 'Time-boxing this to whenever I lose control of it.',
    ...overrides
  };
}

function script(beats: unknown[]) {
  return { scriptVersion: 1, title: 'WG: Diagram Governance Sync (recurring)', beats };
}

test('OfficeMomentResponseSchema accepts a minimal email moment', () => {
  const parsed = OfficeMomentResponseSchema.parse({
    colleagueId: 'facilities',
    kind: 'email',
    subject: 'FRIDGE CLEANOUT FRIDAY',
    body: 'Anything unlabelled becomes property of Facilities.'
  });
  assert.equal(parsed.colleagueId, 'facilities');
  assert.equal(parsed.actionPrompt, undefined);
});

test('OfficeMomentResponseSchema rejects unknown moment kinds', () => {
  const result = OfficeMomentResponseSchema.safeParse({
    colleagueId: 'facilities',
    kind: 'fax',
    body: 'beep'
  });
  assert.equal(result.success, false);
});

test('OfficeMomentResponseSchema rejects an empty body', () => {
  const result = OfficeMomentResponseSchema.safeParse({
    colleagueId: 'intern',
    kind: 'im',
    body: ''
  });
  assert.equal(result.success, false);
});

test('MeetingScriptSchema parses a valid script', () => {
  const parsed = MeetingScriptSchema.parse(
    script([
      beat(),
      beat({ speakerId: 'intern', kind: 'smalltalk', text: 'did everyone see the fridge email' }),
      beat({
        speakerId: 'barker',
        kind: 'substantive',
        text: 'Merge Discovery and Research — the board hears one phase.',
        actionPrompt: 'Merge the Discovery and Research nodes into one phase'
      })
    ])
  );
  assert.equal(parsed.beats.length, 3);
  assert.equal(parsed.beats[2]?.actionPrompt?.startsWith('Merge'), true);
});

test('MeetingScriptSchema rejects over-long beat text', () => {
  const result = MeetingScriptSchema.safeParse(script([beat({ text: 'x'.repeat(281) })]));
  assert.equal(result.success, false);
});

test('normalizeMeetingScript drops hallucinated speakers and caps beats', () => {
  const beats = [
    ...Array.from({ length: MEETING_MAX_BEATS + 4 }, (_, i) =>
      beat({
        speakerId: ATTENDEES[i % ATTENDEES.length],
        kind: i === 2 ? 'substantive' : 'smalltalk',
        text: `beat ${i}`
      })
    ),
    beat({ speakerId: 'theCeo', kind: 'offRails', text: 'Love this. Whatever it is.' })
  ];
  const normalized = normalizeMeetingScript(MeetingScriptSchema.parse(script(beats)), ATTENDEES);
  assert.ok(normalized);
  assert.equal(normalized.beats.length, MEETING_MAX_BEATS);
  assert.equal(
    normalized.beats.every((b) => ATTENDEES.includes(b.speakerId)),
    true
  );
});

test('normalizeMeetingScript strips actionPrompt from non-substantive beats', () => {
  const beats = Array.from({ length: 8 }, (_, i) =>
    beat({
      speakerId: ATTENDEES[i % ATTENDEES.length],
      kind: i === 0 ? 'substantive' : 'smalltalk',
      text: `beat ${i}`,
      actionPrompt: 'Rename everything'
    })
  );
  const normalized = normalizeMeetingScript(MeetingScriptSchema.parse(script(beats)), ATTENDEES);
  assert.ok(normalized);
  assert.equal(normalized.beats[0]?.actionPrompt, 'Rename everything');
  assert.equal(
    normalized.beats.slice(1).every((b) => b.actionPrompt === undefined),
    true
  );
});

test('normalizeMeetingScript returns null without a substantive beat', () => {
  const beats = Array.from({ length: 8 }, (_, i) =>
    beat({ speakerId: ATTENDEES[i % ATTENDEES.length], kind: 'smalltalk', text: `beat ${i}` })
  );
  const normalized = normalizeMeetingScript(MeetingScriptSchema.parse(script(beats)), ATTENDEES);
  assert.equal(normalized, null);
});

test('normalizeMeetingScript returns null when too few beats survive the allowlist', () => {
  const beats = [
    beat({ kind: 'substantive' }),
    ...Array.from({ length: 7 }, (_, i) =>
      beat({ speakerId: 'uninvited', kind: 'smalltalk', text: `crash ${i}` })
    )
  ];
  const normalized = normalizeMeetingScript(MeetingScriptSchema.parse(script(beats)), ATTENDEES);
  assert.equal(normalized, null);
});
