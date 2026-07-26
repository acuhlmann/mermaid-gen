#!/usr/bin/env node
/**
 * Character fidelity harness (experiment — see docs/recipes/replicate-tv-character.md).
 * The file is historically named barker-fidelity.mjs after Jack Barker, the first
 * replicated character; it is generic over CHARACTER_PROFILES today.
 *
 * Generates content for a character through the REAL office prompt builders
 * (apps/server/src/agents/officePersonas.js) across the surfaces they occupy —
 * steering-meeting beats, interjection reactions, plus (when the profile enables
 * them) a rare senior email and advisor-seat suggestions (advisorPrompts.js) —
 * then has an LLM judge score each artifact against that character's rubric. This
 * is the iteration loop for tuning voice cards: edit the persona entries named in
 * the profile's iterateHint, re-run, compare scores.
 *
 * Usage:
 *   node scripts/barker-fidelity.mjs [characterId]            # full run: generate + judge + report (default: barker)
 *   node scripts/barker-fidelity.mjs [characterId] --no-judge # generate only (cheaper, eyeball it)
 *   node scripts/barker-fidelity.mjs --list                   # list character profiles
 *
 * Adding a character: add a profile to CHARACTER_PROFILES below; tune the meeting voice
 * card first with `advisor: false`, flip it on after the seat wire-in.
 *
 * Requires an LLM backend in .env (same resolution as the app: DeepSeek / OpenRouter /
 * Vertex via apps/server/src/agents/llmProvider.js). NOT part of npm test — it spends
 * real tokens (a few cents per run).
 */

import { config as loadEnv } from 'dotenv';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  buildInterjectSystemPrompt,
  buildInterjectUserPrompt,
  buildMeetingSystemPrompt,
  buildMeetingUserPrompt,
  buildMomentSystemPrompt,
  buildMomentUserPrompt,
  createOfficeChatModel,
  isOfficeSpeaker,
  parseInterjectReply,
  parseMeetingScript,
  parseMomentReply
} from '../apps/server/src/agents/officePersonas.js';
import {
  buildAdvisorSystemPrompt,
  buildAdvisorUserPrompt,
  createAdvisorChatModel,
  parseAdvisorReply
} from '../apps/server/src/agents/advisorPrompts.js';
import { isLlmConfigured } from '../apps/server/src/agents/llmProvider.js';
import { extractTextContent } from '../apps/server/src/utils/extractTextContent.js';

loadEnv();

const NO_JUDGE = process.argv.includes('--no-judge');
const LIST_PROFILES = process.argv.includes('--list');
/** First non-flag arg is the character id; defaults to barker. */
const CHARACTER_ID = process.argv.slice(2).find((arg) => !arg.startsWith('-')) ?? 'barker';

/**
 * Character profiles — one entry per replicated cast member. rubricSubject keeps the
 * rubric's historical hard-wrapping so the barker rubric stays byte-identical.
 */
const CHARACTER_PROFILES = {
  barker: {
    speakerId: 'barker',
    shortName: 'Barker',
    rubricSubject: `Jack Barker from HBO's Silicon Valley (the "Action Jack" CEO: success theater, Conjoined Triangles
of Success, serene patronizing warmth, excitement about excitement, credit-taking framed as
humility, folksy aphorisms, loyalty theater, ruthlessness delivered smiling via process — never
profane, never technical, never plainly at fault).`,
    foil: 'any generic CEO bot',
    pronounObject: 'him',
    pronounSubject: 'he',
    voiceMarkers: 'warm menace / excitement / aphorism / credit-taking',
    ism: 'Barker-ism',
    attendees: ['scrumMaster', 'barker', 'cto', 'refine'],
    facilitator: 'scrumMaster',
    seniorEmail: true,
    advisor: true,
    advisorNote: 'subtractive seat',
    iterateHint: 'STAKEHOLDER_MEETING_VOICES.barker / ADVISOR_PERSONAS.barker'
  }
};

/** Comedy lands best off-enterprise: a pizza flow the office can be wrong about. */
const FIXTURE = {
  contentType: 'mermaid',
  diagramSource: `flowchart TD
  Craving --> Choose{Toppings?}
  Choose -->|Classic| Pepperoni
  Choose -->|Chaos| Pineapple
  Pepperoni --> Bake
  Pineapple --> Bake
  Bake --> Slice
  Slice --> Devour
  Devour --> Regret`,
  visibleLabels: [
    'Craving',
    'Choose',
    'Toppings?',
    'Pepperoni',
    'Pineapple',
    'Bake',
    'Slice',
    'Devour',
    'Regret'
  ]
};

const INTERJECTIONS = [
  'Honestly? I think the diagram is fine as is. It does not need to impress anyone.',
  'Can we please just ship it already?'
];

