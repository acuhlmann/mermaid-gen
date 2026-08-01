#!/usr/bin/env node
/**
 * THROWAWAY SPIKE — not a product surface. Delete when the question is answered.
 *
 * Question: does Gemini-TTS make Jack Barker sound meaningfully more like Jack
 * Barker than today's Chirp3-HD `Orus`?
 *
 * Renders the same real Barker lines twice:
 *   baseline — en-US-Chirp3-HD-Orus, speakingRate 0.9 (exactly what ships today,
 *              per VOICES_BY_LANG['en-US'].barker + CHIRP3_VOICE_ROSTER)
 *   gemini   — gemini-2.5-flash-tts + a style prompt derived from the persona
 *              block at apps/server/src/agents/officePersonas.js:237
 *
 * Also answers three implementation facts the follow-up work depends on:
 *   - is `speakingRate` honoured on Gemini-TTS, or eaten like Chirp3 ate `pitch`?
 *   - added latency per line
 *   - real cost per line (Gemini-TTS bills ~25 audio tokens/sec at $10/1M)
 *
 * Usage: node scripts/gemini-tts-spike.mjs [outDir]
 * Needs ADC (gcloud auth application-default login) + texttospeech.googleapis.com.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import textToSpeech from '@google-cloud/text-to-speech';

const OUT_DIR = process.argv[2] ?? path.join(process.cwd(), '.spike-audio');
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

/** Gemini-TTS audio-token billing: 25 tokens/sec at $10 per 1M tokens. */
const USD_PER_AUDIO_SECOND = (25 * 10) / 1_000_000;

/**
 * Real Barker product copy, not invented samples.
 *   intro   — TEAM_INTRO_LINES.barker (officeCast.js:62), actually spoken today
 *             via the Directory "▶ Hear intro" button.
 *   hobby / liberty — authored Barker lines from OFFICE_EMAIL_TEMPLATES
 *             (officeCast.js:689-699). Emails are never spoken, but the *text* is
 *             genuine authored Barker, which is what we're testing delivery on.
 *             `{label}` slots are pre-filled the way fillOfficeSlots would.
 */
const LINES = [
  {
    id: 'intro',
    text: "I don't know about you, but I am excited. Jack Barker — CEO. I've taken the liberty of simplifying this introduction for the board. Great energy. We're a family here."
  },
  {
    id: 'hobby',
    text: "A diagram that can't impress a board is a hobby, and we are not a hobby company. Keep the story simple, the value obvious, and the synergy visible."
  },
  {
    id: 'liberty',
    text: "Now, I find that the best architectures have a shape. Two triangles, conjoined. So I've taken the liberty of forming a small working group around the payment flow — nothing formal."
  }
];

/**
 * Derived from the persona at officePersonas.js:237 — "avuncular, serene,
 * patronizing warmth", "never raise your voice", "porch wisdom ... in the
 * boardroom". This prompt is the experiment; expect to iterate it.
 */
const STYLE_PROMPT = [
  'Speak as an avuncular American corporate CEO in his sixties, addressing a room he owns.',
  'Serene, unhurried, warm — the practised calm of a man who has said this many times and',
  'is thrilled to say it again. Patronizing warmth: everyone present is a promising intern.',
  'Never raise your voice, never rush, never sound anxious. A slight smile behind every',
  'sentence. Land the folksy phrases gently, like porch wisdom, then let them settle.'
].join(' ');

/**
 * Run 1 of STYLE_PROMPT produced lines up to 2× longer than baseline — the model
 * took "unhurried / let them settle" literally and inserted long pauses. This
 * keeps the character but drops every explicit slowness cue and pins the pace.
 */
const STYLE_PROMPT_TIGHT = [
  'Speak as an avuncular American corporate CEO in his sixties, addressing a room he owns.',
  'Warm, serene, quietly delighted — patronizing warmth, as though everyone present is a',
  'promising intern. Never raise your voice and never sound anxious. A slight smile behind',
  'every sentence. Keep a natural conversational pace and keep moving; do not add dramatic',
  'pauses between sentences.'
].join(' ');

/** Today's shipping config for barker (CHIRP3_VOICE_ROSTER + VOICES_BY_LANG). */
const BARKER_RATE = 0.9;

