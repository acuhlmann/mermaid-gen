import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHuddleSystemPrompt,
  buildInterjectSystemPrompt,
  buildMeetingSystemPrompt,
  buildMeetingUserPrompt,
  buildInterjectUserPrompt,
  buildMomentSystemPrompt,
  parseHuddleScript,
  buildOfficeLanguageRule,
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

const ATTENDEES = ['scrumMaster', 'barker', 'greybeard', 'intern'];

test('office colleague registry covers the v1 cast and stakeholders stay separate', () => {
  for (const id of ['intern', 'scrumMaster', 'helpdesk', 'facilities', 'hr', 'greybeard']) {
    assert.equal(isOfficeColleague(id), true, `${id} should be a colleague`);
    assert.ok(OFFICE_COLLEAGUES[id].voice.length > 40, `${id} needs a real voice block`);
  }
  assert.equal(isOfficeColleague('barker'), false);
  assert.equal(isOfficeSpeaker('barker'), true);
  assert.equal(isOfficeSpeaker('exec'), false);
  assert.equal(isOfficeSpeaker('ceo'), false);
});

test('senior stakeholders are valid meeting speakers with real voice blocks', () => {
  for (const id of ['belson', 'cfo']) {
    assert.equal(isOfficeSpeaker(id), true, `${id} should be able to take a seat`);
    assert.equal(isOfficeColleague(id), false, `${id} is not an ambient colleague`);
    assert.ok(SENIOR_MEETING_VOICES[id].voice.length > 40, `${id} needs a real voice block`);
  }
  // Marcus/`cto` retired when Belson landed.
  assert.equal(isOfficeSpeaker('cto'), false);
  assert.equal(isOfficeSpeaker('marcus'), false);
  // Barker's voice card lives with the six stakeholder voices, not the invented execs.
  assert.equal(isOfficeSpeaker('barker'), true);
  assert.equal(isOfficeColleague('barker'), false);
  assert.ok(STAKEHOLDER_MEETING_VOICES.barker.length > 40, 'barker needs a real voice card');
  // Seated seniors must be introduced by name, not by bare id, in the script prompt.
  const prompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'cfo', 'gilfoyle'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(prompt, /Diane \(CFO/);
  assert.match(prompt, /speakerId "cfo"/);
  assert.match(prompt, /Senior attendees/);
  // Gavin Belson (Silicon Valley named CTO replication): name+title label + voice card.
  const belsonPrompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'belson', 'barker'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(belsonPrompt, /Gavin Belson \(CTO/);
  assert.match(belsonPrompt, /You are Gavin Belson from HBO's Silicon Valley/);
  assert.match(belsonPrompt, /TWO GEARS|cold fury|fuck/i);
  assert.match(belsonPrompt, /speakerId "belson"/);
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'belson', 'barker']), [
    'scrumMaster',
    'belson',
    'barker'
  ]);
  // Jack Barker (Silicon Valley replication experiment): the card heading is the bare id
  // (stakeholder voices have no name/title label), but the voice card itself names him.
  const barkerPrompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'barker', 'gilfoyle'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(barkerPrompt, /You are Jack Barker from HBO's Silicon Valley, the CEO/);
  assert.match(barkerPrompt, /speakerId "barker"/);
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'barker', 'gilfoyle']), [
    'scrumMaster',
    'barker',
    'gilfoyle'
  ]);
  // Bertram Gilfoyle inherited the team `refine` seat — same table-driven path as Barker,
  // but his card sits with the team stakeholders because the seat is a transform seat.
  const gilfoylePrompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'gilfoyle', 'jared'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(gilfoylePrompt, /You are Bertram Gilfoyle from HBO's Silicon Valley/);
  assert.match(gilfoylePrompt, /speakerId "gilfoyle"/);
  assert.ok(STAKEHOLDER_MEETING_VOICES.gilfoyle.length > 40, 'gilfoyle needs a real voice card');
  // Dinesh Chugtai took a NEW seventh seat rather than inheriting one, so both
  // engineers must resolve independently and neither may shadow the other.
  const dineshPrompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'dinesh', 'gilfoyle'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(dineshPrompt, /You are Dinesh Chugtai from HBO's Silicon Valley/);
  assert.match(dineshPrompt, /speakerId "dinesh"/);
  assert.match(dineshPrompt, /You are Bertram Gilfoyle from HBO's Silicon Valley/);
  assert.ok(STAKEHOLDER_MEETING_VOICES.dinesh.length > 40, 'dinesh needs a real voice card');
  assert.equal(isOfficeSpeaker('dinesh'), true);
  assert.equal(isOfficeColleague('dinesh'), false);
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'dinesh', 'gilfoyle']), [
    'scrumMaster',
    'dinesh',
    'gilfoyle'
  ]);
  // The retired generic persona id must not linger anywhere in the speaker tables.
  assert.equal(isOfficeSpeaker('refine'), false);
  assert.equal(Object.hasOwn(STAKEHOLDER_MEETING_VOICES, 'refine'), false);
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

