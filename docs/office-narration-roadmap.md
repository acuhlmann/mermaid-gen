# Office narration — TTS roadmap & research log

> Companion to [`office-parody.md`](office-parody.md). Written for a **small / personal**
> deploy on **GCP Cloud Run**. Sections 2–3 are the **historical** research that chose GCP
> WaveNet first; **§1 + Phase B++ describe what ships today** (Chirp3-HD ladder).

## 1. What we already shipped

| Surface            | Spoken today?                                                                 | Notes                                                                  |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Walk-bys           | Yes — Chirp3-HD (→ Neural2 → WaveNet ladder) when configured, else Web Speech | Overheard colleague; cancels on dismiss / Focus Time                   |
| WG meeting beats   | Yes — paced to playback end                                                   | User raise-hand lines stay silent                                      |
| Cubicle battles    | Yes — lines + winner verdict spoken                                           | Overheard argument (invite pill stays text-only)                       |
| Coffee break scene | Yes — watercooler lines paced + spoken when Narration is on                   | Invite toast stays text-only; opt-in scene is overheard                |
| Emails             | **No**                                                                        | Realistic: nobody reads your inbox aloud                               |
| IM pings           | **No**                                                                        | Chat notifications — you read them                                     |
| Meeting invites    | No (calendar chime only)                                                      | You read the toast                                                     |
| Soundscape         | N/A (non-verbal SFX)                                                          | Stays Web Audio + baked cues; see [`audio-assets.md`](audio-assets.md) |

**Desk posture:** 🎧 **Headphones** (macro over `narration` / `soundscape` / `captions` via
`setOfficeHeadphones` — not a separate Voice toggle). Per-scene **CC** buttons still nudge
`captions` directly. When CC is off and TTS succeeds, speech bubbles hide (`shouldShowSpokenText`
in `apps/web/src/utils/officeCaptions.js`; floor wiring in `officeFloor/useFloorSpokenText.js`).
A silent or failed TTS beat falls back to the bubble so the line is never lost. Global sound gate

- first-gesture policy still apply on mobile Safari/Chrome. Focus Time cancels in-flight speech.

**Cloud path:** `POST /api/office/speak` → `apps/server/src/agents/officeTts.js` (Chirp3-HD
default where published, with a Chirp3-HD → Neural2 → WaveNet fallback ladder; in-memory cache).
Kill switch `OFFICE_TTS=0`; tier pin `OFFICE_TTS_VOICE_TIER=chirp3|neural2|wavenet` (default
`chirp3`). Health exposes `officeTtsConfigured`. Client (`officeNarration.js`) prefers cloud MP3,
falls back to Web Speech.

**Locale reality (do not re-break):**

| Locale | Default tier | Ladder                        | Notes                                                                     |
| ------ | ------------ | ----------------------------- | ------------------------------------------------------------------------- |
| en-US  | Chirp3-HD    | Chirp3-HD → Neural2 → WaveNet | full three-rung ladder; optional accent overrides (e.g. Dinesh → `en-IN`) |
| en-AU  | Chirp3-HD    | Chirp3-HD → Neural2 → WaveNet | full three-rung ladder                                                    |
| zh-CN  | Chirp3-HD    | Chirp3-HD → WaveNet           | no Neural2 cmn-CN voices, so that rung is skipped                         |
| zh-TW  | WaveNet      | WaveNet                       | Google publishes **neither** Neural2 nor Chirp3-HD for `cmn-TW`           |

`CHIRP_LANG_CODE` deliberately omits `zh-TW`. Re-check with `listVoices` before re-adding it —
offering a Chirp rung that cannot exist burns one failed request per line.

**Cast map:** one Chirp3-HD voice per speaker in `CHIRP3_VOICE_ROSTER` (widened past the old
eight-voice core). Chirp drops `pitch`; rate fingerprints stay in the WaveNet table.
Ear-audition spikes live under `scripts/` (`cast-audition.mjs`, `chirp3-audition.mjs`,
`gemini-tts-spike.mjs`) — throwaway; never wire into routes, CI, or deploy.

---

## 2. Historical research — why GCP WaveNet first (archived)

> The recommendation below chose WaveNet as the **first** cloud tier. That path shipped (Phase B),
> then Neural2 (B+), then Chirp3-HD as default (B++). Keep this section as rationale; do not treat
> “skip Chirp” as current product advice.

