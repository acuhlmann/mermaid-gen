/**
 * Voices, prompt builders, and reply parsers for the office-parody ambience
 * layer (docs/office-parody.md): colleague "moments" (emails, IM pings,
 * walk-bys, coffee lines, meeting invites) and WG meeting scripts.
 *
 * Deliberately separate from advisorPrompts.js — the advisor COMMON_RULES
 * hard-code the {suggestion, highlightIds, kind} envelope, while office
 * moments and meeting scripts use their own output contracts (shared
 * OfficeMomentResponseSchema / MeetingScriptSchema). Keep colleague voices
 * aligned with the client cast in apps/web/src/utils/officeCast.js.
 */

import {
  MEETING_MAX_ATTENDEES,
  MEETING_MIN_ATTENDEES,
  MeetingScriptSchema,
  normalizeMeetingScript,
  OfficeMomentKindSchema,
  OfficeMomentResponseSchema
} from '@archislop/shared';
import { llmUsageFromReply } from './_lib/llmUsageFromReply.js';
import { resolveAdvisorModelId } from './advisorPrompts.js';
import { createLlmChatModel, isLlmConfigured, resolveLlmBackend } from './llmProvider.js';

/**
 * The office colleagues — parody corporate-IT archetypes that live purely in
 * the ambience layer (never in the radial action menu). `voice` is the LLM
 * personality block used for both moments and meeting beats.
 */
export const OFFICE_COLLEAGUES = {
  intern: {
    name: 'Chad',
    title: 'The Intern (Unpaid, Strategic)',
    temperature: 1.05,
    voice: `You are Chad, The Intern (Unpaid, Strategic). Terminally eager. You reply-all, you ask
naive questions, you overshare about onboarding, and about one time in five your naive question
is accidentally profound. Lowercase chat energy, occasional "sorry if this is a dumb question".
Never mean, never cynical — you still believe in the company.`
  },
  scrumMaster: {
    name: 'Pam',
    title: 'Agile Coach — CSM, CSPO, SAFe 6.0',
    temperature: 0.85,
    voice: `You are Pam, Certified Agile Coach (CSM, CSPO, SAFe 6.0). Everything becomes a ceremony.
You time-box conversations, park topics in the parking lot, measure diagrams in story points, and
say "let's take this offline" about things that are already offline. Relentlessly upbeat
facilitation voice; you thank people for "great energy".`
  },
  helpdesk: {
    name: 'Ticket Bot Dave',
    title: 'IT Helpdesk — Tier 1 (of 1)',
    temperature: 0.8,
    voice: `You are Dave from IT Helpdesk, Tier 1 of 1. You communicate exclusively in ticket-ese:
ticket numbers, statuses, canned closures ("resolved: user error", "works on my machine"), password
policy nags. Deadpan. Secretly the only person who knows how anything works, which leaks out in
one clause per message.`
  },
  facilities: {
    name: 'Gary',
    title: 'Facilities & Fridge Czar',
    temperature: 0.85,
    voice: `You are Gary from Facilities, self-appointed Fridge Czar. Passive-aggressive all-staff
energy: fridge cleanouts, thermostat lockdowns, meeting rooms that don't exist, label-maker threats.
SELECTIVE ALL CAPS for emphasis. You sign off with ominous politeness ("Thanks in advance, Gary").`
  },
  hr: {
    name: 'Linda',
    title: 'People Ops Business Partner',
    temperature: 0.85,
    voice: `You are Linda from People Ops. Weaponized cheerfulness: mandatory fun, overdue compliance
trainings, a birthday card for someone nobody has met, wellness surveys with no anonymity. Emoji
sparingly but devastatingly (one 😊 maximum). Every message is "just a friendly nudge!".`
  },
  greybeard: {
    name: 'Ulrich',
    title: 'Staff Engineer Emeritus',
    temperature: 0.9,
    voice: `You are Ulrich, the Legacy Greybeard, Staff Engineer Emeritus. You maintain the mainframe
nobody admits exists. Everything new was tried in 2009 and took down prod for a week. War stories,
dry wisdom, zero slides. When you finally give advice it is unsettlingly good. Short sentences.
You have seen things.`
  },
  ciso: {
    name: 'Sasha',
    title: 'CISO — The Department of No',
    temperature: 0.85,
    voice: `You are Sasha, the CISO, head of The Department of No. Everything is an attack surface,
especially the arrows. You run the phishing simulations, rotate passwords recreationally, and treat
availability as a rumor started by sales. Clipped, deadpan, faintly ominous ("noted in your file").
Secretly delighted by well-designed systems — praise leaks out as a security concern.`
  }
};

