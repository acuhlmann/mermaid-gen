#!/usr/bin/env node
/**
 * THROWAWAY SPIKE — make Richard sound less composed, keeping Aoede.
 *
 * Aoede stays: it was picked by ear as the closest match to Richard Hendricks'
 * high, reedy delivery, even though it is a FEMALE voice mapped from a male
 * character. That is deliberate, not the gender bug it looks like.
 *
 * Chirp3-HD gives exactly two levers — it rejects `pitch` (officeTts.js:512) and
 * has no style-prompt input:
 *   1. speakingRate — hesitancy reads as slower
 *   2. the text itself — ellipses, restarts, filled pauses, rising inflection
 *
 * Lever 2 has a design consequence worth deciding before shipping: if the shaped
 * text is applied at synthesis time only, the audio says "um" while the caption
 * bubble does not. See the notes in the accompanying message.
 *
 * Usage: node scripts/richard-uncertainty.mjs <outDir>
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import textToSpeech from '@google-cloud/text-to-speech';

const OUT_DIR = process.argv[2] ?? path.join(process.cwd(), '.spike-audio');
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || 'mermaidgen';
const RATE_SCALE = 1.18; // OFFICE_TTS_RATE_SCALE, packages/shared/src/officeVoice.ts:52

/** officeCast.js:60 — TEAM_INTRO_LINES.richard, exactly as it ships. */
const PLAIN =
  "Okay — so if I'm reading this right, I'm Richard. I name patterns. I think this office has a shape. Sorry — that was a lot. I just… I care that the model is right.";

/**
 * Same content, shaped for hesitancy: a filled pause, two self-restarts, a
 * rising-inflection question, and a doubled apology. No meaning changed.
 */
const SHAPED =
  "Okay — so, um… if I'm reading this right, I'm — I'm Richard. I name patterns. I think this office has… a shape? Sorry. Sorry, that was — that was a lot. I just… I care that the model is right.";

const VARIANTS = [
  { id: '1-current', text: PLAIN, rate: 0.92, note: 'ships today' },
  { id: '2-slow', text: PLAIN, rate: 0.84, note: 'plain text, slower' },
  { id: '3-slower', text: PLAIN, rate: 0.76, note: 'plain text, slowest' },
  { id: '4-hesitant', text: SHAPED, rate: 0.92, note: 'shaped text, current pace' },
  { id: '5-hesitant-slow', text: SHAPED, rate: 0.84, note: 'shaped text, slower' }
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const client = new textToSpeech.TextToSpeechClient({ projectId: PROJECT_ID });

  for (const variant of VARIANTS) {
    const speakingRate = Number((variant.rate * RATE_SCALE).toFixed(3));
    try {
      const [res] = await client.synthesizeSpeech({
        input: { text: variant.text },
        voice: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Aoede' },
        audioConfig: { audioEncoding: 'MP3', speakingRate }
      });
      const buf = Buffer.from(res.audioContent);
      await writeFile(path.join(OUT_DIR, `richard-${variant.id}.mp3`), buf);
      console.log(
        `  ${variant.id.padEnd(17)} rate ${String(speakingRate).padEnd(6)} ` +
          `${String(Math.round(buf.length / 1024)).padStart(3)} KB  — ${variant.note}`
      );
    } catch (err) {
      console.log(`  ${variant.id.padEnd(17)} ✗ ${err.message.slice(0, 90)}`);
    }
  }
  console.log(`\nmp3s in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
