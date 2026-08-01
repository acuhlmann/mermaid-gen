#!/usr/bin/env node
/**
 * THROWAWAY SPIKE — audition Chirp3-HD voices for office speakers, by ear.
 *
 * Supersedes chirp3-audition.mjs: candidates now carry their own `lang`, because
 * Chirp3-HD voice names are locale-independent (`Charon` ships for en-US, en-IN,
 * en-GB, en-AU and cmn-CN alike) and the *locale* is what carries the accent.
 * That is the whole mechanism behind giving Dinesh a South Asian accent without
 * leaving the free Chirp3 tier.
 *
 * Chirp3-HD is already free (1M chars/month), so auditioning costs nothing.
 * Rates below are the authored values from VOICES_BY_LANG['en-US'] in
 * apps/server/src/agents/officeTts.js, scaled the way scaleSpeakingRate does.
 *
 * Usage: node scripts/cast-audition.mjs <outDir> [speaker[,speaker...]]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import textToSpeech from '@google-cloud/text-to-speech';

const OUT_DIR = process.argv[2] ?? path.join(process.cwd(), '.spike-audio');
const ONLY = (process.argv[3] ?? '').split(',').filter(Boolean);
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || 'mermaidgen';
const RATE_SCALE = 1.18; // OFFICE_TTS_RATE_SCALE, packages/shared/src/officeVoice.ts:52

/**
 * Richard's TEAM_INTRO_LINES text (officeCast.js:60) shaped for hesitancy — the
 * variant picked by ear. Open question this audition answers: which voice keeps
 * that hesitancy while reading a little more male than `Aoede`?
 */
const RICHARD_HESITANT =
  "Okay — so, um… if I'm reading this right, I'm — I'm Richard. I name patterns. I think this office has… a shape? Sorry. Sorry, that was — that was a lot. I just… I care that the model is right.";

