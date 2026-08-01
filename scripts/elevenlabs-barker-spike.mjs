#!/usr/bin/env node
/**
 * THROWAWAY SPIKE — companion to gemini-tts-spike.mjs. Delete when decided.
 *
 * Gives ElevenLabs its best shot at Jack Barker, to compare against Gemini-TTS.
 * Two levers Google does not have:
 *   1. Voice Design — author a bespoke voice from a text description
 *      (free tier: 3 saved slots, but *previews* cost no slot, so we preview only).
 *   2. eleven_v3 audio tags — [warmly], [chuckles], [serene] inline delivery cues.
 *
 * NOT doing: cloning the actor who plays Barker. ElevenLabs prohibits cloning a
 * public figure without consent, and instant cloning needs a paid plan anyway.
 * The target is the archetype, not the person.
 *
 * Stage 1 (this script): render ONE line — his real TEAM_INTRO_LINES text — through
 * 3 designed-voice previews + 3 premade archetype matches. Pick a winner by ear.
 * Stage 2: re-run with --voice=<id> to render all three lines in the winner.
 *
 * Free tier is 10,000 credits/month; eleven_v3 bills 1 credit/char (tags included).
 * Stage 1 costs roughly 1,200-1,800 credits.
 *
 * Usage:
 *   node scripts/elevenlabs-barker-spike.mjs <outDir>
 *   node scripts/elevenlabs-barker-spike.mjs <outDir> --voice=<voice_id>
 *
 * Needs ELEVENLABS_API_KEY in .env with permissions:
 *   text_to_speech (required), text_to_voice (Voice Design), user_read (quota).
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = process.argv[2] ?? path.join(process.cwd(), '.spike-audio');
const PICKED = (process.argv.find((a) => a.startsWith('--voice=')) ?? '').split('=')[1];
const API = 'https://api.elevenlabs.io/v1';
const MODEL = 'eleven_v3';

/** Same three real Barker lines the Gemini spike used, now with v3 audio tags. */
const LINES = [
  {
    id: 'intro',
    text: "[warmly] I don't know about you, but I am excited. [chuckles softly] Jack Barker — CEO. I've taken the liberty of simplifying this introduction for the board. Great energy. [smiling] We're a family here."
  },
  {
    id: 'hobby',
    text: "[calmly] A diagram that can't impress a board is a hobby, and we are not a hobby company. [warmly] Keep the story simple, the value obvious, and the synergy visible."
  },
  {
    id: 'liberty',
    text: "[thoughtfully] Now, I find that the best architectures have a shape. [warmly] Two triangles, conjoined. So I've taken the liberty of forming a small working group around the payment flow — [reassuringly] nothing formal."
  }
];

/**
 * Voice Design description. ElevenLabs wants physical/vocal attributes, not
 * character notes — "sixties, warm, unhurried" steers better than "patronizing".
 * Derived from officePersonas.js:237.
 */
const VOICE_DESCRIPTION =
  'A warm, avuncular American man in his early sixties. Rich mid-range voice with a ' +
  'gentle rasp, unhurried and serene, the practised calm of a corporate executive who ' +
  'enjoys the sound of his own reassurance. Faint smile in every phrase, never raised, ' +
  'never rushed. Polished boardroom diction with a folksy Midwestern warmth underneath. ' +
  'Perfect audio quality, studio recording.';

/** Premade archetype matches from GET /v1/voices (free-tier accessible). */
const PREMADE = [
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', why: 'old / american / wise, mature' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', why: 'middle_aged / american / deep, comforting' },
  {
    id: 'iP95p4xoKVk53GoZ742B',
    name: 'Chris',
    why: 'middle_aged / american / charming, down-to-earth'
  }
];

let spent = 0;

async function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const env = await readFile(path.join(process.cwd(), '.env'), 'utf8').catch(() => '');
  const match = env.match(/^ELEVENLABS_API_KEY=(.+)$/m);
  if (!match) throw new Error('ELEVENLABS_API_KEY not found in env or .env');
  return match[1].trim();
}

