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

### Slice 2 — the moments that were dead air

Seven cues aimed at moments with no sound at all, rather than at deepening cues that already
worked. Generated 2026-07-31.

| Asset                     | Kind | Length | Size  | Cost | Fires on                                                              |
| ------------------------- | ---- | ------ | ----- | ---- | --------------------------------------------------------------------- |
| `cue-footstep-carpet.mp3` | cue  | 1.8 s  | 14 KB | 20   | every walk leg on carpet — you, walk-bys, wanderers                   |
| `cue-footstep-hard.mp3`   | cue  | 2.0 s  | 17 KB | 20   | the same, in the kitchen and the lobby (`floorSurfaceAt`)             |
| `cue-chairs-gather.mp3`   | cue  | 2.8 s  | 23 KB | 30   | a **mob** huddle seating; a pair keeps the single `cue-chair`         |
| `cue-door-badge.mp3`      | cue  | 1.8 s  | 14 KB | 30   | Day One check-in, one render after the gate opens                     |
| `cue-keyboard-b.mp3`      | cue  | 3.0 s  | 24 KB | 30   | second take of `cue-keyboard`, picked at random                       |
| `cue-whiteboard.mp3`      | cue  | 1.9 s  | 16 KB | 20   | walking up to the whiteboard — usable since slice 9, silent until now |
| `cue-fridge.mp3`          | cue  | 0.7 s  | 6 KB  | 20   | ambient, weighted ×3 while you stand in the kitchen zone              |

**Adds 116 KB and 170 credits** for a running total of **495 KB, 680 credits**.

Two of these are worth flagging as design decisions rather than content:

- **`cue-fridge` is ambient, not a prop cue.** The fridge is scenery and `FLOOR_PROP_USES` stays at
  four — `officeFloorProps.js` argues the number in prose, and a fifth usable prop would be a
  product change smuggled in as an audio one. Instead `ZONE_CUES` in `officeSoundscape.js` weights
  the kitchen's own cues while you stand there. That buys most of what a per-room bed would (open
  item 3) for 20 credits instead of 300, and needs no crossfading multi-buffer player.
- **Both footstep surfaces share one synth fallback.** Telling carpet from vinyl is exactly what
  synthesis cannot do, which is the reason they are sampled; pretending otherwise in the fallback

Two of these are worth flagging as design decisions rather than content:

- **`cue-fridge` is ambient, not a prop cue.** The fridge is scenery and `FLOOR_PROP_USES` stays at
  four — `officeFloorProps.js` argues the number in prose, and a fifth usable prop would be a
  product change smuggled in as an audio one. Instead `ZONE_CUES` in `officeSoundscape.js` weights
  the kitchen's own cues while you stand there. That buys most of what a per-room bed would (open
  item 3) for 20 credits instead of 300, and needs no crossfading multi-buffer player.
- **Both footstep surfaces share one synth fallback.** Telling carpet from vinyl is exactly what
  synthesis cannot do, which is the reason they are sampled; pretending otherwise in the fallback
  would just be two names for one sound.

**Ordering, learned the hard way:** add the `SAMPLES` rows in `officeCueSamples.js` **last**. Vite
resolves `import url from '…/cue-x.mp3'` at build time, so a row whose file does not exist is a hard
build failure, not a graceful fallback. Everything else about a cue — the synth fallback, the
trigger, the weight — can and should land first, because that keeps the moment audible while the
asset is pending.

**Three environment traps this generation hit**, all now handled in the script so the next run does
not rediscover them:

1. **`python3` on Windows is the Microsoft Store alias stub.** It is on `PATH`, so `command -v`
   succeeds; running it prints an ad and exits. The script now probes candidates (`python3`,
   `python`, `py`) for one that actually reports Python 3, and fails up front rather than
   mid-generation looking like an API error.
2. **Windows Python writes CRLF and `$(…)` strips only the LF.** The stray `\r` rides into ffmpeg
   as part of a number, which rejects it as `Invalid duration for option t: 2.000` — after the API
   call has already been billed. Numeric hand-offs now go through a `pynum` helper that strips it.
   (The JSON request body does not need it: a trailing `\r` is insignificant JSON whitespace.)
3. **A UTF-8 BOM in `.env`** made the shell try to run `<BOM>PORT=4000` as a command and abort under
   `set -e`. Stripped on the way in rather than by rewriting `.env`, which is on CLAUDE.md's
   don't-touch list.