**Original call: Google Cloud Text-to-Speech (WaveNet), on the existing GCP project.**

Why that fit archislop specifically at the time:

1. **Already on GCP** — Cloud Run + Vertex ADC path in [`docs/deploy/gcp.md`](deploy/gcp.md). Same project, same service account pattern; enable `texttospeech.googleapis.com` and grant the runtime SA. No new cloud bill / identity stack.
2. **Volume is tiny** — a couple of users, walk-bys + meetings only. WaveNet’s **free tier is 4M characters/month** ([official pricing](https://cloud.google.com/text-to-speech/pricing)). A busy personal session might burn a few thousand characters; you are unlikely to leave the free tier.
3. **“Decent, not best”** — WaveNet was a clear step up from browser TTS at Standard pricing. Studio / early Chirp / Gemini-TTS looked like broadcast-grade spend for parody lines — later Chirp3-HD proved cheap enough at personal volume _and_ unlocked `cmn-CN`, which is why it became the default.
4. **Locales you already ship** — en-US / en-AU / zh-CN / zh-TW map cleanly to Cloud TTS voice catalogs.
5. **Provider-swappable** — treat TTS as a **generic subdomain**: one `synthesizeOfficeLine({ speakerId, text, lang })` behind an interface so Polly / Azure / ElevenLabs can replace Google later without rewriting `OfficeLayer`.

### What _not_ to pick as a first vendor (still true)

| Option                                | Why defer                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ElevenLabs**                        | Best-in-class emotional voices; extra vendor + subscription. Runtime ElevenLabs is forbidden — baked assets only ([`audio-assets.md`](audio-assets.md)). |
| **Amazon Polly**                      | Fine quality/price; wrong cloud unless you leave GCP.                                                                                                    |
| **Azure Speech**                      | Strong enterprise catalog; adds Azure identity for little gain here.                                                                                     |
| **Self-hosted** (Kokoro, Piper, etc.) | Fun for offline demos; ops burden vs Cloud Run free-tier TTS.                                                                                            |

---

## 3. Provider snapshot (research, mid‑2026)

Prices move — always re-check [Google Cloud TTS pricing](https://cloud.google.com/text-to-speech/pricing) before changing tiers.

| Provider                | Decent tier (ballpark) | Free / low-volume note             | Fit for us (today)                            |
| ----------------------- | ---------------------- | ---------------------------------- | --------------------------------------------- |
| **GCP Chirp 3 HD**      | ~$30 / 1M chars        | 1M free                            | **Shipped default** (where published)         |
| **GCP Neural2**         | ~$16 / 1M chars        | 1M chars/mo free                   | Ladder rung / `OFFICE_TTS_VOICE_TIER=neural2` |
| **GCP WaveNet**         | ~$4 / 1M chars         | **4M chars/mo free**               | Ladder floor; **only** tier for zh-TW         |
| **GCP Studio**          | ~$160 / 1M chars       | 1M free                            | Skip                                          |
| **Azure Neural**        | ~$4–16 / 1M            | ~0.5M free/mo                      | Only if multi-cloud                           |
| **Amazon Polly Neural** | ~$16 / 1M              | Large first-year free on AWS       | Only if on AWS                                |
| **ElevenLabs**          | Subscription / credit  | Tiny free tier; paid plans for API | Build-time bake only                          |

**Personal-project math:** even Chirp3-HD’s 1M free chars/month is far more than a handful of
meetings and walk-bys; only the top of the ladder ever bills (fallbacks fire only on failure).

---

## 4. Concrete upgrade ladder

### Phase A — UX polish on Web Speech (no new bill)

Cheap wins while Cloud TTS is optional:

**Phase A is complete (2026-08-01).** Three of its four items turned out to be already built — this
list had gone stale, which is worth knowing before trusting any other "still open" line in this doc.

1. ~~**Duck the soundscape**~~ — ✅ **already shipped**, and had been for a while:
   `OfficeLayer.narrateLine` calls `duckRoomTone()` before `speakOfficeLine` and restores it in a
   `.finally`, so it survives a failed or cancelled line.
2. ~~**Speaker sting**~~ — ✅ **shipped 2026-08-01**. `apps/web/src/utils/officeSpeakerStings.js`
   maps a persona to an existing `agentChimes` player, and `narrateLine` fires it through the
   priming call it was already making — the sound gate, the one-shot timing, and the mobile
   audio-context warm-up all came for free. Deliberately **only five colleagues** (Pam, Dave,
   Linda, Gary, Chad): a cue before all sixteen voices is a metronome, and a tone assigned for no
   reason is something the user has to learn. Everyone else gets `null` and just starts talking.
3. ~~**Caption karaoke**~~ — ✅ **shipped 2026-08-01**, and smaller than it looked. Speaker-level
   highlighting already existed everywhere (`HuddleOverlay`'s `is-speaking` seat plus its
   "{name} is talking" label; `MeetingFilmStrip`'s `lastSpeakerId`; the directory's speaking card).
   The one real gap was the meeting **transcript**, where every beat rendered identically.
   `activeCaptionIndex` (`officeCaptions.js`) marks the newest line while a voice is actually in
   the air, and returns -1 the moment it is not — a finished meeting must not have a line
   pretending to still be spoken. Not applied to the coffee/battle cards: they reveal every line at
   once by design, so there is no "current" line to mark.
4. ~~**Directory “Hear sample”**~~ — ✅ **already shipped**: `DirectoryRoster` renders a
   per-colleague `IntroVoiceButton` wired through `useIntroNarrator` → `speakOfficeLine` →
   `POST /api/office/speak`, with stop-on-second-click. Only the first-run onboarding cards lack
   one, which is correct — they auto-play during the cinematic tour.
5. ~~**IM narration**~~ — **won’t do** for realism (chat stays text); keep emails silent too.

### Phase B — Cloud TTS behind the same Narration toggle

~~**Shipped:**~~ dedicated `POST /api/office/speak`, WaveNet cast map + prosody in
`officeTts.js`, client prefers cloud MP3 then Web Speech, battles + coffee spoken.

### Phase B+ — Neural2 tier (shipped)

WaveNet got its scheduled upgrade: **Neural2 became the default** for locales that have one,
switched by `OFFICE_TTS_VOICE_TIER` (then `neural2` default, `wavenet` = instant switchback).
Same `synthesizeSpeech` request shape, same speakingRate/pitch prosody — only the voice names
change (`NEURAL2_VOICE_NAMES` overlay; prosody stays in the WaveNet table as the single source).

| Locale | Tier at B+ | Notes                                                                                      |
| ------ | ---------- | ------------------------------------------------------------------------------------------ |
| en-US  | Neural2    | A/C/D/E/F/G/H/I/J — no B, so helpdesk/critique (Wavenet-B males) remap to J/A, same gender |
| en-AU  | Neural2    | A/B/C/D — letters and genders identical to the WaveNet set                                 |
| zh-CN  | WaveNet    | No Neural2 cmn-CN voices                                                                   |
| zh-TW  | WaveNet    | No Neural2 **or** Chirp 3 HD — WaveNet is still the top tier here                          |

### Phase B++ — Chirp3-HD tier + fallback ladder (shipped)

The default tier moved to **Chirp3-HD** for every locale that has one. The reason it superseded
the early “skip it” call was **Chinese**: Neural2 ships no `cmn-*` voices, so zh-CN was stuck on
WaveNet, whereas Chirp3-HD covers `cmn-CN`. Chirp3-HD honours `speakingRate` (rate fingerprints
survive) but **not** `pitch` (dropped for the Chirp tier only).

> **Correction (2026-08-01):** an earlier draft claimed Chirp3-HD covers `cmn-TW` as well.
> It does not — `listVoices` returns Chirp3-HD for `cmn-CN` and `yue-HK` only. zh-TW spent a
> period firing one guaranteed-to-fail Chirp request per line before falling through. Fixed by
> dropping `zh-TW` from `CHIRP_LANG_CODE`. Re-check with `listVoices` before re-adding it.

Rather than a static per-locale tier, `officeTts.js` synthesises down a **runtime fallback
ladder** (`resolveOfficeTtsVoiceCandidates` → `synthesizeOfficeSpeech` loop): Chirp3-HD → Neural2 →
WaveNet → (client) Web Speech. `OFFICE_TTS_VOICE_TIER` pins the ladder's top
(`chirp3` default, `neural2`, `wavenet`).

~~**Eight-voice roster**~~ — ✅ widened: `CHIRP3_VOICE_ROSTER` is one voice per speaker (all 30
Chirp3-HD names are available for en-\* and cmn-CN). English accent overrides live in
`CHIRP3_ACCENT_LANG` (apply only when the Chirp language is already English — under zh-CN the
speaker must speak Mandarin). Some picks are deliberate ear-matches, not gender bugs (e.g.
Richard → `Gacrux`); do not “fix” by gender alone — re-audition with `scripts/cast-audition.mjs`.

**Still useful follow-ups:**

- Batch meeting-script audio during the “waiting to be admitted” gag (fewer round-trips).
- Optional GCS cache for hot canned lines across Cloud Run instances.
- ~~Phase A polish still open~~ — **Phase A is complete as of 2026-08-01** (see §4 Phase A; the
  soundscape duck and the directory “Hear sample” had already been built when that line was
  written).
- Re-listen in the [Cloud TTS console](https://console.cloud.google.com/speech/text-to-speech) when a character feels off.

**Env / deploy:**

- Enable API: `gcloud services enable texttospeech.googleapis.com --project=PROJECT_ID`
- IAM: no predefined role for standard synthesis — API enable + runtime SA with project access (default compute SA already has `roles/editor`)
- Kill switch: `OFFICE_TTS=0` → Web Speech fallback
- Tier pin: `OFFICE_TTS_VOICE_TIER=chirp3|neural2|wavenet`
- Project id: same `VERTEX_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` resolution as Vertex

**Cost control:**

- In-memory LRU already caches identical lines (battle/coffee templates repeat).
- Never synthesize emails / IMs.
- Cap chars per utterance (500) — truncate with ellipsis for TTS only; UI keeps full text.
- Optional next: batch meeting-script synthesize during join gag latency.

### Phase C — Pre-bake canned audio (~70% of office noise)

Battle/coffee/walk-by fallbacks are **static templates**. Generate Opus/MP3 once per template id × locale (script under `scripts/`), ship or CDN-cache them. Live TTS only for LLM walk-bys and meeting beats. Cuts latency and cross-instance cache misses.

### Phase D — Optional polish

- Streaming TTS for very long beats (usually unnecessary — beats are short).
- Word timestamps → seat highlight / caption sync.
- ElevenLabs (or Chirp) **only** as a build-time “premium voices” bake if you ever want it — never a runtime dependency.

---

## 5. Suggested implementation order

1. ~~Server WaveNet + `/api/office/speak` + Web Speech fallback~~ ✅
2. ~~Speak battles + coffee (overheard) while keeping email/IM silent~~ ✅
3. ~~Phase A polish~~ — ✅ done 2026-08-01 (see §4 Phase A).
4. Batch meeting-script synthesize during join latency.
5. Phase C bake canned battle/coffee/walk-by templates.
6. ~~Re-evaluate Neural2~~ ✅ (Phase B+); ~~Chirp 3 HD as default~~ ✅ (Phase B++) — unlocks `cmn-CN`, honours `speakingRate`, only bills at the top of the fallback ladder; zh-TW stays WaveNet.
7. ~~Widen Chirp roster + English accent overrides~~ ✅ (`CHIRP3_VOICE_ROSTER` / `CHIRP3_ACCENT_LANG`).

---

## 6. Acceptance checks

- [x] Same Headphones / Focus / global mute behavior as the Web Speech MVP (consumers read `narration` / `soundscape` / `captions`, never a `headphones` flag)
- [x] Emails / IMs never synthesize
- [x] Offline / API failure → Web Speech or reading-pace timers (no error toast)
- [x] en-AU / zh-CN / zh-TW map onto voice tables (Chirp3 for en-\* + zh-CN; WaveNet for zh-TW)
- [x] Chirp ladder skips zh-TW without a failed request (`CHIRP_LANG_CODE` omits it)
- [x] Synthesize **server-side only** (`POST /api/office/speak`)
- [ ] Character usage stays under the free tier in production (spot-check Metrics Explorer after deploy)
- [ ] `texttospeech.googleapis.com` enabled on deploy project (runtime SA already has Editor on `mermaidgen`)

---

## Related

- [`office-parody.md`](office-parody.md) — desk verbs, presence, agency doctrine
- [`audio-assets.md`](audio-assets.md) — build-time ElevenLabs room tone / cues (not runtime TTS)
- [`deploy/gcp.md`](deploy/gcp.md) — enable Cloud TTS on Cloud Run
- [`recipes/replicate-tv-character.md`](recipes/replicate-tv-character.md) — adding a cast member (incl. TTS rows)
