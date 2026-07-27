# Baked audio assets

> How archislop's committed sound files are made, and why ElevenLabs is a **build-time dependency
> only**. Runtime audio (the synthesized cues in `agentChimes.js`, the office TTS voices via Google
> Cloud) is out of scope here — see [`docs/office-parody.md`](office-parody.md).

## The rule

**ElevenLabs never runs in CI or production.** It is a generator you invoke by hand, whose output
is committed to the repo. Concretely that means:

- No `ELEVENLABS_API_KEY` in Cloud Run, no Secret Manager entry, no `push-*-secret-cloud-run.sh`.
- No runtime latency, no rate limit, no third-party outage that can break the office.
- The office keeps working offline, which [`docs/office-parody.md`](office-parody.md) commits to.
- The free-tier quota is spent once per asset, not once per user session.

The key lives in `.env` for local generation only. If you find yourself adding it to a deploy
script, something has gone wrong.

## Why this shape

The free tier is **10,000 credits/month, non-commercial, with attribution**. The `eleven_text_to_
sound_v2` model bills **10 credits per second** of generated audio — measured, not documented: a
0.5 s probe returns `character-cost: 5`. So the month buys ~1,000 seconds of audio.

That is nothing for a runtime API and plenty for baking a permanent library. The shipped bed cost
300 credits — 3% of one month — and then costs nothing forever.

## Generating

```bash
./scripts/generate-office-audio.sh --dry-run   # print the credit cost, spend nothing
./scripts/generate-office-audio.sh             # generate, post-process, install
```

Requires `ELEVENLABS_API_KEY` in `.env` and `ffmpeg` on `PATH` (`apt install ffmpeg`). ffmpeg is
only needed to _regenerate_ — the committed `.mp3` means nobody else has to install anything.

Assets live in the `ASSETS` manifest at the top of the script, one line per file, with the prompt
recorded verbatim next to the asset it produced. Keep it that way: rewording a prompt produces a
different room, and re-rolling costs credits.

## Two kinds of asset

The manifest tags each asset `bed` or `cue`, and they are post-processed differently:

- **`bed`** — a seamless loop, generated with `loop: true`, levelled to a fixed loudness, never
  trimmed. One per room.
- **`cue`** — a one-shot event, trimmed to where the sound actually is and peak-normalized. The
  model pads a requested duration with room tone, and an untrimmed cue that starts 0.8 s late
  fires 0.8 s late.

## What the pipeline does, and why

