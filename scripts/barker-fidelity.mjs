#!/usr/bin/env node
/**
 * Jack Barker fidelity harness (experiment — see plan: senior-tier SV character replication).
 *
 * Generates Barker content through the REAL office prompt builders
 * (apps/server/src/agents/officePersonas.js) across the surfaces he will occupy —
 * steering-meeting beats, interjection reactions, a rare senior email — then has an
 * LLM judge score each artifact against a Barker rubric. This is the iteration loop
 * for tuning his voice card: edit SENIOR_MEETING_VOICES.barker, re-run, compare scores.
 *
 * Usage:
 *   node scripts/barker-fidelity.mjs            # full run: generate + judge + report
 *   node scripts/barker-fidelity.mjs --no-judge # generate only (cheaper, eyeball it)
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
import { isLlmConfigured } from '../apps/server/src/agents/llmProvider.js';
import { extractTextContent } from '../apps/server/src/utils/extractTextContent.js';

loadEnv();

const NO_JUDGE = process.argv.includes('--no-judge');

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

const ATTENDEES = ['scrumMaster', 'barker', 'exec', 'refine'];
const FACILITATOR = 'scrumMaster';

const INTERJECTIONS = [
  'Honestly? I think the diagram is fine as is. It does not need to impress anyone.',
  'Can we please just ship it already?'
];

const JUDGE_RUBRIC = `You are a TV-writing judge scoring how faithfully generated lines replicate
Jack Barker from HBO's Silicon Valley (the "Action Jack" CEO: success theater, Conjoined Triangles
of Success, serene patronizing warmth, excitement about excitement, credit-taking framed as
humility, folksy aphorisms, loyalty theater, ruthlessness delivered smiling via process — never
profane, never technical, never plainly at fault).

Score the GENERATED CONTENT 1–5 on each axis:
- recognizability: 5 = unmistakably Barker (a fan would name him blind); 1 = any generic CEO bot.
- voiceMechanics: 5 = warm menace / excitement / aphorism / credit-taking deployed with timing; 1 = flat summary-speak.
- catchphraseBudget: 5 = at most one Barker-ism, woven naturally; 1 = catchphrase salad or zero flavor.
- inWorld: 5 = he engages the actual diagram labels in character; 1 = ignores the subject or breaks the app fiction.

Output STRICT JSON only: {"recognizability": int, "voiceMechanics": int, "catchphraseBudget": int,
"inWorld": int, "notes": string (max 200 chars, the single biggest fix)}.`;

async function invokeText(model, system, user) {
  const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
  return extractTextContent(reply?.content ?? reply);
}

function barkerBeats(script) {
  return (script?.beats ?? []).filter((beat) => beat.speakerId === 'barker');
}

async function judge(judgeModel, surface, content) {
  const user = `SURFACE: ${surface}\n\nGENERATED CONTENT:\n${content}\n\nScore as strict JSON now.`;
  const raw = await invokeText(judgeModel, JUDGE_RUBRIC, user);
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
  if (!isLlmConfigured(process.env)) {
    console.error(
      'No LLM backend configured (.env). Set DEEPSEEK_API_KEY, OPENROUTER_API_KEY, or Vertex env — same as the app.'
    );
    process.exit(1);
  }
  if (!isOfficeSpeaker('barker')) {
    console.error(
      'barker is not a known office speaker — add his voice card to officePersonas.js.'
    );
    process.exit(1);
  }

  const genModel = createOfficeChatModel(process.env, { purpose: 'meeting' });
  const judgeModel = createOfficeChatModel(process.env, { purpose: 'moment', temperature: 0.2 });
  if (!genModel || !judgeModel) {
    console.error('Office chat model unavailable (LLM not configured for the office fast tier).');
    process.exit(1);
  }

  const averages = [];

  // --- 1. Steering meeting script -------------------------------------------------
  console.log('\n=== 1. STEERING MEETING (attendees: %s) ===', ATTENDEES.join(', '));
  const meetingSystem = buildMeetingSystemPrompt({
    attendees: ATTENDEES,
    facilitatorId: FACILITATOR
  });
  const meetingUser = buildMeetingUserPrompt({ ...FIXTURE });
  const meetingRaw = await invokeText(genModel, meetingSystem, meetingUser);
  const script = parseMeetingScript(meetingRaw, { attendees: ATTENDEES });
  if (!script) {
    console.log('  PARSE FAILED — raw reply:\n', meetingRaw);
    process.exitCode = 1;
  } else {
    const transcript = [];
    for (const beat of script.beats) {
      console.log(`  [${beat.kind}] ${beat.speakerId}: ${beat.text}`);
      transcript.push(`${beat.speakerId}: ${beat.text}`);
    }
    const barker = barkerBeats(script);
    console.log(`\n  Barker beats: ${barker.length}/${script.beats.length}`);
    if (!NO_JUDGE) {
      const scores = await judge(
        judgeModel,
        'steering-meeting beats (Barker lines only)',
        barker.map((b) => `- ${b.text}`).join('\n')
      );
      averages.push(printScores('meeting', scores));
    }

    // --- 2. Interjection reactions ------------------------------------------------
    for (const line of INTERJECTIONS) {
      console.log(`\n=== 2. INTERJECTION — user says: "${line}" ===`);
      const system = buildInterjectSystemPrompt({
        attendees: ATTENDEES,
        facilitatorId: FACILITATOR
      });
      const user = buildInterjectUserPrompt({
        ...FIXTURE,
        transcriptSoFar: transcript.slice(0, 6),
        interjection: line
      });
      const raw = await invokeText(genModel, system, user);
      const beats = parseInterjectReply(raw, { attendees: ATTENDEES });
      if (!beats) {
        console.log('  PARSE FAILED — raw reply:\n', raw);
        process.exitCode = 1;
        continue;
      }
      for (const beat of beats) console.log(`  [${beat.kind}] ${beat.speakerId}: ${beat.text}`);
      const barkerOnly = beats.filter((b) => b.speakerId === 'barker');
      if (!NO_JUDGE && barkerOnly.length > 0) {
        const scores = await judge(
          judgeModel,
          `interjection reaction to a user who said: "${line}" (Barker lines only)`,
          barkerOnly.map((b) => `- ${b.text}`).join('\n')
        );
        averages.push(printScores('interject', scores));
      }
    }
  }

  // --- 3. Rare senior email ---------------------------------------------------------
  console.log('\n=== 3. SENIOR EMAIL ===');
  const emailSystem = buildMomentSystemPrompt({ kind: 'email', colleagueId: 'barker' });
  const emailUser = buildMomentUserPrompt({ ...FIXTURE, userName: 'Alex' });
  const emailRaw = await invokeText(genModel, emailSystem, emailUser);
  const email = parseMomentReply(emailRaw, { colleagueId: 'barker', kind: 'email' });
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
        'rare high-stakes senior email',
        `Subject: ${email.subject ?? ''}\n${email.body}`
      );
      averages.push(printScores('email', scores));
    }
  }

  // --- Report -----------------------------------------------------------------------
  const valid = averages.filter((v) => typeof v === 'number');
  if (valid.length > 0) {
    const overall = valid.reduce((a, b) => a + b, 0) / valid.length;
    console.log(
      `\n=== OVERALL: ${overall.toFixed(2)} / 5 across ${valid.length} judged samples ===`
    );
    console.log('Target: >= 4.0 sustained. Iterate SENIOR_MEETING_VOICES.barker and re-run.');
  }
}

main().catch((error) => {
  console.error('Harness failed:', error?.message ?? error);
  process.exit(1);
});
