#!/usr/bin/env node
/**
 * THROWAWAY SPIKE — audition Chirp3-HD voices for one office speaker.
 *
 * Chirp3-HD is already free (1M chars/month), so auditioning costs nothing.
 *
 * Two jobs:
 *   1. Report how many Chirp3-HD voices each office locale actually has — the
 *      8-voice restriction in officeTts.js:222 exists because the core eight are
 *      "guaranteed across every office locale (crucially the cmn-* ones)". If the
 *      cmn locales also ship 30, that constraint is stale everywhere.
 *   2. Render one speaker's real line through a set of candidate voices so a human
 *      can pick by ear. Names give no hint of timbre.
 *
 * Usage: node scripts/chirp3-audition.mjs <outDir> [speaker]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import textToSpeech from '@google-cloud/text-to-speech';

const OUT_DIR = process.argv[2] ?? path.join(process.cwd(), '.spike-audio');
const SPEAKER = process.argv[3] ?? 'richard';
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || 'mermaidgen';

/** Real product text — TEAM_INTRO_LINES in apps/web/src/utils/officeCast.js:53. */
const LINES = {
  richard: {
    // officeCast.js:60 — the apologetic "Sorry — that was a lot" beat is the test.
    text: "Okay — so if I'm reading this right, I'm Richard. I name patterns. I think this office has a shape. Sorry — that was a lot. I just… I care that the model is right.",
    // VOICES_BY_LANG['en-US'].richard, officeTts.js:71
    speakingRate: 0.92,
    // Anxious, reedy, young. Currently 'Aoede' (FEMALE) — the bug being fixed.
    candidates: [
      'Puck',
      'Achird',
      'Algieba',
      'Enceladus',
      'Iapetus',
      'Umbriel',
      'Zubenelgenubi',
      'Sadachbia'
    ]
  }
};

/** OFFICE_TTS_RATE_SCALE from packages/shared/src/officeVoice.ts:52. */
const RATE_SCALE = 1.18;

async function reportLocaleCoverage(client) {
  console.log('— Chirp3-HD voice counts per office locale —');
  for (const lang of ['en-US', 'en-AU', 'cmn-CN', 'cmn-TW']) {
    try {
      const [res] = await client.listVoices({ languageCode: lang });
      const chirp = res.voices.filter((v) => v.name.includes('Chirp3-HD'));
      const male = chirp.filter((v) => v.ssmlGender === 'MALE').length;
      console.log(
        `  ${lang.padEnd(7)} ${String(chirp.length).padStart(3)} voices  (${male} male / ${chirp.length - male} female)`
      );
    } catch (err) {
      console.log(`  ${lang.padEnd(7)} error: ${err.message}`);
    }
  }
  console.log('');
}

async function main() {
  const spec = LINES[SPEAKER];
  if (!spec) throw new Error(`no line defined for "${SPEAKER}"`);
  await mkdir(OUT_DIR, { recursive: true });

  const client = new textToSpeech.TextToSpeechClient({ projectId: PROJECT_ID });
  await reportLocaleCoverage(client);

  // Same scaling officeTts.js applies via scaleSpeakingRate.
  const speakingRate = Number((spec.speakingRate * RATE_SCALE).toFixed(3));
  console.log(`— ${SPEAKER}: ${spec.candidates.length} candidates @ rate ${speakingRate} —`);
  console.log(`  "${spec.text.slice(0, 70)}…"\n`);

  for (const voice of spec.candidates) {
    try {
      const [res] = await client.synthesizeSpeech({
        input: { text: spec.text },
        voice: { languageCode: 'en-US', name: `en-US-Chirp3-HD-${voice}` },
        // Chirp3 rejects pitch — rate is the only prosody knob (officeTts.js:512).
        audioConfig: { audioEncoding: 'MP3', speakingRate }
      });
      const buf = Buffer.from(res.audioContent);
      await writeFile(path.join(OUT_DIR, `${SPEAKER}-${voice.toLowerCase()}.mp3`), buf);
      console.log(
        `    ${voice.padEnd(14)} ${String(Math.round(buf.length / 1024)).padStart(3)} KB`
      );
    } catch (err) {
      console.log(`    ${voice.padEnd(14)} ✗ ${err.message.slice(0, 80)}`);
    }
  }
  console.log(`\nmp3s in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
