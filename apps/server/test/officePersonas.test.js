import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMeetingSystemPrompt,
  buildMomentSystemPrompt,
  buildMomentUserPrompt,
  createOfficeChatModel,
  isOfficeColleague,
  isOfficeSpeaker,
  normalizeAttendees,
  OFFICE_COLLEAGUES,
  parseInterjectReply,
  parseMeetingScript,
  parseMomentReply,
  SENIOR_MEETING_VOICES,
  STAKEHOLDER_MEETING_VOICES
} from '../src/agents/officePersonas.js';

const ATTENDEES = ['scrumMaster', 'exec', 'greybeard', 'intern'];

test('office colleague registry covers the v1 cast and stakeholders stay separate', () => {
  for (const id of ['intern', 'scrumMaster', 'helpdesk', 'facilities', 'hr', 'greybeard']) {
    assert.equal(isOfficeColleague(id), true, `${id} should be a colleague`);
    assert.ok(OFFICE_COLLEAGUES[id].voice.length > 40, `${id} needs a real voice block`);
  }
  assert.equal(isOfficeColleague('exec'), false);
  assert.equal(isOfficeSpeaker('exec'), true);
  assert.equal(isOfficeSpeaker('ceo'), false);
});

test('senior stakeholders are valid meeting speakers with real voice blocks', () => {
  for (const id of ['cto', 'cfo']) {
    assert.equal(isOfficeSpeaker(id), true, `${id} should be able to take a seat`);
    assert.equal(isOfficeColleague(id), false, `${id} is not an ambient colleague`);
    assert.ok(SENIOR_MEETING_VOICES[id].voice.length > 40, `${id} needs a real voice block`);
  }
  // Seated seniors must be introduced by name, not by bare id, in the script prompt.
  const prompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'cfo', 'refine'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(prompt, /Diane \(CFO/);
  assert.match(prompt, /speakerId "cfo"/);
  assert.match(prompt, /Senior attendees/);
});

test('moment system prompt carries the voice, strict-JSON rule, and kind rules', () => {
  const prompt = buildMomentSystemPrompt({ kind: 'email', colleagueId: 'facilities' });
  assert.match(prompt, /Fridge Czar/);
  assert.match(prompt, /STRICT JSON only/);
  assert.match(prompt, /"subject"/);
  const walkby = buildMomentSystemPrompt({ kind: 'walkby', colleagueId: 'greybeard' });
  assert.match(walkby, /ALOUD/);
  assert.match(walkby, /voice.*not a \*topic\*/s);
});

test('moment user prompt lists labels and recent moments', () => {
  const prompt = buildMomentUserPrompt({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n A-->B',
    visibleLabels: ['Bake', 'Slice'],
    recentMoments: ['fridge email']
  });
  assert.match(prompt, /- Bake/);
  assert.match(prompt, /- fridge email/);
  assert.match(prompt, /flowchart TD/);
});

test('meeting system prompt seats only the attendees and names the facilitator', () => {
  const prompt = buildMeetingSystemPrompt({ attendees: ATTENDEES, facilitatorId: 'scrumMaster' });
  assert.match(prompt, /speakerId "scrumMaster"/);
  assert.match(prompt, /speakerId "greybeard"/);
  assert.doesNotMatch(prompt, /speakerId "critique"/);
  assert.match(prompt, /procedural beat from "scrumMaster"/);
  assert.ok(STAKEHOLDER_MEETING_VOICES.exec.includes('Synergy'));
});

test('parseMomentReply tolerates fenced JSON and clamps output', () => {
  const raw =
    '```json\n{"subject":"FRIDGE","body":"  The fridge WILL be cleaned. ","actionPrompt":""}\n```';
  const moment = parseMomentReply(raw, { colleagueId: 'facilities', kind: 'email' });
  assert.ok(moment);
  assert.equal(moment.body, 'The fridge WILL be cleaned.');
  assert.equal(moment.subject, 'FRIDGE');
  assert.equal(moment.actionPrompt, undefined);
});

test('parseMomentReply returns null on prose or missing body', () => {
  assert.equal(
    parseMomentReply('Sure! Here is your email.', { colleagueId: 'hr', kind: 'email' }),
    null
  );
  assert.equal(parseMomentReply('{"subject":"hi"}', { colleagueId: 'hr', kind: 'email' }), null);
});

test('parseMeetingScript massages stray kinds and enforces the attendee allowlist', () => {
  const beats = [
    { speakerId: 'scrumMaster', kind: 'procedural', text: 'Welcome! Time-boxed to 15.' },
    { speakerId: 'intern', kind: 'vibes', text: 'did everyone see the fridge email' },
    {
      speakerId: 'exec',
      kind: 'substantive',
      text: 'Merge Discovery and Research.',
      actionPrompt: 'Merge the Discovery and Research nodes into one phase'
    },
    { speakerId: 'ghost', kind: 'smalltalk', text: 'I was never invited.' },
    { speakerId: 'greybeard', kind: 'offRails', text: 'We had this diagram in 2009.' },
    { speakerId: 'intern', kind: 'smalltalk', text: 'wait we have a mainframe?' },
    { speakerId: 'exec', kind: 'smalltalk', text: 'Hard stop in four minutes.' },
    {
      speakerId: 'scrumMaster',
      kind: 'procedural',
      text: 'Parking-lotting all of this. Great energy!'
    }
  ];
  const script = parseMeetingScript(JSON.stringify({ title: 'WG: Sync', beats }), {
    attendees: ATTENDEES
  });
  assert.ok(script);
  assert.equal(script.scriptVersion, 1);
  assert.equal(script.beats.length, 7);
  assert.equal(script.beats[1].kind, 'smalltalk');
  assert.equal(
    script.beats.every((b) => ATTENDEES.includes(b.speakerId)),
    true
  );
});

test('parseMeetingScript returns null when no substantive beat survives', () => {
  const beats = Array.from({ length: 8 }, (_, i) => ({
    speakerId: ATTENDEES[i % ATTENDEES.length],
    kind: 'smalltalk',
    text: `beat ${i}`
  }));
  assert.equal(
    parseMeetingScript(JSON.stringify({ title: 'WG', beats }), { attendees: ATTENDEES }),
    null
  );
});

test('parseInterjectReply keeps only attendee beats and caps the tail', () => {
  const beats = Array.from({ length: 12 }, (_, i) => ({
    speakerId: i % 2 === 0 ? 'intern' : 'ghost',
    kind: 'smalltalk',
    text: `reaction ${i}`
  }));
  const parsed = parseInterjectReply(JSON.stringify({ beats }), { attendees: ATTENDEES });
  assert.ok(parsed);
  assert.equal(parsed.length, 6);
  assert.equal(
    parsed.every((b) => b.speakerId === 'intern'),
    true
  );
});

test('normalizeAttendees dedupes, drops unknowns, and enforces seat bounds', () => {
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'scrumMaster', 'exec', 'nobody', 'intern']), [
    'scrumMaster',
    'exec',
    'intern'
  ]);
  assert.equal(normalizeAttendees(['scrumMaster', 'exec']), null);
  assert.equal(
    normalizeAttendees(['scrumMaster', 'exec', 'intern', 'greybeard', 'critique']),
    null
  );
  // A steering-meeting roster (facilitator + seniors + a team presenter) must survive.
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'cto', 'cfo', 'refine']), [
    'scrumMaster',
    'cto',
    'cfo',
    'refine'
  ]);
});

test('createOfficeChatModel returns null when no LLM is configured', () => {
  const model = createOfficeChatModel({}, { purpose: 'moment' });
  assert.equal(model, null);
});