const VARIANTS = [
  {
    id: 'baseline',
    label: 'Chirp3-HD Orus (ships today)',
    voice: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Orus' },
    prompt: null,
    rate: BARKER_RATE
  },
  {
    id: 'gemini',
    label: 'Gemini-TTS + style prompt',
    // Gemini-TTS takes the bare roster name plus modelName, not the full
    // `${lang}-Chirp3-HD-${name}` id.
    voice: { languageCode: 'en-US', name: 'Orus', modelName: 'gemini-2.5-flash-tts' },
    prompt: STYLE_PROMPT,
    rate: BARKER_RATE
  },
  {
    id: 'geminitight',
    label: 'Gemini-TTS + pace-pinned prompt',
    voice: { languageCode: 'en-US', name: 'Orus', modelName: 'gemini-2.5-flash-tts' },
    prompt: STYLE_PROMPT_TIGHT,
    rate: 1
  }
];

/** Optional 3rd arg: comma-separated variant ids to run (default: all). */
const ONLY = (process.argv[3] ?? '').split(',').filter(Boolean);

/** Model ids to try if the primary 404s — preview ids move, so probe. */
const MODEL_FALLBACKS = [
  'gemini-2.5-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-pro-tts',
  'gemini-2.5-flash-lite-preview-tts'
];

/**
 * MP3 duration by walking frame headers — avoids an ffprobe dependency (ffprobe
 * is not on PATH here). Handles MPEG-1/2/2.5 Layer III.
 *
 * @param {Buffer} buf
 * @returns {number} seconds
 */
function mp3DurationSec(buf) {
  const V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const RATES = {
    3: [44100, 48000, 32000], // MPEG-1
    2: [22050, 24000, 16000], // MPEG-2
    0: [11025, 12000, 8000] // MPEG-2.5
  };

  let i = 0;
  // Skip an ID3v2 tag if present.
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    i =
      10 +
      (((buf[6] & 0x7f) << 21) |
        ((buf[7] & 0x7f) << 14) |
        ((buf[8] & 0x7f) << 7) |
        (buf[9] & 0x7f));
  }

  let seconds = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const ver = (buf[i + 1] >> 3) & 3;
      const layer = (buf[i + 1] >> 1) & 3;
      const brIdx = (buf[i + 2] >> 4) & 0x0f;
      const srIdx = (buf[i + 2] >> 2) & 3;
      const pad = (buf[i + 2] >> 1) & 1;
      // layer === 1 is Layer III; ver === 1 is reserved.
      if (layer === 1 && ver !== 1 && brIdx > 0 && brIdx < 15 && srIdx < 3) {
        const mpeg1 = ver === 3;
        const bitrate = (mpeg1 ? V1L3 : V2L3)[brIdx] * 1000;
        const sampleRate = RATES[ver][srIdx];
        const frameLen = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + pad;
        if (frameLen > 4) {
          seconds += (mpeg1 ? 1152 : 576) / sampleRate;
          i += frameLen;
          continue;
        }
      }
    }
    i += 1;
  }
  return seconds;
}

/**
 * One synthesis call. Returns null (and logs) on failure so the spike keeps going.
 *
 * @returns {Promise<{buffer: Buffer, ms: number, seconds: number} | null>}
 */
async function synth(client, { text, voice, prompt, speakingRate }) {
  const input = prompt ? { text, prompt } : { text };
  const started = process.hrtime.bigint();
  try {
    const [response] = await client.synthesizeSpeech({
      input,
      voice,
      audioConfig: { audioEncoding: 'MP3', speakingRate }
    });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const content = response?.audioContent;
    if (!content) return null;
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    return { buffer, ms, seconds: mp3DurationSec(buffer) };
  } catch (err) {
    console.error(`    ✗ ${err?.message ?? err}`);
    return null;
  }
}

/** Find a Gemini-TTS model id this project can actually call. */
async function resolveGeminiModel(client) {
  for (const modelName of MODEL_FALLBACKS) {
    process.stdout.write(`  probing ${modelName} … `);
    const ok = await synth(client, {
      text: 'Terrific.',
      voice: { languageCode: 'en-US', name: 'Orus', modelName },
      prompt: STYLE_PROMPT,
      speakingRate: 1
    });
    if (ok) {
      console.log('ok');
      return modelName;
    }
  }
  return null;
}