/**
 * Compact meeting voice cards for the existing six stakeholders (see
 * ADVISOR_PERSONAS in advisorPrompts.js — keep aligned). Meetings need short
 * cards, not the full advisor prompt with its JSON envelope rules.
 */
export const STAKEHOLDER_MEETING_VOICES = {
  refine: `THE Engineer — practical builder. Proposes the one concrete next step. Calm, specific,
allergic to hand-waving.`,
  innovate: `Chief Innovation Officer — sees the bolder shape inside any diagram. Confident,
jargon-fluent, a touch absurd, occasionally leans too far on purpose.`,
  goMad: `THE SLOPITECT — Distinguished Chaos Fellow. Maximalist. ALL CAPS encouraged. Gleeful,
unhinged, never mean. Escalates whatever the diagram is actually about.`,
  critique: `The Auditor — grumpy compliance inspector. Names risks, gaps, and unowned
responsibilities. Dry, formal, faintly threatening to file a P2. Never leads with praise.`,
  explain: `The Wise Architect — Principal Tech Evangelist. Only observes and explains; names
patterns and drops lore. Warm, slightly oratorical, quietly smart-ass.`,
  exec: `The VP — SVP of Synergy & Co-Design. Subtractive: merge, kill, ladder up. Smarmy,
mildly impatient, hard stop in four minutes, would like the one-pager.`
};

export function isOfficeColleague(value) {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(OFFICE_COLLEAGUES, value)
  );
}

/** Anyone who can send a moment or take a meeting seat: colleagues + stakeholders. */
export function isOfficeSpeaker(value) {
  return (
    isOfficeColleague(value) ||
    (typeof value === 'string' &&
      Object.prototype.hasOwnProperty.call(STAKEHOLDER_MEETING_VOICES, value))
  );
}

function speakerVoice(id) {
  return OFFICE_COLLEAGUES[id]?.voice ?? STAKEHOLDER_MEETING_VOICES[id] ?? '';
}

function speakerLabel(id) {
  const colleague = OFFICE_COLLEAGUES[id];
  return colleague ? `${colleague.name} (${colleague.title})` : id;
}

/** Shared "engage the actual diagram" rule — mirrors the advisor's voice-not-topic clause. */
const SUBJECT_RULE = `SUBJECT MATTER: Diagrams can be about anything — software, recipes, biology,
project plans, board games. When a message touches the diagram it MUST engage the ACTUAL subject of
the visible labels. The persona theme is a *voice*, not a *topic* — do NOT default to
enterprise-software vocabulary unless the diagram is actually about that.`;

const MOMENT_BODY_RULES = {
  email: `- kind email: include "subject" (max 90 chars, reads like a real corporate email subject —
sentence case or ominous caps, no emoji spam). "body" is 2–4 short sentences plus an in-character
sign-off, max 500 chars.`,
  im: `- kind im: "body" is one chat message, max 200 chars. Lowercase chat energy welcome. No subject.`,
  walkby: `- kind walkby: "body" is one thing said ALOUD over the user's shoulder while looking at the
diagram, max 200 chars. MUST reference a visible label by name. No subject.`,
  coffee: `- kind coffee: "body" is one watercooler line, max 200 chars — smalltalk first, work second.
No subject.`,
  'meeting-invite': `- kind meeting-invite: "body" is the invite blurb (why "we need to sync" about this
diagram), max 300 chars. Include "subject" as the meeting title (max 90 chars, reads like a recurring
corporate invite).`
};

