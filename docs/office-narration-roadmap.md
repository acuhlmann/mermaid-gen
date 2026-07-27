# Office narration — next steps & TTS research

> Roadmap after the Web Speech MVP (`apps/web/src/utils/officeNarration.js`).
> Companion to [`office-parody.md`](office-parody.md). Written for a **small / personal**
> deploy on **GCP Cloud Run** (a couple of users): decent voice quality, not
> industry-best; minimize new vendors and monthly bills.

## 1. What we already shipped

| Surface            | Spoken today?                                                                 | Notes                                                   |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Walk-bys           | Yes — Chirp3-HD (→ Neural2 → WaveNet ladder) when configured, else Web Speech | Overheard colleague; cancels on dismiss / Focus Time    |
| WG meeting beats   | Yes — paced to playback end                                                   | User raise-hand lines stay silent                       |
| Cubicle battles    | Yes — lines + winner verdict spoken                                           | Overheard argument (invite pill stays text-only)        |
| Coffee break scene | Yes — watercooler lines paced + spoken when Narration on                      | Invite toast stays text-only; opt-in scene is overheard |
| Emails             | **No**                                                                        | Realistic: nobody reads your inbox aloud                |
| IM pings           | **No**                                                                        | Chat notifications — you read them                      |
| Meeting invites    | No (calendar chime only)                                                      | You read the toast                                      |
| Soundscape         | N/A (non-verbal SFX)                                                          | Stays Web Audio synthesized cues                        |

Toggle: desk menu **Voice** (default on). **Transcript (CC)** (`archislop:office-captions`, default off) reveals spoken text when voice is playing — shared across the card tour, isometric floor, desk walk-bys, and inbox footer. When CC is off and TTS succeeds, speech bubbles hide (`shouldShowSpokenText` in `apps/web/src/utils/officeCaptions.js`; floor wiring in `officeFloor/useFloorSpokenText.js`). A silent or failed TTS beat falls back to the bubble so the line is never lost. Global sound gate + first-gesture policy still apply on mobile Safari/Chrome.

**Cloud path:** `POST /api/office/speak` → `apps/server/src/agents/officeTts.js` (Chirp3-HD default for every locale, with a Chirp3-HD → Neural2 → WaveNet fallback ladder; in-memory cache). Kill switch `OFFICE_TTS=0`; tier switch `OFFICE_TTS_VOICE_TIER=neural2|wavenet`. Health exposes `officeTtsConfigured`. Client (`officeNarration.js`) prefers cloud MP3, falls back to Web Speech.

---

## 2. Recommended next direction (for this project)

**Default recommendation: Google Cloud Text-to-Speech (WaveNet), on the existing GCP project.**

Why this fits archislop specifically:

1. **Already on GCP** — Cloud Run + Vertex ADC path in [`docs/deploy/gcp.md`](deploy/gcp.md). Same project, same service account pattern; enable `texttospeech.googleapis.com` and grant the runtime SA. No new cloud bill / identity stack.
2. **Volume is tiny** — a couple of users, walk-bys + meetings only. WaveNet’s **free tier is 4M characters/month** ([official pricing](https://cloud.google.com/text-to-speech/pricing)). A busy personal session might burn a few thousand characters; you are unlikely to leave the free tier.
3. **“Decent, not best”** — WaveNet is a clear step up from browser TTS and costs the same as Standard ($4 / 1M after free). Skip Studio ($160 / 1M), Chirp 3 HD ($30 / 1M), and Gemini-TTS token pricing for now — those optimize for broadcast / agent-grade realism you do not need.
4. **Locales you already ship** — en-US / en-AU / zh-CN / zh-TW map cleanly to Cloud TTS voice catalogs; keep using `mailAnnounceLang` (or a dedicated narration lang) as the synthesis locale.
5. **Provider-swappable** — treat TTS as a **generic subdomain** (see modularity notes in `.cursor/skills/modularity/`): one `synthesizeOfficeLine({ speakerId, text, lang })` behind an interface so Polly / Azure / ElevenLabs can replace Google later without rewriting `OfficeLayer`.

### What _not_ to pick first

| Option                                | Why defer                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ElevenLabs**                        | Best-in-class emotional voices; extra vendor + subscription for quality you said you do not need yet. Revisit if cast “acting” becomes the product. |
| **Amazon Polly**                      | Fine quality/price; wrong cloud unless you leave GCP.                                                                                               |
| **Azure Speech**                      | Strong enterprise catalog; adds Azure identity for little gain here.                                                                                |
| **Chirp 3 / Studio / Gemini-TTS**     | Overkill cost/complexity for parody office lines.                                                                                                   |
| **Self-hosted** (Kokoro, Piper, etc.) | Fun for offline demos; ops burden vs Cloud Run free-tier TTS.                                                                                       |

---

## 3. Provider snapshot (research, mid‑2026)

Prices move — always re-check [Google Cloud TTS pricing](https://cloud.google.com/text-to-speech/pricing) before implementing.

| Provider                | Decent tier (ballpark) | Free / low-volume note             | Fit for us                             |
| ----------------------- | ---------------------- | ---------------------------------- | -------------------------------------- |
| **GCP WaveNet**         | ~$4 / 1M chars         | **4M chars/mo free**               | **Best default**                       |
| **GCP Neural2**         | ~$16 / 1M chars        | 1M chars/mo free                   | Optional upgrade if WaveNet feels flat |
| **GCP Chirp 3 HD**      | ~$30 / 1M chars        | 1M free                            | Skip unless chasing “wow”              |
| **GCP Studio**          | ~$160 / 1M chars       | 1M free                            | Skip                                   |
| **Azure Neural**        | ~$4–16 / 1M            | ~0.5M free/mo                      | Only if multi-cloud                    |
| **Amazon Polly Neural** | ~$16 / 1M              | Large first-year free on AWS       | Only if on AWS                         |
| **ElevenLabs**          | Subscription / credit  | Tiny free tier; paid plans for API | Quality flex, not cost/stack fit       |

**Personal-project math:** even Neural2’s 1M free chars/month is far more than a handful of meetings and walk-bys. Prefer WaveNet first (free pool is larger and price after free matches Standard).

---

## 4. Concrete upgrade ladder

### Phase A — UX polish on Web Speech (no new bill)

Cheap wins while Cloud TTS is optional:

1. **Duck the soundscape** while a line is speaking (gain → ~30%).
2. **Speaker sting** before speech (reuse existing chimes: calendar for Pam, ticket blip for Dave).
3. **Caption karaoke** — optional underline of the active walk-by / meeting bubble (accessibility + mobile without headphones).
4. **Directory “Hear sample”** — one canned line per colleague in `OfficeDirectory` so users audition voices.
5. ~~**IM narration**~~ — **won’t do** for realism (chat stays text); keep emails silent too.

### Phase B — Cloud TTS behind the same Narration toggle

~~**Shipped:**~~ dedicated `POST /api/office/speak`, WaveNet cast map + prosody in
`officeTts.js`, client prefers cloud MP3 then Web Speech, battles + coffee spoken.

### Phase B+ — Neural2 tier (shipped)

WaveNet got its scheduled upgrade: **Neural2 is the default voice tier** for locales that
have one, switched by `OFFICE_TTS_VOICE_TIER` (`neural2` default, `wavenet` = instant
switchback to the old cast). Same `synthesizeSpeech` request shape, same
speakingRate/pitch prosody — only the voice names change (`officeTts.js`
`NEURAL2_VOICE_NAMES` overlay; prosody stays in the WaveNet table as the single source).

| Locale | Default tier | Notes                                                                                      |
| ------ | ------------ | ------------------------------------------------------------------------------------------ |
| en-US  | Neural2      | A/C/D/E/F/G/H/I/J — no B, so helpdesk/critique (Wavenet-B males) remap to J/A, same gender |
| en-AU  | Neural2      | A/B/C/D — letters and genders identical to the WaveNet set                                 |
| zh-CN  | WaveNet      | No Neural2 cmn-CN voices exist (Chirp 3 HD exists but skips rate/pitch control)            |
| zh-TW  | WaveNet      | No Neural2 **or** Chirp 3 HD — WaveNet is the top tier here                                |

Cost: Neural2 free tier is 1M chars/month (vs WaveNet's 4M), then $16 / 1M chars — still
effectively $0 at personal-app volume (~6,700 typical lines/month would exhaust the free pool).

### Phase B++ — Chirp3-HD tier + fallback ladder (shipped)

The default tier moved again to **Chirp3-HD** for _every_ locale. The reason it superseded the
"skip it" call above is **Chinese**: Neural2 ships no `cmn-*` voices, so zh was stuck on WaveNet,
whereas Chirp3-HD covers `cmn-CN` / `cmn-TW` — so zh finally gets the newest voices too. The
earlier "no rate control" objection is stale: Chirp3-HD honours `speakingRate`, so the per-persona
_rate_ fingerprints survive. It does **not** support `pitch`, so `synthesizeSpeech` drops pitch for
the Chirp tier only (WaveNet / Neural2 still carry it).

Rather than a static per-locale tier, `officeTts.js` now synthesises down a **runtime fallback
ladder** (`resolveOfficeTtsVoiceCandidates` → `synthesizeOfficeSpeech` loop): Chirp3-HD → Neural2 →
WaveNet → (client) Web Speech "system voice". Any rung's API failure falls through to the next, so
a Chirp outage silently degrades to Neural2, a Neural2 gap to WaveNet, and a total cloud failure to
the browser — no error ever reaches the user. `OFFICE_TTS_VOICE_TIER` pins the ladder's top
(`chirp3` default, `neural2`, `wavenet`). Chirp3-HD uses the eight locale-independent core voices
(`Aoede`/`Kore`/`Leda`/`Zephyr` female, `Puck`/`Charon`/`Fenrir`/`Orus` male), gender-matched to
each persona's WaveNet letter (`CHIRP3_VOICE_ROSTER`).

| Locale | Default tier | Ladder                        | Notes                                             |
| ------ | ------------ | ----------------------------- | ------------------------------------------------- |
| en-US  | Chirp3-HD    | Chirp3-HD → Neural2 → WaveNet | full three-rung ladder                            |
| en-AU  | Chirp3-HD    | Chirp3-HD → Neural2 → WaveNet | full three-rung ladder                            |
| zh-CN  | Chirp3-HD    | Chirp3-HD → WaveNet           | no Neural2 cmn-CN voices, so that rung is skipped |
| zh-TW  | Chirp3-HD    | Chirp3-HD → WaveNet           | no Neural2 cmn-TW voices, so that rung is skipped |

Cost note: Chirp3-HD is ~$30 / 1M chars after a 1M free pool — still effectively $0 at
personal-app volume, and only the top of the ladder ever bills (fallbacks fire only on failure).

**Still useful follow-ups:**

- Batch meeting-script audio during the “waiting to be admitted” gag (fewer round-trips).
- Optional GCS cache for hot canned lines across Cloud Run instances.
- Re-listen in the [Cloud TTS console](https://console.cloud.google.com/speech/text-to-speech) and tweak voice ids if a character feels off.

**Env / deploy (required for WaveNet in production):**

- Enable API: `gcloud services enable texttospeech.googleapis.com --project=PROJECT_ID`
- IAM: no predefined role for standard synthesis — API enable + runtime SA with project access (default compute SA already has `roles/editor`)
- Kill switch: `OFFICE_TTS=0` → Web Speech fallback
- Project id: same `VERTEX_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` resolution as Vertex

**Cost control (even though free tier should cover you):**

- In-memory LRU already caches identical lines (battle/coffee templates repeat).
- Never synthesize emails / IMs.
- Cap chars per utterance (500) — truncate with ellipsis for TTS only; UI keeps full text.
- Optional next: batch meeting-script synthesize during join gag latency.

### Phase C — Pre-bake canned audio (~70% of office noise)

Battle/coffee/walk-by fallbacks are **static templates**. Generate Opus/MP3 once per template id × locale (script under `scripts/`), ship or CDN-cache them. Live TTS only for LLM walk-bys and meeting beats. Cuts latency and cross-instance cache misses.

### Phase D — Optional polish

- Streaming TTS for very long beats (usually unnecessary — beats are short).
- Word timestamps → seat highlight / caption sync.
- ElevenLabs (or Chirp) **only** for a “premium voices” Easter egg if you ever want it.

---

## 5. Suggested implementation order

1. ~~Server WaveNet + `/api/office/speak` + Web Speech fallback~~ ✅
2. ~~Speak battles + coffee (overheard) while keeping email/IM silent~~ ✅
3. Phase A polish (duck soundscape, speaker sting, directory “Hear sample”).
4. Batch meeting-script synthesize during join latency.
5. Phase C bake canned battle/coffee/walk-by templates.
6. ~~Re-evaluate Neural2~~ ✅ shipped as a tier (Phase B+); ~~Chirp 3 HD skipped~~ ✅ now the default tier (Phase B++) — it honours `speakingRate`, unlocks Chinese `cmn-*` voices, and only bills at the top of the fallback ladder.

---

## 6. Acceptance checks (Phase B)

- [x] Same Narration / Focus Time / global mute behavior as Web Speech MVP
- [x] Emails / IMs never synthesize
- [x] Offline / API failure → Web Speech or reading-pace timers (no error toast)
- [x] en-AU / zh-CN / zh-TW map onto voice tables (Neural2 for en locales, WaveNet for zh)
- [x] Synthesize **server-side only** (`POST /api/office/speak`)
- [ ] Character usage stays under the Neural2 1M-char free tier in production (spot-check Metrics Explorer after deploy)
- [ ] `texttospeech.googleapis.com` enabled on deploy project (runtime SA already has Editor on `mermaidgen`)

---

## 7. Pointers

| Piece                    | Path / link                                     |
| ------------------------ | ----------------------------------------------- |
| Current client narration | `apps/web/src/utils/officeNarration.js`         |
| Meeting pacing hook      | `apps/web/src/hooks/useMeetingPlayback.js`      |
| Office design + cadence  | [`office-parody.md`](office-parody.md)          |
| GCP deploy / SA pattern  | [`deploy/gcp.md`](deploy/gcp.md)                |
| Official TTS pricing     | https://cloud.google.com/text-to-speech/pricing |
| Official TTS docs        | https://cloud.google.com/text-to-speech/docs    |