async function main() {
  console.log(`project: ${PROJECT_ID ?? '(from ADC default)'}`);
  console.log(`output:  ${OUT_DIR}\n`);
  await mkdir(OUT_DIR, { recursive: true });

  const client = new textToSpeech.TextToSpeechClient(
    PROJECT_ID ? { projectId: PROJECT_ID } : undefined
  );

  console.log('— resolving a callable Gemini-TTS model —');
  const geminiModel = await resolveGeminiModel(client);
  if (!geminiModel) {
    console.log('\nNo Gemini-TTS model answered. Baseline only.\n');
  } else {
    for (const v of VARIANTS) {
      if (v.voice.modelName) v.voice.modelName = geminiModel;
    }
    console.log(`\nusing ${geminiModel}\n`);
  }

  const rows = [];
  for (const line of LINES) {
    console.log(`— ${line.id} (${line.text.length} chars) —`);
    for (const variant of VARIANTS) {
      if (variant.voice.modelName && !geminiModel) continue;
      if (ONLY.length && !ONLY.includes(variant.id)) continue;
      const result = await synth(client, {
        text: line.text,
        voice: variant.voice,
        prompt: variant.prompt,
        speakingRate: variant.rate
      });
      if (!result) continue;
      const file = path.join(OUT_DIR, `barker-${line.id}-${variant.id}.mp3`);
      await writeFile(file, result.buffer);
      rows.push({
        line: line.id,
        variant: variant.id,
        chars: line.text.length,
        ms: Math.round(result.ms),
        seconds: Number(result.seconds.toFixed(2)),
        kb: Math.round(result.buffer.length / 1024),
        usd: result.seconds * USD_PER_AUDIO_SECOND
      });
      console.log(
        `    ${variant.id.padEnd(9)} ${String(Math.round(result.ms)).padStart(5)} ms  ` +
          `${result.seconds.toFixed(2).padStart(5)} s  ${String(Math.round(result.buffer.length / 1024)).padStart(3)} KB`
      );
    }
  }

  // Fact #2: is speakingRate honoured on Gemini-TTS, or silently dropped like
  // Chirp3 drops pitch? Same text at 0.7 vs 1.3 — if durations barely move, the
  // per-persona rate fingerprints have to move into the prompt text instead.
  if (geminiModel && !ONLY.length) {
    console.log('\n— speakingRate probe (gemini) —');
    const probe = LINES[1];
    const durations = {};
    for (const rate of [0.7, 1.3]) {
      const result = await synth(client, {
        text: probe.text,
        voice: { languageCode: 'en-US', name: 'Orus', modelName: geminiModel },
        prompt: STYLE_PROMPT,
        speakingRate: rate
      });
      if (!result) continue;
      durations[rate] = result.seconds;
      await writeFile(
        path.join(OUT_DIR, `barker-rateprobe-${String(rate).replace('.', '_')}.mp3`),
        result.buffer
      );
      console.log(`    rate ${rate}  →  ${result.seconds.toFixed(2)} s`);
    }
    if (durations[0.7] && durations[1.3]) {
      const ratio = durations[0.7] / durations[1.3];
      console.log(
        `    ratio ${ratio.toFixed(2)}× (expect ~1.86 if honoured, ~1.0 if ignored) → ` +
          `${ratio > 1.4 ? 'HONOURED' : 'IGNORED — move rate into the style prompt'}`
      );
    }
  }

  const geminiRows = rows.filter((r) => r.variant.startsWith('gemini'));
  const totalUsd = geminiRows.reduce((sum, r) => sum + r.usd, 0);
  const totalSec = geminiRows.reduce((sum, r) => sum + r.seconds, 0);
  console.log('\n— cost —');
  console.log(
    `  ${geminiRows.length} gemini lines, ${totalSec.toFixed(1)} s → $${totalUsd.toFixed(4)}`
  );
  if (geminiRows.length) {
    console.log(`  per line avg: $${(totalUsd / geminiRows.length).toFixed(5)}`);
    console.log(
      `  a 10-beat meeting (~${((totalSec / geminiRows.length) * 10).toFixed(0)} s) ≈ $${((totalUsd / geminiRows.length) * 10).toFixed(4)}`
    );
  }
  console.log(`\nmp3s in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