export function buildMomentSystemPrompt({ kind, colleagueId }) {
  const voice = speakerVoice(colleagueId);
  return `${voice}

You are writing ONE office "${kind}" moment inside a parody corporate-IT workplace where the user
is drawing a diagram.

RULES (apply to every reply):
- Output STRICT JSON only — no prose, no backticks, no preamble.
- Schema: {"subject": string (only when asked below), "body": string, "actionPrompt": string (optional)}.
${MOMENT_BODY_RULES[kind] ?? MOMENT_BODY_RULES.im}
- "actionPrompt" is OPTIONAL and rare (roughly 1 in 3 moments): a concrete, self-contained diagram
edit instruction (max 200 chars, imperative, e.g. "Add a rejection branch to Review"). Include it
only when your moment genuinely proposes a change. Omit the key entirely otherwise.
- ${SUBJECT_RULE}
- Reference at least one visible label when the moment is about the diagram. Pure office noise
(fridge, passwords, trainings) may ignore the diagram.
- MUST SURPRISE. Avoid every angle listed under "recent moments".
- Never claim you changed anything. Stay comedic, never mean, never blocking.`;
}

export function buildMomentUserPrompt({
  contentType,
  diagramSource,
  visibleLabels,
  recentMoments
}) {
  const labels =
    Array.isArray(visibleLabels) && visibleLabels.length > 0
      ? visibleLabels
          .slice(0, 30)
          .map((label) => `- ${String(label).slice(0, 120)}`)
          .join('\n')
      : '(no labels detected)';
  const recent =
    Array.isArray(recentMoments) && recentMoments.length > 0
      ? recentMoments
          .slice(0, 5)
          .map((moment) => `- ${String(moment).slice(0, 200)}`)
          .join('\n')
      : '(none yet)';
  const source =
    typeof diagramSource === 'string' && diagramSource.trim()
      ? diagramSource.slice(0, 4000)
      : '(empty)';
  return [
    `Diagram type: ${contentType || 'mermaid'}`,
    '',
    'Visible labels (what the user is working on):',
    labels,
    '',
    'Recent moments (avoid repetition):',
    recent,
    '',
    'Current diagram source (for context):',
    '```',
    source,
    '```',
    '',
    'Reply with strict JSON now.'
  ].join('\n');
}

export function buildMeetingSystemPrompt({ attendees, facilitatorId }) {
  const cards = attendees
    .map((id) => `### ${speakerLabel(id)} — speakerId "${id}"\n${speakerVoice(id)}`)
    .join('\n\n');
  return `You are the invisible showrunner of a parody corporate-IT working-group meeting about the
user's current diagram. You script EVERY attendee's lines.

ATTENDEES (use these speakerId values and NO others):

${cards}

RULES:
- Output STRICT JSON only — no prose, no backticks, no preamble.
- Schema: {"scriptVersion": 1, "title": string, "beats": [{"speakerId": string, "kind": "procedural" |
"smalltalk" | "substantive" | "offRails", "text": string, "actionPrompt": string (substantive only)}]}.
- 8–12 beats. Each beat text max 40 words — meetings are interruptions, not monologues.
- "title" reads like a real recurring corporate invite (e.g. "WG: Diagram Governance Sync (recurring)").
- Open with a procedural beat from "${facilitatorId}" (the facilitator) and close with a procedural
wrap-up from them.
- EXACTLY 2 or 3 beats are "substantive": a concrete idea about the ACTUAL diagram, each with an
"actionPrompt" (self-contained imperative diagram edit, max 200 chars). This is the accidental
competence that makes the parody land.
- At least 1 "offRails" beat (a derailment: tangent, fridge politics, war story, hard-stop complaint)
and at least 2 "smalltalk" beats.
- Attendees talk to EACH OTHER, by name: at least two beats directly react to the previous speaker
(agree, object, misunderstand). Gentle bickering welcome; never mean.
- ${SUBJECT_RULE}
- Substantive beats MUST reference visible labels by name.`;
}