const SPEAKERS = {
  richard: {
    // Aoede won the first audition but reads too female. Chirp3 rejects `pitch`,
    // so the only lever is picking a voice that naturally sits lower.
    text: RICHARD_HESITANT,
    rate: 0.92,
    candidates: [
      { lang: 'en-US', voice: 'Aoede', note: 'current pick — reference' },
      { lang: 'en-US', voice: 'Gacrux', note: 'female, hoping lower' },
      { lang: 'en-US', voice: 'Vindemiatrix', note: 'female, hoping lower' },
      { lang: 'en-US', voice: 'Sulafat', note: 'female, hoping lower' },
      { lang: 'en-US', voice: 'Puck', note: 'male, lightest' },
      { lang: 'en-US', voice: 'Achird', note: 'male, light' }
    ]
  },
  dinesh: {
    // officeCast.js:54 — TEAM_INTRO_LINES.dinesh.
    text: "Dinesh. Engineer. I'm the one who actually catches what everyone else missed — including Gilfoyle, who still has not thanked me. Your diagram looks unfinished. I already know which box. You're welcome in advance.",
    rate: 1.12,
    // en-IN is the closest South Asian English accent Google publishes — it is
    // Indian, not Pakistani (no en-PK exists; ur-IN would speak Urdu, not
    // accented English). `Charon` first because it is his voice today, so that
    // clip isolates the accent change on its own.
    candidates: [
      { lang: 'en-US', voice: 'Charon', note: 'ships today — reference' },
      { lang: 'en-IN', voice: 'Charon', note: 'same voice, en-IN accent' },
      { lang: 'en-IN', voice: 'Puck', note: 'en-IN, younger' },
      { lang: 'en-IN', voice: 'Algieba', note: 'en-IN' },
      { lang: 'en-IN', voice: 'Iapetus', note: 'en-IN' }
    ]
  },
  jared: {
    // officeCast.js:58 — TEAM_INTRO_LINES.jared. Shares `Charon` with dinesh
    // today, which is the collision being broken.
    text: "Hi — Jared. I just wanted to flag that onboarding is already a finding, and if it's alright, someone should own the handoff before we move on. I'm sorry. Also I'm glad you're here. Mostly the finding.",
    rate: 1.04,
    candidates: [
      { lang: 'en-US', voice: 'Charon', note: 'ships today — reference' },
      { lang: 'en-US', voice: 'Enceladus', note: 'earnest, gentle?' },
      { lang: 'en-US', voice: 'Iapetus', note: 'reedy?' },
      { lang: 'en-US', voice: 'Umbriel', note: 'soft?' }
    ]
  },

  gilfoyle: {
    // officeCast.js:1115 — OFFICE_BATTLE_SCENES. Pure deadpan, ideal for "darker".
    text: 'That would require somebody to care who wrote it. I have never once wondered. It is restful. You should try it.',
    rate: 0.9,
    // Chirp3 rejects `pitch`, so "darker" can only mean a naturally lower voice.
    candidates: [
      { lang: 'en-US', voice: 'Enceladus', note: 'deep?' },
      { lang: 'en-US', voice: 'Rasalgethi', note: 'deep?' },
      { lang: 'en-US', voice: 'Schedar', note: 'deep?' },
      { lang: 'en-US', voice: 'Algenib', note: 'gravelly?' }
    ]
  },

  russ: {
    // REPRESENTATIVE, not shipped copy — Russ has no canned lines anywhere; his
    // dialogue is LLM-only. Written to match officePersonas.js:184 (tres commas,
    // mocks synergy, escalates, swears).
    text: "Okay, okay — three arrows? That's cute. You know what three arrows gets you? Two commas. TWO. I'm not here for two commas. Make it bigger, make it louder, and somebody tell me what the hell synergy is.",
    rate: 1.14,
    candidates: [
      { lang: 'en-US', voice: 'Alnilam', note: 'brash?' },
      { lang: 'en-US', voice: 'Sadaltager', note: 'loud?' },
      { lang: 'en-US', voice: 'Zubenelgenubi', note: 'manic?' },
      { lang: 'en-US', voice: 'Algenib', note: 'swaggering?' }
    ]
  },

  barker: {
    // officeCast.js:62 — TEAM_INTRO_LINES.barker.
    text: "I don't know about you, but I am excited. Jack Barker — CEO. I've taken the liberty of simplifying this introduction for the board. Great energy. We're a family here.",
    rate: 0.9,
    // Round 1 auditioned deep/authoritative voices and came back "too confident".
    // Wrong axis: the real Barker is avuncular AND dorky, and dorky is the
    // *opposite* of resonant — lighter, thinner, slightly over-precise. So this
    // round pairs (a) a rate sweep on Rasalgethi, the closest from round 1, with
    // (b) the lighter voices round 1 never tried on his line. `rate` here
    // overrides the speaker default; slower reads as over-deliberate.
    candidates: [
      { lang: 'en-US', voice: 'Rasalgethi', rate: 0.78, note: 'closest so far, slower' },
      { lang: 'en-US', voice: 'Rasalgethi', rate: 0.68, note: 'closest so far, slowest' },
      { lang: 'en-US', voice: 'Achird', note: 'lighter' },
      { lang: 'en-US', voice: 'Achird', rate: 0.78, note: 'lighter + slower' },
      { lang: 'en-US', voice: 'Charon', rate: 0.82, note: 'mid-light' },
      { lang: 'en-US', voice: 'Puck', rate: 0.82, note: 'lightest' },
      { lang: 'en-US', voice: 'Umbriel', rate: 0.82, note: 'soft, unresonant' },
      { lang: 'en-US', voice: 'Sadachbia', rate: 0.76, note: 'smooth, retried slower' }
    ]
  },

  belson: {
    // officeCast.js:684 — SENIOR_EMAIL_TEMPLATES body, `{label}` slot filled the
    // way fillOfficeSlots would. Authored Belson, and squarely "demanding".
    text: 'I reviewed the checkout flow. Briefly. Then again, because I could not believe the first pass. This is undersized. Small thinking dressed as shipping. I do not raise my voice for sport. Enlarge it. Now.',
    rate: 1.06,
    candidates: [
      { lang: 'en-US', voice: 'Rasalgethi', note: 'imperious?' },
      { lang: 'en-US', voice: 'Alnilam', note: 'hard-edged?' },
      { lang: 'en-US', voice: 'Enceladus', note: 'cold?' },
      { lang: 'en-US', voice: 'Achird', note: 'clipped?' }
    ]
  }
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const client = new textToSpeech.TextToSpeechClient({ projectId: PROJECT_ID });

  for (const [speaker, spec] of Object.entries(SPEAKERS)) {
    if (ONLY.length && !ONLY.includes(speaker)) continue;
    console.log(`— ${speaker} (default rate ${spec.rate}) —`);

    for (const [i, cand] of spec.candidates.entries()) {
      const name = `${cand.lang}-Chirp3-HD-${cand.voice}`;
      // A candidate may override the speaker's authored rate — rate is the only
      // prosody knob Chirp3 leaves us, so it is half the search space.
      const authored = cand.rate ?? spec.rate;
      const speakingRate = Number((authored * RATE_SCALE).toFixed(3));
      try {
        const [res] = await client.synthesizeSpeech({
          input: { text: spec.text },
          voice: { languageCode: cand.lang, name },
          // Chirp3 rejects pitch — rate is the only prosody knob.
          audioConfig: { audioEncoding: 'MP3', speakingRate }
        });
        const buf = Buffer.from(res.audioContent);
        const slug = `${speaker}-${i + 1}-${cand.lang}-${cand.voice}`.toLowerCase();
        await writeFile(path.join(OUT_DIR, `${slug}.mp3`), buf);
        console.log(
          `    ${String(i + 1).padStart(2)} ${name.padEnd(28)} rate ${String(authored).padEnd(5)} ` +
            `${String(Math.round(buf.length / 1024)).padStart(3)} KB  — ${cand.note}`
        );
      } catch (err) {
        console.log(
          `    ${String(i + 1).padStart(2)} ${name.padEnd(28)} ✗ ${err.message.slice(0, 60)}`
        );
      }
    }
    console.log('');
  }
  console.log(`mp3s in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