| Step                                       | Why                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loop: true` (beds)                        | The API returns audio whose tail flows back into its head. On the shipped bed this holds up: zero silence padding at either edge, and the wrap-around sample step sits inside the interior range. No crossfade surgery needed.                                       |
| `duration_seconds: 30` (beds)              | The v2 ceiling. Longer loop = longer before the ear notices the repeat.                                                                                                                                                                                              |
| ffmpeg linear gain to −24 LUFS (beds)      | Every bed lands at the same level, so a second bed drops in without remixing. Deliberately a **pure gain**, never `loudnorm`'s dynamic mode — a bed must be levelled, not compressed.                                                                                |
| Trim to content, 20 ms / 150 ms pad (cues) | Cut where the sound starts, keep enough tail for the decay, with 8 ms/30 ms fades so the cut cannot click.                                                                                                                                                           |
| Peak-normalize to −3 dBFS (cues)           | **`officeCueSamples.js` depends on this ceiling**: each cue's playback gain is the old synth `peakGain` ÷ 0.708, so the sample peaks exactly where the hand-tuned synth cue peaked. Change the ceiling and you silently rebalance every cue — update that table too. |
| ffmpeg re-encode to 64 kbps joint stereo   | `output_format` is **silently ignored on the free tier** (every value returns 128 kbps stereo), so the size reduction has to happen locally: 481 KB → 240 KB for the bed.                                                                                            |
| Stereo kept, not collapsed to mono         | The beds carry real width — L/R correlation ≈ 0.36 on the shipped one, side only 3.2 dB below mid. Mono flattens the room to a hiss. Joint stereo at 64k costs the same as mono at 64k, so width is free.                                                            |

Loudness across generated cues varies wildly (−9.8 LUFS for the espresso machine against −43.2 for
the chair squeak), which is exactly why cues are peak-normalized to a common ceiling and balanced
by per-cue playback gain rather than shipped at whatever level the model chose.

### Verifying a new asset

Before committing a regenerated bed, check the loop actually holds:

```bash
ffmpeg -i bed.mp3 -ac 1 -ar 44100 -f wav bed.wav      # then compare, in the decoded PCM:
#  - leading/trailing near-silence  → must be 0 samples (codec padding would click each lap)
#  - |sample[0] - sample[n-1]|      → must sit inside the interior step distribution
#  - head vs tail 500 ms RMS        → must match within ~1 dB (or it thumps on the wrap)
```

`apps/web/test/officeRoomTone.test.js` covers the playback side; the asset side is a one-off check
at generation time.

## Consuming an asset

Assets go in `apps/web/src/assets/audio/` and are **imported**, not dropped in `public/`, so Vite
emits them content-hashed and cache-busts on redeploy. The import is just a URL string in the
bundle — the file is not downloaded until something calls `fetch()` on it, which for the room-tone
bed only happens once the user has turned sound on.

Playback belongs in a dedicated module (`apps/web/src/utils/officeRoomTone.js`), which must degrade
to a silent no-op wherever `AudioContext`, `fetch`, or `decodeAudioData` are missing — jsdom tests,
old browsers, blocked autoplay. A missing or undecodable asset is never worth a broken office.

## Licensing — read before adding an asset

The free tier is **non-commercial use, with attribution**. Two consequences:

1. Attribution must stay visible. It currently lives in [`README.md`](../README.md); if you add
   assets, do not quietly drop it.
2. If archislop ever becomes commercial, these assets need relicensing (a paid ElevenLabs tier
   grants commercial rights) or replacing. Everything generated by this pipeline is listed in the
   script's `ASSETS` manifest, which is deliberately the single place to audit.

## Current inventory

All paths below are relative to `apps/web/src/assets/audio/`.

| Asset                  | Kind | Length | Size   | Cost | Used by                                                                  |
| ---------------------- | ---- | ------ | ------ | ---- | ------------------------------------------------------------------------ |
| `office-room-tone.mp3` | bed  | 30 s   | 240 KB | 300  | `officeRoomTone.js` — the soundscape bed                                 |
| `cue-keyboard.mp3`     | cue  | 2.4 s  | 19 KB  | 30   | `officeCueSamples.js` — ambient desk typing (biased while at desk)       |
| `cue-paper.mp3`        | cue  | 1.6 s  | 13 KB  | 20   | ambient shuffle + diegetic follow-up after the printer                   |
| `cue-printer.mp3`      | cue  | 3.2 s  | 24 KB  | 30   | ambient distant printer + diegetic when you walk up to the floor printer |
| `cue-chair.mp3`        | cue  | 1.5 s  | 12 KB  | 20   | ambient + stand up / sit down                                            |
| `cue-watercooler.mp3`  | cue  | 2.1 s  | 17 KB  | 30   | ambient only (cooler is scenery on the floor today — §6 rule 21)         |
| `cue-espresso.mp3`     | cue  | 3.9 s  | 31 KB  | 40   | ambient + accepting a coffee break (floor machine or invite)             |
| `cue-vending.mp3`      | cue  | 2.5 s  | 20 KB  | 40   | ambient set piece                                                        |

**Total: 379 KB, 510 credits.** The `elevator`, `phone` and `mouse` cues are deliberately absent —
they are tones, and stay synthesized in `agentChimes.js`.

## Status and outstanding work

_Last updated 2026-07-27._

**Quota ledger.** 1,130 of the month's 10,000 credits were spent producing the current inventory:
510 on the assets that shipped, and 620 on exploration that did not (two rejected bed variants at
300 each, plus 20 in probes). Regenerating everything in the manifest costs 510. Assume roughly
**8,900 credits were left in the July 2026 window**; the allowance resets monthly, so check before
planning a large batch rather than trusting this number.

**Open, in rough order of value:**

1. **`ROOM_TONE_GAIN` has never been tuned by ear in the running app.** It is `0.09` in
   `officeRoomTone.js`, derived so the bed sits under cues peaking 0.006–0.014, and approved from
   an offline mix that got the _relative_ balance right. Absolute presence against a real system
   volume is a different judgement. Costs nothing to change — one constant, no regeneration.
2. **Diegetic prop cues are wired for the printer and coffee; the water cooler is still
   unreachable** on the isometric floor (§6 rule 21). If a standable mark is found for the cooler,
   `cuesForProp('waterCooler')` already returns the watercooler sample — no second wiring pass.
3. **Per-room beds.** One bed currently plays everywhere. The isometric floor has rooms, so a
   meeting-room or kitchen tone would make moving through the office change what you hear. 300
   credits each; `officeRoomTone.js` would need to swap buffers on a crossfade rather than
   assuming a single asset.
4. **A second variant for the highest-weight cues.** `keyboard` has weight 7 in
   `officeSoundscape.js` and an at-desk bias on top — it fires far more often than any set piece, so
   it is the first sample that will wear thin. Rate/gain jitter and panning delay that, they do not
   prevent it. A second `cue-keyboard-b.mp3` picked at random would; 30 credits.
5. **Nothing verifies a regenerated asset automatically.** The loop-seam and level checks under
   "Verifying a new asset" are a manual ritual. If beds get regenerated often, fold them into the
   generator as a post-step that fails loudly.

**Deliberately not done:** no runtime ElevenLabs calls, no key in deploy scripts, no Opus/Ogg
variants (MP3 is universally supported and the size difference did not justify format negotiation
at one bed — revisit if per-room beds land and the total climbs past ~1 MB).