Trap 2 is the expensive one: it burned 20 credits on a take that was generated and then discarded,
which is the argument for generating one asset at a time on any unfamiliar machine.

## Status and outstanding work

_Last updated 2026-07-31._

**Quota ledger.** **1,340 of July 2026's 10,000 credits** spent in total:

| Batch                  | Shipped | Wasted  | Note                                                     |
| ---------------------- | ------- | ------- | -------------------------------------------------------- |
| Bed + first seven cues | 510     | 620     | two rejected bed variants at 300 each, plus 20 in probes |
| Slice 2 (seven cues)   | 170     | 20      | one whiteboard take lost to the CRLF trap above          |
| **Total**              | **680** | **640** |                                                          |

Regenerating everything now in the manifest costs 680. Assume roughly **8,660 credits were left in
the July window**; the allowance resets monthly, so check the dashboard before planning a large
batch rather than trusting this number.

Budget re-rolls, not just the manifest total: last time more credits went on rejected takes than on
shipped ones. Beds are where that happens (300 a roll); a 20-credit cue is cheap to re-roll, which
is the argument for generating one asset at a time rather than the whole manifest.

**Open, in rough order of value:**

1. **`ROOM_TONE_GAIN` has never been tuned by ear in the running app.** Derived so the bed sits
   under cues peaking 0.006–0.014, and approved from an offline mix that got the _relative_ balance
   right; absolute presence against a real system volume is a different judgement. Costs nothing to
   change — no regeneration. (The single constant this used to name is gone: the code now splits
   into `ROOM_TONE_GAIN_DESK = 0.055` and `ROOM_TONE_GAIN_FLOOR = 0.115`, with `ROOM_TONE_GAIN` kept
   as a deprecated alias. Both want the same by-ear pass.)
2. **Diegetic prop cues are wired for the printer, coffee and — since slice 2 — the whiteboard.
   The water cooler is still unreachable** on the isometric floor (§6 rule 21). If a standable mark
   is found for the cooler, `cuesForProp('waterCooler')` already returns the watercooler sample — no
   second wiring pass. `officeCuePlayers.test.js` now asserts every entry in `FLOOR_PROP_USES` has a
   cue row, so the next reachable prop cannot ship silent the way the whiteboard did.
3. ~~**Per-room beds.**~~ ✅ **zone-shaped single bed** — `setRoomToneZone` + `floorZoneToneAt`
   colour the existing loop (kitchen brighter, glass muffled, pod bassier) without new assets.
   Slice 2 added the other half — `ZONE_CUES` weights a room's own _events_, not just its timbre.
   True multi-buffer beds still want ElevenLabs regeneration, and are now the weakest item here.
4. ~~**A second variant for the highest-weight cues.**~~ ✅ `SAMPLES` takes a `urls` array keyed
   `${cue}:${index}` in `buffers`/`loading`, and `keyboard` has two takes. `pickBuffer` chooses
   among the variants that have actually **decoded**, not among all of them — rolling first and
   checking second would fall back to synthesis half the time while take B was still downloading.
   Adding a second take to `paper` (weight 2, the next most frequent) is now one manifest row and
   one array entry, 20 credits.
5. **Nothing verifies a regenerated asset automatically.** The loop-seam and level checks under
   "Verifying a new asset" are a manual ritual. If beds get regenerated often, fold them into the
   generator as a post-step that fails loudly.
6. **The seven slice-2 gains have not been heard.** Every older cue's `gain` is
   `synthPeakGain / 0.708`, inherited from the cue it replaced. These had no predecessor, so the
   figure is derived from the peak written for their own synth fallback — coherent with the
   0.006–0.014 range, but nobody has listened. **Footsteps are the one to check first**: they are
   pitched below that derivation on purpose (0.007) because they are the only cue that repeats
   _within_ a single gesture. Worth knowing that the takes came out at very different source levels
   (the door needed +5.1 dB to reach the ceiling, `cue-fridge` only −2.4), and peak-normalizing to a
   common ceiling equalizes peaks, not perceived loudness — which is exactly what an ear pass
   catches and the pipeline cannot.

**Deliberately not done:** no runtime ElevenLabs calls, no key in deploy scripts, no Opus/Ogg
variants (MP3 is universally supported and the size difference did not justify format negotiation
at one bed — revisit if per-room beds land and the total climbs past ~1 MB).