/** Read the per-request credit cost ElevenLabs reports in response headers. */
function noteCost(res, label) {
  const cost = Number(res.headers.get('character-cost') ?? 0);
  if (cost) {
    spent += cost;
    console.log(`      ${label}: ${cost} credits (running total ${spent})`);
  }
}

async function quota(key) {
  const res = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': key } });
  if (!res.ok) {
    console.log(`quota: unavailable (${res.status} — key lacks user_read)`);
    return;
  }
  const d = await res.json();
  console.log(
    `quota: ${d.character_count} / ${d.character_limit} used, ` +
      `tier ${d.tier}, voice slots ${d.voice_slots_used ?? '?'}/${d.voice_limit ?? '?'}`
  );
}

/**
 * Voice Design previews. Previews do NOT consume one of the 3 free voice slots —
 * we only save a voice if you decide to keep it. Endpoint moved between versions,
 * so try the current path then the legacy one.
 */
async function designPreviews(key, previewText) {
  const body = {
    voice_description: VOICE_DESCRIPTION,
    text: previewText,
    model_id: 'eleven_ttv_v3'
  };
  for (const endpoint of ['/text-to-voice/design', '/text-to-voice/create-previews']) {
    process.stdout.write(`  POST ${endpoint} … `);
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      console.log('ok');
      noteCost(res, 'design');
      const data = await res.json();
      return data.previews ?? [];
    }
    console.log(`${res.status} ${(await res.text()).slice(0, 160)}`);
  }
  return [];
}

async function tts(key, voiceId, text) {
  const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL })
  });
  if (!res.ok) {
    console.log(`    ✗ ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  noteCost(res, 'tts');
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const key = await loadKey();
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`output: ${OUT_DIR}`);
  await quota(key);
  console.log('');

  if (PICKED) {
    // Stage 2 — all three lines in the chosen voice.
    console.log(`— stage 2: all lines in ${PICKED} —`);
    for (const line of LINES) {
      const audio = await tts(key, PICKED, line.text);
      if (!audio) continue;
      const file = path.join(OUT_DIR, `el-barker-${line.id}.mp3`);
      await writeFile(file, audio);
      console.log(`    ${line.id.padEnd(8)} ${Math.round(audio.length / 1024)} KB`);
    }
    console.log(`\nspent ${spent} credits. mp3s in ${OUT_DIR}`);
    return;
  }

  // Stage 1 — one line, many voices, so the choice is made on equal footing.
  const probe = LINES[0];

  console.log('— designed voices (Voice Design previews, no slot consumed) —');
  const previews = await designPreviews(key, probe.text);
  for (const [i, preview] of previews.entries()) {
    const audio = Buffer.from(preview.audio_base_64 ?? preview.audio_base64 ?? '', 'base64');
    if (!audio.length) continue;
    const file = path.join(OUT_DIR, `el-barker-designed-${i + 1}.mp3`);
    await writeFile(file, audio);
    console.log(
      `    designed-${i + 1}  ${Math.round(audio.length / 1024)} KB  id=${preview.generated_voice_id}`
    );
  }
  if (!previews.length) console.log('    (none — key may lack text_to_voice)');

  console.log('\n— premade archetype matches —');
  for (const voice of PREMADE) {
    const audio = await tts(key, voice.id, probe.text);
    if (!audio) continue;
    const file = path.join(OUT_DIR, `el-barker-premade-${voice.name.toLowerCase()}.mp3`);
    await writeFile(file, audio);
    console.log(
      `    ${voice.name.padEnd(6)} ${String(Math.round(audio.length / 1024)).padStart(3)} KB  — ${voice.why}`
    );
  }

  console.log(`\nspent ${spent} credits of the 10,000/month free tier.`);
  console.log(
    'Pick a winner, then: node scripts/elevenlabs-barker-spike.mjs <outDir> --voice=<id>'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