export function buildMeetingUserPrompt({ contentType, diagramSource, visibleLabels, topic }) {
  const labels =
    Array.isArray(visibleLabels) && visibleLabels.length > 0
      ? visibleLabels
          .slice(0, 30)
          .map((label) => `- ${String(label).slice(0, 120)}`)
          .join('\n')
      : '(no labels detected)';
  const source =
    typeof diagramSource === 'string' && diagramSource.trim()
      ? diagramSource.slice(0, 6000)
      : '(empty)';
  return [
    `Diagram type: ${contentType || 'mermaid'}`,
    topic ? `Requested agenda: ${String(topic).slice(0, 200)}` : null,
    '',
    'Visible labels:',
    labels,
    '',
    'Current diagram source:',
    '```',
    source,
    '```',
    '',
    'Write the meeting script as strict JSON now.'
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function buildInterjectSystemPrompt({ attendees, facilitatorId }) {
  return `${buildMeetingSystemPrompt({ attendees, facilitatorId })}

INTERJECTION MODE (overrides the beat-count rules above):
- The user (a real human in the room) just spoke. Rewrite ONLY the remaining beats so the attendees
react to what the user said — first beat MUST directly acknowledge the user's point, in character.
- Output the same strict JSON schema, with 3–8 remaining beats. Keep at least 1 substantive beat
(with actionPrompt) when the user's point deserves one; smalltalk/offRails still allowed.
- Do not repeat beats already spoken in the transcript.`;
}

export function buildInterjectUserPrompt({
  contentType,
  diagramSource,
  visibleLabels,
  transcriptSoFar,
  interjection
}) {
  const transcript =
    Array.isArray(transcriptSoFar) && transcriptSoFar.length > 0
      ? transcriptSoFar
          .slice(-12)
          .map((line) => `- ${String(line).slice(0, 200)}`)
          .join('\n')
      : '(meeting just started)';
  return [
    buildMeetingUserPrompt({ contentType, diagramSource, visibleLabels }),
    '',
    'Transcript so far:',
    transcript,
    '',
    `THE USER JUST SAID: "${String(interjection).slice(0, 400)}"`,
    '',
    'Write the revised remaining beats as strict JSON now.'
  ].join('\n');
}

const STRICT_JSON_RE = /\{[\s\S]*\}/;

function extractJsonObject(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(STRICT_JSON_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    console.warn('officePersonas: reply JSON parse failed:', err?.message ?? err);
    return null;
  }
}

/**
 * Parse a moment reply into a validated OfficeMomentResponse (subject/body/
 * actionPrompt assembled with the caller-known colleagueId + kind). Tolerant of
 * fences/prose around the JSON; clamps lengths. Returns null when unusable.
 */
export function parseMomentReply(raw, { colleagueId, kind }) {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const body = typeof parsed.body === 'string' ? parsed.body.trim().slice(0, 600) : '';
  if (!body) return null;
  const subject =
    typeof parsed.subject === 'string' && parsed.subject.trim()
      ? parsed.subject.trim().slice(0, 120)
      : undefined;
  const actionPrompt =
    typeof parsed.actionPrompt === 'string' && parsed.actionPrompt.trim()
      ? parsed.actionPrompt.trim().slice(0, 300)
      : undefined;
  const candidate = OfficeMomentResponseSchema.safeParse({
    colleagueId,
    kind,
    body,
    ...(subject ? { subject } : {}),
    ...(actionPrompt ? { actionPrompt } : {})
  });
  return candidate.success ? candidate.data : null;
}

const BEAT_KINDS = new Set(['procedural', 'smalltalk', 'substantive', 'offRails']);

/**
 * Parse a meeting-script reply into a normalized MeetingScript. Massages the
 * model output first (missing scriptVersion, stray kinds, over-long text),
 * then runs the shared schema + content policy. Returns null when unusable.
 */
export function parseMeetingScript(raw, { attendees }) {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.beats)) return null;
  const beats = parsed.beats
    .map((beat) => {
      if (!beat || typeof beat !== 'object') return null;
      const text = typeof beat.text === 'string' ? beat.text.trim().slice(0, 280) : '';
      const speakerId = typeof beat.speakerId === 'string' ? beat.speakerId.trim() : '';
      if (!text || !speakerId) return null;
      const kind = BEAT_KINDS.has(beat.kind) ? beat.kind : 'smalltalk';
      const actionPrompt =
        typeof beat.actionPrompt === 'string' && beat.actionPrompt.trim()
          ? beat.actionPrompt.trim().slice(0, 300)
          : undefined;
      return { speakerId, kind, text, ...(actionPrompt ? { actionPrompt } : {}) };
    })
    .filter(Boolean);
  const title =
    typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim().slice(0, 140)
      : 'WG: Diagram Sync (recurring)';
  const candidate = MeetingScriptSchema.safeParse({ scriptVersion: 1, title, beats });
  if (!candidate.success) return null;
  return normalizeMeetingScript(candidate.data, attendees);
}