function buildJudgeRubric(profile) {
  return `You are a TV-writing judge scoring how faithfully generated lines replicate
${profile.rubricSubject}

Score the GENERATED CONTENT 1–5 on each axis:
- recognizability: 5 = unmistakably ${profile.shortName} (a fan would name ${profile.pronounObject} blind); 1 = ${profile.foil}.
- voiceMechanics: 5 = ${profile.voiceMarkers} deployed with timing; 1 = flat summary-speak.
- catchphraseBudget: 5 = at most one ${profile.ism}, woven naturally; 1 = catchphrase salad or zero flavor.
- inWorld: 5 = ${profile.pronounSubject} engages the actual diagram labels in character; 1 = ignores the subject or breaks the app fiction.

Output STRICT JSON only: {"recognizability": int, "voiceMechanics": int, "catchphraseBudget": int,
"inWorld": int, "notes": string (max 200 chars, the single biggest fix)}.`;
}

async function invokeText(model, system, user) {
  const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
  return extractTextContent(reply?.content ?? reply);
}

function speakerBeats(script, speakerId) {
  return (script?.beats ?? []).filter((beat) => beat.speakerId === speakerId);
}

async function judge(judgeModel, rubric, surface, content) {
  const user = `SURFACE: ${surface}\n\nGENERATED CONTENT:\n${content}\n\nScore as strict JSON now.`;
  const raw = await invokeText(judgeModel, rubric, user);
  try {
    const match = raw.trim().match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { error: 'judge JSON parse failed', raw };
  } catch {
    return { error: 'judge JSON parse failed', raw };
  }
}

function printScores(label, scores) {
  if (!scores || scores.error) {
    console.log(`  JUDGE: ${scores?.error ?? 'no scores'} ${scores?.raw ?? ''}`);
    return null;
  }
  const avg =
    (scores.recognizability + scores.voiceMechanics + scores.catchphraseBudget + scores.inWorld) /
    4;
  console.log(
    `  JUDGE ${label}: recog=${scores.recognizability} voice=${scores.voiceMechanics} ` +
      `budget=${scores.catchphraseBudget} world=${scores.inWorld} avg=${avg.toFixed(1)}`
  );
  console.log(`  NOTES: ${scores.notes}`);
  return avg;
}