test('moment reply mode tells IM and email to acknowledge the user and glance at the canvas', () => {
  const imReply = buildMomentSystemPrompt({
    kind: 'im',
    colleagueId: 'intern',
    isReply: true
  });
  assert.match(imReply, /IM REPLY MODE/);
  assert.match(imReply, /visible label|canvas/i);

  const emailReply = buildMomentSystemPrompt({
    kind: 'email',
    colleagueId: 'hr',
    isReply: true
  });
  assert.match(emailReply, /EMAIL REPLY MODE/);
  assert.match(emailReply, /visible label|canvas/i);
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
  assert.doesNotMatch(prompt, /speakerId "jared"/);
  assert.match(prompt, /procedural beat from "scrumMaster"/);
  assert.ok(STAKEHOLDER_MEETING_VOICES.barker.includes('Success Theater made flesh'));
});

/*
 * Ported from PR #233 (written before the refine->gilfoyle rename, so it conflicted
 * and was never merged). Sessions 3-4 rewrote this file's fixtures and displaced the
 * only erlich meeting-voice assertion in the repo; without this the incubator anchor
 * could be dropped and nothing would fail.
 */
test('erlich meeting voice card anchors the Silicon Valley replication', () => {
  assert.ok(STAKEHOLDER_MEETING_VOICES.erlich.includes('Erlich Bachman'));
  assert.ok(STAKEHOLDER_MEETING_VOICES.erlich.includes('Aviato'));

  const prompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'erlich', 'gilfoyle'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(prompt, /Erlich Bachman from HBO's Silicon Valley/);
  assert.match(prompt, /speakerId "erlich"/);
  assert.equal(isOfficeSpeaker('erlich'), true);
  assert.equal(isOfficeColleague('erlich'), false);
});

test('jared meeting voice card anchors the Silicon Valley replication', () => {
  assert.ok(STAKEHOLDER_MEETING_VOICES.jared.includes('Jared Dunn'));
  assert.ok(STAKEHOLDER_MEETING_VOICES.jared.includes("HBO's Silicon Valley"));
  assert.ok(STAKEHOLDER_MEETING_VOICES.jared.length > 40, 'jared needs a real voice card');
  assert.equal(isOfficeSpeaker('jared'), true);
  assert.equal(isOfficeColleague('jared'), false);
  assert.equal(isOfficeSpeaker('critique'), false);
  assert.equal(Object.hasOwn(STAKEHOLDER_MEETING_VOICES, 'critique'), false);

  const prompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'jared', 'gilfoyle'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(prompt, /Jared Dunn from HBO's Silicon Valley/);
  assert.match(prompt, /speakerId "jared"/);
});

test('russ meeting voice card anchors the Silicon Valley replication', () => {
  assert.ok(STAKEHOLDER_MEETING_VOICES.russ.includes('Russ Hanneman'));
  assert.ok(STAKEHOLDER_MEETING_VOICES.russ.includes("HBO's Silicon Valley"));
  assert.ok(STAKEHOLDER_MEETING_VOICES.russ.includes('tres commas'));
  assert.ok(
    /fuck/i.test(STAKEHOLDER_MEETING_VOICES.russ),
    'russ meeting voice should allow TV-Russ swearing'
  );
  assert.ok(STAKEHOLDER_MEETING_VOICES.russ.length > 40, 'russ needs a real voice card');
  assert.equal(isOfficeSpeaker('russ'), true);
  assert.equal(isOfficeColleague('russ'), false);
  assert.equal(isOfficeSpeaker('goMad'), false);
  assert.equal(Object.hasOwn(STAKEHOLDER_MEETING_VOICES, 'goMad'), false);

  const prompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'russ', 'gilfoyle'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(prompt, /Russ Hanneman from HBO's Silicon Valley/);
  assert.match(prompt, /speakerId "russ"/);
});

test('richard meeting voice card anchors the Silicon Valley replication', () => {
  assert.ok(STAKEHOLDER_MEETING_VOICES.richard.includes('Richard Hendricks'));
  assert.ok(STAKEHOLDER_MEETING_VOICES.richard.includes("HBO's Silicon Valley"));
  assert.ok(STAKEHOLDER_MEETING_VOICES.richard.includes('anxious'));
  assert.ok(STAKEHOLDER_MEETING_VOICES.richard.length > 40, 'richard needs a real voice card');
  assert.equal(isOfficeSpeaker('richard'), true);
  assert.equal(isOfficeColleague('richard'), false);
  assert.equal(isOfficeSpeaker('explain'), false);
  assert.equal(Object.hasOwn(STAKEHOLDER_MEETING_VOICES, 'explain'), false);

  const prompt = buildMeetingSystemPrompt({
    attendees: ['scrumMaster', 'richard', 'gilfoyle'],
    facilitatorId: 'scrumMaster'
  });
  assert.match(prompt, /Richard Hendricks from HBO's Silicon Valley/);
  assert.match(prompt, /speakerId "richard"/);
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
      speakerId: 'barker',
      kind: 'substantive',
      text: 'Merge Discovery and Research.',
      actionPrompt: 'Merge the Discovery and Research nodes into one phase'
    },
    { speakerId: 'ghost', kind: 'smalltalk', text: 'I was never invited.' },
    { speakerId: 'greybeard', kind: 'offRails', text: 'We had this diagram in 1979.' },
    { speakerId: 'intern', kind: 'smalltalk', text: 'wait we have a mainframe?' },
    { speakerId: 'barker', kind: 'smalltalk', text: 'Hard stop in four minutes.' },
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
  assert.deepEqual(
    normalizeAttendees(['scrumMaster', 'scrumMaster', 'barker', 'nobody', 'intern']),
    ['scrumMaster', 'barker', 'intern']
  );
  // Huddle floor: two seats is enough (1:1 + facilitator, or two peers).
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'barker']), ['scrumMaster', 'barker']);
  assert.equal(normalizeAttendees(['scrumMaster']), null);
  // Group ceiling matches the /meeting route (8).
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'barker', 'intern', 'greybeard', 'jared']), [
    'scrumMaster',
    'barker',
    'intern',
    'greybeard',
    'jared'
  ]);
  // A steering-meeting roster (facilitator + seniors + a team presenter) must survive.
  assert.deepEqual(normalizeAttendees(['scrumMaster', 'belson', 'cfo', 'gilfoyle']), [
    'scrumMaster',
    'belson',
    'cfo',
    'gilfoyle'
  ]);
});