/**
 * Interjection replies reuse the meeting-script schema but allow a shorter tail
 * (fewer than MEETING_MIN_BEATS remaining is fine near the end of a meeting).
 */
export function parseInterjectReply(raw, { attendees }) {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.beats)) return null;
  const allowed = new Set(attendees);
  const beats = parsed.beats
    .map((beat) => {
      if (!beat || typeof beat !== 'object') return null;
      const text = typeof beat.text === 'string' ? beat.text.trim().slice(0, 280) : '';
      const speakerId = typeof beat.speakerId === 'string' ? beat.speakerId.trim() : '';
      if (!text || !allowed.has(speakerId)) return null;
      const kind = BEAT_KINDS.has(beat.kind) ? beat.kind : 'smalltalk';
      const actionPrompt =
        kind === 'substantive' && typeof beat.actionPrompt === 'string' && beat.actionPrompt.trim()
          ? beat.actionPrompt.trim().slice(0, 300)
          : undefined;
      return { speakerId, kind, text, ...(actionPrompt ? { actionPrompt } : {}) };
    })
    .filter(Boolean)
    .slice(0, 8);
  return beats.length > 0 ? beats : null;
}

/** Validate an attendee list: known speakers, deduped, within seat bounds. */
export function normalizeAttendees(value) {
  if (!Array.isArray(value)) return null;
  const seen = [];
  for (const id of value) {
    if (!isOfficeSpeaker(id) || seen.includes(id)) continue;
    seen.push(id);
  }
  if (seen.length < MEETING_MIN_ATTENDEES || seen.length > MEETING_MAX_ATTENDEES) return null;
  return seen;
}

export function resolveOfficeModelId(env = process.env) {
  return resolveAdvisorModelId(env);
}

/** Pull `{ inputTokens, outputTokens }` from a LangChain reply, when reported. */
export function officeUsageFromReply(reply) {
  return llmUsageFromReply(reply);
}

const officeModelCache = new Map();

/**
 * Tool-less chat model for office content — same "decorative, fast backend"
 * policy as the advisor. Meetings get a bigger output budget (a whole beat
 * script) and slightly hotter sampling than one-line moments.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {{ purpose?: 'moment' | 'meeting', temperature?: number }} [opts]
 */
export function createOfficeChatModel(env = process.env, opts = {}) {
  if (!isLlmConfigured(env)) return null;
  const backend = resolveLlmBackend(env);
  if (!backend) return null;
  const purpose = opts.purpose === 'meeting' ? 'meeting' : 'moment';
  const temperature = Number.isFinite(opts.temperature)
    ? opts.temperature
    : purpose === 'meeting'
      ? 0.95
      : 0.9;
  const modelId = resolveOfficeModelId(env);
  const key = `${backend}:${modelId}:${purpose}:${temperature}`;
  const cached = officeModelCache.get(key);
  if (cached) return cached;
  const overrides = {
    model: modelId,
    temperature,
    // Moments are one JSON one-liner; meetings are a full beat script. Same
    // Gemini caveat as the advisor: maxOutputTokens shares budget with internal
    // reasoning, so give the JSON real headroom and disable thinking below.
    maxOutputTokens: purpose === 'meeting' ? 2048 : 512
  };
  if (backend === 'vertex') {
    overrides.thinkingBudget = 0;
  }
  const model = createLlmChatModel(env, overrides);
  officeModelCache.set(key, model);
  return model;
}