async function main() {
  if (LIST_PROFILES) {
    console.log('Available character profiles:');
    for (const [id, profile] of Object.entries(CHARACTER_PROFILES)) {
      console.log(`  ${id}  (seniorEmail: ${profile.seniorEmail}, advisor: ${profile.advisor})`);
    }
    return;
  }

  const profile = CHARACTER_PROFILES[CHARACTER_ID];
  if (!profile) {
    console.error(
      `Unknown character id "${CHARACTER_ID}". Available profiles: ${Object.keys(CHARACTER_PROFILES).join(', ')}. ` +
        'To wire in a new character, add a profile to CHARACTER_PROFILES at the top of this script.'
    );
    process.exit(1);
  }

  if (!isLlmConfigured(process.env)) {
    console.error(
      'No LLM backend configured (.env). Set DEEPSEEK_API_KEY, OPENROUTER_API_KEY, or Vertex env — same as the app.'
    );
    process.exit(1);
  }
  if (!isOfficeSpeaker(profile.speakerId)) {
    console.error(
      `${profile.speakerId} is not a known office speaker — add the voice card to officePersonas.js.`
    );
    process.exit(1);
  }

  const genModel = createOfficeChatModel(process.env, { purpose: 'meeting' });
  const judgeModel = createOfficeChatModel(process.env, { purpose: 'moment', temperature: 0.2 });
  if (!genModel || !judgeModel) {
    console.error('Office chat model unavailable (LLM not configured for the office fast tier).');
    process.exit(1);
  }

  const judgeRubric = buildJudgeRubric(profile);
  const averages = [];

  // --- 1. Steering meeting script -------------------------------------------------
  console.log('\n=== 1. STEERING MEETING (attendees: %s) ===', profile.attendees.join(', '));
  const meetingSystem = buildMeetingSystemPrompt({
    attendees: profile.attendees,
    facilitatorId: profile.facilitator
  });
  const meetingUser = buildMeetingUserPrompt({ ...FIXTURE });
  const meetingRaw = await invokeText(genModel, meetingSystem, meetingUser);
  const script = parseMeetingScript(meetingRaw, { attendees: profile.attendees });
  if (!script) {
    console.log('  PARSE FAILED — raw reply:\n', meetingRaw);
    process.exitCode = 1;
  } else {
    const transcript = [];
    for (const beat of script.beats) {
      console.log(`  [${beat.kind}] ${beat.speakerId}: ${beat.text}`);
      transcript.push(`${beat.speakerId}: ${beat.text}`);
    }
    const characterBeats = speakerBeats(script, profile.speakerId);
    console.log(`\n  ${profile.shortName} beats: ${characterBeats.length}/${script.beats.length}`);
    if (!NO_JUDGE) {
      const scores = await judge(
        judgeModel,
        judgeRubric,
        `steering-meeting beats (${profile.shortName} lines only)`,
        characterBeats.map((b) => `- ${b.text}`).join('\n')
      );
      averages.push(printScores('meeting', scores));
    }

    // --- 2. Interjection reactions ------------------------------------------------
    for (const line of INTERJECTIONS) {
      console.log(`\n=== 2. INTERJECTION — user says: "${line}" ===`);
      const system = buildInterjectSystemPrompt({
        attendees: profile.attendees,
        facilitatorId: profile.facilitator
      });
      const user = buildInterjectUserPrompt({
        ...FIXTURE,
        transcriptSoFar: transcript.slice(0, 6),
        interjection: line
      });
      const raw = await invokeText(genModel, system, user);
      const beats = parseInterjectReply(raw, { attendees: profile.attendees });
      if (!beats) {
        console.log('  PARSE FAILED — raw reply:\n', raw);
        process.exitCode = 1;
        continue;
      }
      for (const beat of beats) console.log(`  [${beat.kind}] ${beat.speakerId}: ${beat.text}`);
      const speakerOnly = beats.filter((b) => b.speakerId === profile.speakerId);
      if (!NO_JUDGE && speakerOnly.length > 0) {
        const scores = await judge(
          judgeModel,
          judgeRubric,
          `interjection reaction to a user who said: "${line}" (${profile.shortName} lines only)`,
          speakerOnly.map((b) => `- ${b.text}`).join('\n')
        );
        averages.push(printScores('interject', scores));
      }
    }
  }

  // --- 3. Rare senior email ---------------------------------------------------------
  if (profile.seniorEmail) {
    console.log('\n=== 3. SENIOR EMAIL ===');
    const emailSystem = buildMomentSystemPrompt({ kind: 'email', colleagueId: profile.speakerId });
    const emailUser = buildMomentUserPrompt({ ...FIXTURE, userName: 'Alex' });
    const emailRaw = await invokeText(genModel, emailSystem, emailUser);
    const email = parseMomentReply(emailRaw, { colleagueId: profile.speakerId, kind: 'email' });
    if (!email) {
      console.log('  PARSE FAILED — raw reply:\n', emailRaw);
      process.exitCode = 1;
    } else {
      console.log(`  SUBJECT: ${email.subject ?? '(none)'}`);
      console.log(`  BODY: ${email.body}`);
      if (email.actionPrompt) console.log(`  ACTION: ${email.actionPrompt}`);
      if (!NO_JUDGE) {
        const scores = await judge(
          judgeModel,
          judgeRubric,
          'rare high-stakes senior email',
          `Subject: ${email.subject ?? ''}\n${email.body}`
        );
        averages.push(printScores('email', scores));
      }
    }
  } else {
    console.log('\n=== 3. SENIOR EMAIL — skipped (profile.seniorEmail is false) ===');
  }

  // --- 4. Advisor-seat suggestions -------------------------------------------------
  // Short {suggestion, highlightIds, kind} replies through the real advisor prompt
  // builders (ADVISOR_PERSONAS[profile.speakerId]).
  if (profile.advisor) {
    console.log('\n=== 4. ADVISOR SUGGESTIONS (the team seat) ===');
    const advisorModel = createAdvisorChatModel(process.env, profile.speakerId);
    if (!advisorModel) {
      console.error('Advisor chat model unavailable.');
      process.exitCode = 1;
    } else {
      const advisorSystem = buildAdvisorSystemPrompt(profile.speakerId, FIXTURE.contentType);
      const lastSuggestions = [];
      const replies = [];
      for (let i = 0; i < 3; i += 1) {
        const advisorUser = buildAdvisorUserPrompt({ ...FIXTURE, lastSuggestions });
        const raw = await invokeText(advisorModel, advisorSystem, advisorUser);
        const parsed = parseAdvisorReply(raw, { persona: profile.speakerId });
        if (!parsed) {
          console.log('  PARSE FAILED — raw reply:\n', raw);
          process.exitCode = 1;
          continue;
        }
        replies.push(parsed);
        lastSuggestions.push(parsed.suggestion);
        console.log(
          `  [${parsed.kind}] ${parsed.suggestion}  (ids: ${parsed.highlightIds.join(', ') || '—'})`
        );
      }
      if (!NO_JUDGE && replies.length > 0) {
        const scores = await judge(
          judgeModel,
          judgeRubric,
          `advisor-seat suggestions about the diagram (short JSON one-liners, ${profile.advisorNote})`,
          replies.map((r) => `- [${r.kind}] ${r.suggestion}`).join('\n')
        );
        averages.push(printScores('advisor', scores));
      }
    }
  } else {
    console.log('\n=== 4. ADVISOR SUGGESTIONS — skipped (profile.advisor is false) ===');
  }

  // --- Report -----------------------------------------------------------------------
  const valid = averages.filter((v) => typeof v === 'number');
  if (valid.length > 0) {
    const overall = valid.reduce((a, b) => a + b, 0) / valid.length;
    console.log(
      `\n=== OVERALL: ${overall.toFixed(2)} / 5 across ${valid.length} judged samples ===`
    );
    console.log(`Target: >= 4.0 sustained. Iterate ${profile.iterateHint} and re-run.`);
  }
}

main().catch((error) => {
  console.error('Harness failed:', error?.message ?? error);
  process.exit(1);
});