test('createOfficeChatModel returns null when no LLM is configured', () => {
  const model = createOfficeChatModel({}, { purpose: 'moment' });
  assert.equal(model, null);
});

test('office language rule follows the UI locale, not the diagram script', () => {
  assert.match(buildOfficeLanguageRule('zh-CN'), /Simplified Chinese \(zh-CN\)/);
  assert.match(buildOfficeLanguageRule('zh-TW'), /Traditional Chinese \(zh-TW\)/);
  // Case / region tolerance — the client sends whatever mailAnnounceLang holds.
  assert.match(buildOfficeLanguageRule('zh-cn'), /Simplified Chinese/);
  assert.match(buildOfficeLanguageRule('cmn-TW'), /Traditional Chinese/);
  // Each variant must exclude the other, or TTS gets the wrong script.
  assert.doesNotMatch(buildOfficeLanguageRule('zh-CN'), /Write EVERY[\s\S]*Traditional Chinese \(/);
  // English locales stay clause-free so the prompt is unchanged for them.
  for (const locale of ['en', 'en-US', 'en-AU', '', undefined, null]) {
    assert.equal(buildOfficeLanguageRule(locale), '', `${locale} should add no clause`);
  }
});

test('user prompts restate the language as their final instruction', () => {
  // Recency: the system-prompt rule alone lost to the personas' English
  // catchphrases on short moments, so the reminder must be the LAST thing read.
  const moment = buildMomentUserPrompt({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n A-->B',
    visibleLabels: ['A'],
    recentMoments: [],
    uiLocale: 'zh-CN'
  });
  assert.match(moment.trimEnd(), /Simplified Chinese \(zh-CN\)\.$/);

  const meeting = buildMeetingUserPrompt({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n A-->B',
    visibleLabels: ['A'],
    uiLocale: 'zh-TW'
  });
  assert.match(meeting.trimEnd(), /Traditional Chinese \(zh-TW\)\.$/);

  const interject = buildInterjectUserPrompt({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n A-->B',
    visibleLabels: ['A'],
    transcriptSoFar: ['scrumMaster: hi'],
    interjection: 'what about cost?',
    uiLocale: 'zh-CN'
  });
  assert.match(interject.trimEnd(), /Simplified Chinese \(zh-CN\)\.$/);

  // English locales must leave the tail instruction untouched.
  assert.match(
    buildMomentUserPrompt({ visibleLabels: [], recentMoments: [] }).trimEnd(),
    /Reply with strict JSON now\.$/
  );
});

test('language rule tells the model to adapt English catchphrases', () => {
  // The personas quote English lines verbatim; without this the model copies
  // them through and the reply reverts to English.
  assert.match(buildOfficeLanguageRule('zh-CN'), /ATTITUDE, not text to copy/);
});

test('all three office prompt builders honour uiLocale', () => {
  const moment = buildMomentSystemPrompt({ kind: 'im', colleagueId: 'intern', uiLocale: 'zh-CN' });
  assert.match(moment, /Simplified Chinese \(zh-CN\)/);

  const meeting = buildMeetingSystemPrompt({
    attendees: ATTENDEES,
    facilitatorId: 'scrumMaster',
    uiLocale: 'zh-TW'
  });
  assert.match(meeting, /Traditional Chinese \(zh-TW\)/);

  // Interject composes the meeting prompt — the locale must survive the nesting,
  // otherwise a raised hand flips the room back to English mid-meeting.
  const interject = buildInterjectSystemPrompt({
    attendees: ATTENDEES,
    facilitatorId: 'scrumMaster',
    uiLocale: 'zh-TW'
  });
  assert.match(interject, /Traditional Chinese \(zh-TW\)/);
  assert.match(interject, /INTERJECTION MODE/);

  // Omitting the locale must leave the English prompts byte-identical.
  assert.equal(
    buildMeetingSystemPrompt({ attendees: ATTENDEES, facilitatorId: 'scrumMaster' }),
    buildMeetingSystemPrompt({
      attendees: ATTENDEES,
      facilitatorId: 'scrumMaster',
      uiLocale: 'en-US'
    })
  );
});

test('parseHuddleScript returns one remark per attendee, in attendee order', () => {
  // The overlay seats the ring before the LLM answers, so the parser must hand
  // back seats in the order they were drawn — not the order the model replied in.
  const raw = JSON.stringify({
    beats: [
      { speakerId: 'erlich', text: 'What if Auth were a platform?' },
      { speakerId: 'gilfoyle', text: 'Auth is doing two jobs.', actionPrompt: 'Split Auth in two' },
      { speakerId: 'dinesh', text: 'I said that last week.' }
    ]
  });
  const script = parseHuddleScript(raw, { attendees: ['gilfoyle', 'dinesh', 'erlich'] });
  assert.deepEqual(
    script.beats.map((b) => b.speakerId),
    ['gilfoyle', 'dinesh', 'erlich']
  );
  assert.equal(script.beats[0].actionPrompt, 'Split Auth in two');
});

test('parseHuddleScript drops strangers and keeps the first line per teammate', () => {
  const raw = JSON.stringify({
    beats: [
      { speakerId: 'gilfoyle', text: 'First.' },
      { speakerId: 'gilfoyle', text: 'Second — should not overwrite.' },
      { speakerId: 'theCeo', text: 'I was not invited.' },
      { speakerId: 'dinesh', text: 'Mine.' }
    ]
  });
  const script = parseHuddleScript(raw, { attendees: ['gilfoyle', 'dinesh'] });
  assert.equal(script.beats.length, 2);
  assert.equal(script.beats[0].text, 'First.');
  assert.ok(!script.beats.some((b) => b.speakerId === 'theCeo'));
});

test('parseHuddleScript returns null when nobody usable spoke', () => {
  assert.equal(parseHuddleScript('not json at all', { attendees: ['gilfoyle', 'dinesh'] }), null);
  assert.equal(
    parseHuddleScript(JSON.stringify({ beats: [{ speakerId: 'gilfoyle', text: '  ' }] }), {
      attendees: ['gilfoyle', 'dinesh']
    }),
    null
  );
});

test('buildHuddleSystemPrompt names every attendee and forbids a facilitator', () => {
  const prompt = buildHuddleSystemPrompt({
    attendees: ['gilfoyle', 'dinesh'],
    uiLocale: 'en-US'
  });
  assert.match(prompt, /speakerId "gilfoyle"/);
  assert.match(prompt, /speakerId "dinesh"/);
  assert.match(prompt, /EXACTLY one beat per person/);
  assert.match(prompt, /No facilitation/);
});

test('buildHuddleSystemPrompt refresh mode only scripts remaining teammates', () => {
  const prompt = buildHuddleSystemPrompt({
    attendees: ['gilfoyle', 'dinesh', 'erlich'],
    uiLocale: 'en-US',
    priorBeats: [{ speakerId: 'gilfoyle', text: 'Still blank.' }]
  });
  assert.match(prompt, /REFRESH MODE/);
  assert.match(prompt, /speakerId "dinesh"/);
  assert.match(prompt, /speakerId "erlich"/);
  assert.doesNotMatch(prompt, /speakerId "gilfoyle"/);
});
