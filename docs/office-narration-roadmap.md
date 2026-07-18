# Office narration — next steps & TTS research

> Roadmap after the Web Speech MVP (`apps/web/src/utils/officeNarration.js`).
> Companion to [`office-parody.md`](office-parody.md). Written for a **small / personal**
> deploy on **GCP Cloud Run** (a couple of users): decent voice quality, not
> industry-best; minimize new vendors and monthly bills.

## 1. What we already shipped

| Surface          | Spoken today?                           | Notes                                     |
| ---------------- | --------------------------------------- | ----------------------------------------- |
| Walk-bys         | Yes (Web Speech + pitch/rate profile)   | Cancels on dismiss / Focus Time           |
| WG meeting beats | Yes (paced to `audioended` when spoken) | User raise-hand lines stay silent         |
| Emails           | **No**                                  | Realistic: nobody reads your inbox aloud  |
| IM pings         | No                                      | Glanceable; optional later                |
| Coffee / battles | No                                      | Scripted theater — good Tier-2 candidates |
| Soundscape       | N/A (non-verbal SFX)                    | Stays Web Audio synthesized cues          |

Toggle: inbox **Narration** (default on). Global sound gate + first-gesture policy still apply on mobile Safari/Chrome.

**Limits of Web Speech (why upgrade later):** voice set differs per OS/browser; iOS loads voices asynchronously; quality is “system robot with character quirks,” not a stable Chad/Pam across devices.

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
5. **IM narration** — only the first ~80 chars of a ping, rate-limited (still never emails).

### Phase B — Cloud TTS behind the same Narration toggle (recommended)

Architecture sketch (keep client dumb):

```
Client OfficeLayer / useMeetingPlayback
  → speakOfficeLine() today (Web Speech)
  → later: prefer playOfficeAudio(url | blob) when server returns audio

Server (new thin module, e.g. apps/server/src/agents/officeTts.js)
  → synthesize(text, voiceName, lang) via @google-cloud/text-to-speech
  → cache key: hash(text + voiceName + lang) → memory / optional GCS
  → return { audioBase64, mimeType: 'audio/mpeg', durationMs? }
    or signed URL if caching in GCS

Wire options (pick one):
  1. Piggyback on existing POST /api/office/moment and /api/office/meeting
     — attach audio[] to LLM responses (meeting: batch all beats during “waiting to be admitted”)
  2. Dedicated POST /api/office/speak { speakerId, text, lang }
     — simpler cache; client calls per walk-by / beat
```

**Voice cast mapping** (illustrative — lock real voice names after listening in the [Cloud TTS console](https://console.cloud.google.com/speech/text-to-speech)):

| Cast id       | Direction                    | Example WaveNet-style target        |
| ------------- | ---------------------------- | ----------------------------------- |
| `intern`      | Young, bright, slightly fast | `en-US-Wavenet-D` (or similar)      |
| `scrumMaster` | Warm facilitator             | `en-US-Wavenet-F`                   |
| `helpdesk`    | Flat, tired                  | lower-pitched Standard/WaveNet male |
| `facilities`  | Gruff                        | low male WaveNet                    |
| `hr`          | Bright / cheerful            | high female WaveNet                 |
| `greybeard`   | Slow, grave                  | low male, slower speakingRate       |
| `ciso`        | Clipped, cool                | mid male, slightly faster           |
| Stakeholders  | One WaveNet each             | reuse meeting seat map              |

Use SSML `prosody rate/pitch` lightly so we keep comedy without leaving WaveNet.

**Env / deploy:**

- Enable API: `gcloud services enable texttospeech.googleapis.com`
- IAM: Cloud Run runtime SA needs `roles/cloudtts.user` (or broader Speech client role — confirm current role id in IAM docs)
- Kill switch: `OFFICE_TTS=0` → Web Speech fallback (same pattern as `ANYTHING_RUNTIME_CHECK`)
- Optional: `OFFICE_TTS_VOICE_TIER=wavenet|neural2`

**Cost control (even though free tier should cover you):**

- Cache canned templates from `officeCast.js` aggressively (build-time MP3s or first-request cache).
- Only synthesize walk-bys + meeting beats (never email bodies).
- Cap chars per utterance (e.g. 500) — truncate with ellipsis for TTS only; UI keeps full text.
- Meeting: one batch synthesize of the script during join gag latency.

### Phase C — Pre-bake canned audio (~70% of office noise)

Most emails/IMs/coffee/battle lines are **static templates**. Generate Opus/MP3 once per template id × locale (script under `scripts/` or a one-shot Cloud Function), ship or CDN-cache them. Live TTS only for LLM walk-bys and meeting substantive beats. Best latency + zero per-session cost for battles/coffee if you later narrate those.

### Phase D — Optional polish

- Narrate coffee / battle lines (Phase C assets).
- Streaming TTS for very long beats (usually unnecessary — beats are short).
- Word timestamps → seat highlight / caption sync.
- ElevenLabs (or Chirp) **only** for a “premium voices” Easter egg if you ever want it.

---

## 5. Suggested implementation order

1. Phase A items that make Web Speech feel less thin (duck + sting + directory sample).
2. Server `officeTts` module + WaveNet cast map + `OFFICE_TTS` kill switch + Web Speech fallback.
3. Attach audio to `/api/office/meeting` (biggest perceived win — meetings are the flagship).
4. Walk-by live synthesize via `/api/office/speak` or moment response field.
5. Phase C bake for battle/coffee if those get narration.
6. Re-evaluate Neural2 / Chirp only if WaveNet still feels cheap after living with it.

---

## 6. Acceptance checks (when someone builds Phase B)

- [ ] Same Narration / Focus Time / global mute behavior as Web Speech MVP
- [ ] Emails never synthesize
- [ ] Offline / API failure → silent degrade to Web Speech or reading-pace timers (in-fiction, no error toast)
- [ ] en-AU / zh-CN / zh-TW pick locale-appropriate voices
- [ ] Cloud Run SA works without a user API key in the browser (synthesize **server-side only**)
- [ ] Character usage stays obviously under WaveNet free tier for personal traffic (spot-check Metrics Explorer)

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
