# Baked audio assets

> How archislop's committed sound files are made, and why ElevenLabs is a **build-time dependency
> only**. Runtime audio (the synthesized cues in `agentChimes.js`, the office TTS voices via Google
> Cloud Chirp3-HD / Neural2 / WaveNet) is out of scope here — see [`docs/office-parody.md`](office-parody.md)
> and [`docs/office-narration-roadmap.md`](office-narration-roadmap.md).

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
./scripts/generate-office-audio.sh cue-laugh   # generate ONE asset, post-process, install, verify
./scripts/generate-office-audio.sh --verify    # re-check what is installed, free
./scripts/generate-office-audio.sh             # the whole manifest — 900 credits, overwrites all
```

**Name the asset.** The bare form regenerates all 24 and overwrites every committed `.mp3`; the
`ONLY` argument takes a single name, so a batch is one invocation per asset. That is also the
cheaper habit — a bad take costs 20–40 credits to re-roll instead of the run.

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

| Step                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loop: true` (beds)                        | The API returns audio whose tail flows back into its head. On the shipped bed this holds up: zero silence padding at either edge, and the wrap-around sample step sits inside the interior range. No crossfade surgery needed.                                                                                                                                                                                     |
| `duration_seconds: 30` (beds)              | The v2 ceiling. Longer loop = longer before the ear notices the repeat.                                                                                                                                                                                                                                                                                                                                            |
| ffmpeg linear gain to −24 LUFS (beds)      | Every bed lands at the same level, so a second bed drops in without remixing. Deliberately a **pure gain**, never `loudnorm`'s dynamic mode — a bed must be levelled, not compressed.                                                                                                                                                                                                                              |
| Trim to content, 20 ms / 150 ms pad (cues) | Cut where the sound starts, keep enough tail for the decay, with 8 ms/30 ms fades so the cut cannot click.                                                                                                                                                                                                                                                                                                         |
| Peak-normalize to −3 dBFS (cues)           | **`officeCueSamples.js` depends on this ceiling**: each cue's playback gain is the old synth `peakGain` ÷ 0.708, so the sample peaks where the hand-tuned synth cue peaked. Change the ceiling and you silently rebalance every cue — update that table too. Applied to the WAV; the encoder then moves it by up to ~2.6 dB, so treat the ceiling as an anchor rather than a guarantee (see "Verifying an asset"). |
| ffmpeg re-encode to 64 kbps joint stereo   | `output_format` is **silently ignored on the free tier** (every value returns 128 kbps stereo), so the size reduction has to happen locally: 481 KB → 240 KB for the bed.                                                                                                                                                                                                                                          |
| Stereo kept, not collapsed to mono         | The beds carry real width — L/R correlation ≈ 0.36 on the shipped one, side only 3.2 dB below mid. Mono flattens the room to a hiss. Joint stereo at 64k costs the same as mono at 64k, so width is free.                                                                                                                                                                                                          |

Loudness across generated cues varies wildly (−9.8 LUFS for the espresso machine against −43.2 for
the chair squeak), which is exactly why cues are peak-normalized to a common ceiling and balanced
by per-cue playback gain rather than shipped at whatever level the model chose.

### Verifying an asset

**This is automatic now.** Every generated asset is checked the moment it is installed, and the
whole committed bank can be re-checked for free:

```bash
./scripts/generate-office-audio.sh --verify              # all 24, no API calls, no credits
./scripts/generate-office-audio.sh --verify cue-laugh    # just one
```

`--verify` needs neither the API key nor the network — it only reads what is already on disk. It
exits non-zero if anything **FAILS**, so it is safe to wire into a check if that is ever wanted.
It stays out of CI on purpose: the assets are committed and immutable, so the only moment the
answer can change is when somebody regenerates one, which is exactly when it already runs.

| Check                               | Applies to | Verdict | Why                                                                                  |
| ----------------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------ |
| duration ≥ 0.2 s                    | both       | FAIL    | The content-trim ate the cue — its start threshold is tuned for a mechanical attack. |
| peak ≤ −0.5 dBFS                    | cue        | FAIL    | Close enough to full scale that the encoder may clip it.                             |
| peak within 3.5 dB of −3 dBFS       | cue        | WARN    | The ceiling the whole gain table is anchored on.                                     |
| no near-silence at either edge      | bed        | FAIL    | Codec padding clicks once per lap.                                                   |
| wrap-around step ≤ interior p99     | bed        | FAIL    | An audible seam where the loop rejoins.                                              |
| head vs tail 500 ms RMS within 1 dB | bed        | WARN    | Otherwise the wrap thumps.                                                           |
| integrated loudness vs −24 LUFS     | bed        | WARN    | Beds are levelled so a second one drops in without remixing.                         |

It also **prints the integrated loudness of every asset, pass or fail**, because that is the input
to the loudness-matched gain derivation below — measuring it here is what stops the next batch
guessing.

Two things worth knowing about the measurement itself, both learned by getting them wrong first:

- **Peak is read from the installed stereo `.mp3`, never from a mono downmix.** A downmix averages
  the channels, so a peak living mostly in one of them reads up to 6 dB quiet and invents failures.
  Measured on `cue-door-badge`: −10.2 dB downmixed against **−5.6 dB** real. Geometry (edge silence,
  the loop seam) still uses a mono decode, which is what those checks want.
- **A failed check does not abort a generation run.** The credits are already spent and the file is
  already on disk by the time it runs; the useful outcome is a verdict on every asset in the batch,
  not a stop at the first bad one. The script exits non-zero at the end instead.

`apps/web/test/officeRoomTone.test.js` covers the playback side.

#### What the automation found immediately

The shipped bank passes all 24. But running it revealed something the manual ritual never would
have, because the ritual only ever looked at beds:

**Post-encode peaks span −1.4 dB to −5.6 dB against a −3 dBFS target.** The pipeline normalizes the
_WAV_ to exactly −3, and then LAME at 64 kbps moves it by up to ~2.6 dB in either direction. So the
sentence this document repeats — "each asset is peak-normalized to −3 dBFS, so its playback gain is
just `synthPeakGain / 0.708`" — is true of the intermediate file and only approximately true of the
`.mp3` that ships. The gain table inherits that couple of dB of slop. It is not worth chasing (it is
well inside what the ear pass in open item 6 would adjust anyway), but it does mean **the ceiling is
an anchor, not a guarantee**, and a cue that looks 2 dB off in the table may simply be an encoder
artifact rather than a mistake. `CUE_PEAK_TOLERANCE_DB` is set to 3.5 dB for exactly this reason —
tighter and it cries wolf on every batch.

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

| Asset                     | Kind | Length | Size  | Cost | Fires on                                                            |
| ------------------------- | ---- | ------ | ----- | ---- | ------------------------------------------------------------------- |
| `cue-footstep-carpet.mp3` | cue  | 1.8 s  | 14 KB | 20   | every walk leg on carpet — you, walk-bys, wanderers                 |
| `cue-footstep-hard.mp3`   | cue  | 2.0 s  | 17 KB | 20   | the same, in the kitchen and the lobby (`floorSurfaceAt`)           |
| `cue-chairs-gather.mp3`   | cue  | 2.8 s  | 23 KB | 30   | a **mob** huddle seating; a pair keeps the single `cue-chair`       |
| `cue-door-badge.mp3`      | cue  | 1.8 s  | 14 KB | 30   | Day One check-in, **plus** ambient (weight 0.5) since the free pass |
| `cue-keyboard-b.mp3`      | cue  | 3.0 s  | 24 KB | 30   | second take of `cue-keyboard`, picked at random                     |
| `cue-whiteboard.mp3`      | cue  | 1.9 s  | 16 KB | 20   | walking up to the whiteboard, **plus** ambient (weight 0.7)         |
| `cue-fridge.mp3`          | cue  | 0.7 s  | 6 KB  | 20   | ambient, weighted ×3 while you stand in the kitchen zone            |

**Adds 116 KB and 170 credits** for a running total of **495 KB, 680 credits**.

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

### The free pass — what the bank already owned

Generated 2026-08-02. **Zero credits, zero new assets.** Run before buying anything else, on the
principle that a batch you have already paid for should be fully audible before the next one is
commissioned. Three of these four were pure loss, not polish:

1. **`cue-chairs-gather.mp3` had never made a sound.** 30 credits, a `SAMPLES` row, a
   `SYNTH_CUE_PLAYERS` row, a manifest line, a paragraph in `office-parody.md` §6 written in the
   present tense — and no call site anywhere in `apps/web`. Now fired from `handleStartHuddle`
   (`OfficeLayer.jsx`), mob only, behind the pair-of-nobody guard.
2. **`cue-whiteboard` and `cue-door-badge` were diegetic-only**, so each could play at most once
   per session and never at all for a user who skipped the gesture. Both gained ambient
   `CUE_WEIGHTS` rows (0.7 / 0.5). The door's `spread` went 0 → 0.8 in the same change; it had
   been dead weight because `makePanner` short-circuits on `near` before reading it.
3. **Ambient cues did not yield to speech.** The bed ducks to 0.03 under narration; cues kept
   firing at up to 0.028, i.e. _above_ the bed they are mixed to sit under. The director now holds
   on `isOfficeNarrationBusy()` and defers rather than drops.

**The testing lesson is the durable part.** `officeCuePlayers.test.js` asserts every scheduled cue
has a synth fallback and every sampled cue has one too — both green while `chairsGather` was
silent, because both ask whether a cue **could** play and neither asks whether anything plays it.
A cue whose trigger lives in a component can only be pinned at the call site, and a `playChime` spy
cannot help you: it receives an opaque closure. `officeLayerHuddleCue.test.jsx` mocks
`officeCueChime` instead and asserts on the **cue name**. Copy that shape for the next one — and
note the diagnostic it produced when run against the old code, `expected [] to include
'chairsGather'`, where the empty array _is_ the bug.

### Slice 3 — the room has people in it

Generated 2026-08-02. Nine cues, **220 credits**, no re-rolls.

Every cue in the two batches above is an **object**: keyboard, mouse, paper, printer, chair, phone,
cooler, espresso, vending, elevator, fridge. The bed murmurs distant conversation, but a bed is a
texture — it has no position and cannot be an event, so across a whole session nothing in this
office ever coughed or laughed. That was the palette's only structural hole, and it is also the one
category synthesis cannot even attempt.

| Asset                       | Kind | Length | Size  | Cost | Fires on                                                          |
| --------------------------- | ---- | ------ | ----- | ---- | ----------------------------------------------------------------- |
| `cue-laugh.mp3`             | cue  | 2.6 s  | 21 KB | 30   | ambient, weight 0.45 — the lowest in the table, a joke you missed |
| `cue-cough.mp3`             | cue  | 1.2 s  | 10 KB | 20   | ambient, weight 0.8                                               |
| `cue-phone-buzz.mp3`        | cue  | 2.0 s  | 16 KB | 20   | ambient, weight 1.1; ×1.6 in the pod                              |
| `cue-crowd-settle.mp3`      | cue  | 4.0 s  | 32 KB | 40   | an all-hands reaching `state: 'playing'` (§10.4)                  |
| `cue-applause.mp3`          | cue  | 3.0 s  | 24 KB | 30   | an all-hands completing, alongside the confetti                   |
| `cue-server-rack.mp3`       | cue  | 2.0 s  | 16 KB | 20   | ambient, weight 0.6; **×3.2 in the pod** — the zone's own event   |
| `cue-footstep-carpet-b.mp3` | cue  | 2.0 s  | 16 KB | 20   | second take of `cue-footstep-carpet`                              |
| `cue-footstep-hard-b.mp3`   | cue  | 2.0 s  | 16 KB | 20   | second take of `cue-footstep-hard`                                |
| `cue-paper-b.mp3`           | cue  | 1.7 s  | 14 KB | 20   | second take of `cue-paper`                                        |

**Adds 165 KB and 220 credits** for a running total of **648 KB, 900 credits**. Still comfortably
under the ~1 MB mark at which the "Deliberately not done" note says to revisit Opus/Ogg.

#### A different way of deriving `gain`, and why this batch needed one

Every earlier cue's playback gain is `synthPeakGain / 0.708` — inherited from the synthesized cue it
replaced. Four of these have **no predecessor and no synth fallback**, so that rule has nothing to
inherit from. They are matched by measured **integrated loudness** instead:

```
gain = 10 ^ ((target_dB − LUFS) / 20)
```

where `target_dB` is the effective playback level. This is the number peak-normalizing cannot give
you: the pipeline equalizes **peaks**, and a 2 s phone buzz carries far more energy under an
identical peak than a paper shuffle does. Measured, `cue-phone-buzz` came in at **−8.2 LUFS** — the
hottest source in the bank, 20 dB above `cue-keyboard` — and would have swamped the room at any
peak-derived gain.

The interesting part is that the hand-tuned table **already worked this way** and never said so:

| Cue              | gain   | source LUFS | effective |
| ---------------- | ------ | ----------- | --------- |
| `printer`        | 0.0099 | −14.9       | −55.0 dB  |
| `keyboard`       | 0.028  | −28.1       | −59.2 dB  |
| `paper`          | 0.018  | −26.4       | −61.3 dB  |
| `fridge`         | 0.0099 | −21.1       | −61.2 dB  |
| `footstepCarpet` | 0.007  | −23.3       | −66.4 dB  |
| `footstepHard`   | 0.007  | −28.4       | −71.5 dB  |

Keyboard is the **quietest** source and carries the **highest** gain; the printer is the loudest
source on one of the lowest gains. The band in use runs −55 dB (the most present set piece) to
−71 dB (footsteps, which repeat inside a single gesture). Slice 3 targets −63/−64 for the ambient
people and the rack, −58 for the two all-hands cues.

**This is loudness-matching, not attention-matching.** A laugh pulls the ear far harder than a
printer at identical LUFS, so these still want the ear pass in open item 6 — the method just means
the starting point is measured rather than guessed.

#### Two design decisions worth carrying

- **Four cues have no synth fallback, on purpose.** `SILENT_UNTIL_SAMPLED` in `officeCuePlayers.js`
  names `laugh`, `cough`, `crowdSettle`, `applause`. The rule that produced every earlier fallback —
  "sample broadband texture, synthesize tones" — quietly assumed a fallback is always at least worth
  having, and for a cough it is not: a synthesized laugh would not read as a cheap laugh, it would
  read as a bug. Silence costs almost nothing, because `primeOfficeAudio` warms every buffer the
  moment the audio gate opens and the brain schedules nothing in a session's first 4 s. It is an
  **allowlist, not an escape hatch** — the test suite asserts every sampled cue is either in
  `SYNTH_CUES` or named here, and that nothing is in both.
- **`cue-server-rack` buys the pod the way `cue-fridge` bought the kitchen.** A `ZONE_CUES` row
  (×3.2) and a 20-credit cue, against 300 for a bed and a crossfading multi-buffer player. The rack
  was already a `FLOOR_PROPS` entry sitting in that zone with nothing to say.

**On generating human sounds**, since this was the first batch to try: the takes needed no re-rolls,
but two things are worth knowing. The trim step cuts at 2 % of peak and is tuned for a mechanical
attack, so a soft onset can lose its first moment — `cue-cough` trimmed to 1.2 s of a requested 2 s
and wants a listen. And `cue-crowd-settle` arrived at −24.9 dB peak, needing **+21.9 dB** to reach
the ceiling, which lifts the take's noise floor with it; its 18.4 dB crest afterwards suggests it
survived, but that is an inference from numbers, not an ear.

## Status and outstanding work

_Last updated 2026-08-02._

**Quota ledger.** The allowance is monthly. July 2026 spent **1,340 of 10,000**; August opened
fresh and slice 3 is the only draw against it so far:

| Batch                  | Month    | Shipped | Wasted  | Note                                                     |
| ---------------------- | -------- | ------- | ------- | -------------------------------------------------------- |
| Bed + first seven cues | Jul 2026 | 510     | 620     | two rejected bed variants at 300 each, plus 20 in probes |
| Slice 2 (seven cues)   | Jul 2026 | 170     | 20      | one whiteboard take lost to the CRLF trap above          |
| Slice 3 (nine cues)    | Aug 2026 | 220     | 0       | **no re-rolls** — first batch to need none               |
| **Total shipped**      |          | **900** | **640** |                                                          |

Regenerating everything now in the manifest costs 900. Roughly **9,780 credits remained in the
August window** after slice 3; the allowance resets monthly, so check the dashboard before planning
a large batch rather than trusting this number.

Slice 3 spending zero on re-rolls is worth a caveat before it becomes a rule: the batch contained
no bed (where re-rolls actually hurt, at 300 a throw), and "no re-roll" here means **no take was
regenerated**, not that every take was auditioned and approved. The ear pass is still owed.

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
   cue row, so the next reachable prop cannot ship silent the way the whiteboard did — **but note
   what that assertion did not catch**, per "The free pass" above: a cue can have every row the
   test suite knows to look for and still have no trigger.
3. ~~**Per-room beds.**~~ ✅ **zone-shaped single bed** — `setRoomToneZone` + `floorZoneToneAt`
   colour the existing loop (kitchen brighter, glass muffled, pod bassier) without new assets.
   Slice 2 added the other half — `ZONE_CUES` weights a room's own _events_, not just its timbre.
   True multi-buffer beds still want ElevenLabs regeneration, and are now the weakest item here.
4. ~~**A second variant for the highest-weight cues.**~~ ✅ **done, and extended.** `SAMPLES` takes
   a `urls` array keyed `${cue}:${index}` in `buffers`/`loading`. `pickBuffer` chooses among the
   variants that have actually **decoded**, not among all of them — rolling first and checking
   second would fall back to synthesis half the time while take B was still downloading. Slice 3
   took this to **four** multi-take cues: `keyboard`, `paper`, and both footstep surfaces. The
   footsteps mattered most and were not the obvious pick — keyboard fires more often per session,
   but footsteps are the only cue that repeats _within one gesture_ (once per walk leg), which is a
   much shorter path to noticing a loop. Encouraging for the "same prompt = second take" rule: the
   three new takes landed within ~2 dB of their originals, which is what makes one shared `gain`
   across variants honest rather than approximate.
5. ~~**Nothing verifies a regenerated asset automatically.**~~ ✅ **done** — the loop-seam and level
   checks run as a post-install step in the generator, plus a free `--verify` mode that re-checks
   the committed bank without an API key or the network. See "Verifying an asset" above for the
   check table. Three things about how it was built are worth carrying:
   - **The verifier was tested by breaking assets on purpose**, not by observing it pass. Five
     deliberate corruptions (a clipped cue, a cue 10 dB under target, a cue trimmed to 0.1 s, a bed
     with padded silence, a bed whose tail sits 6 dB under its head) each produced the intended
     verdict, restored with `git checkout --` between runs. A checker that has only ever said OK is
     not evidence of anything — this is the same reasoning as the huddle-cue test in "The free pass".
   - **It reports rather than blocks.** Warnings do not fail; only structural damage does. The
     temptation with a new checker is to make everything an error, which trains people to skip it.
   - **It cannot replace the ear pass** (open item 6), and nothing here should be read as though it
     does. It answers "is this asset structurally sound", never "does this sound right".
6. **Sixteen gains have now been derived and none have been heard** — the seven from slice 2, the
   six new ones in slice 3, plus the door in its new ambient role. This is the single largest
   outstanding item, it costs nothing to fix, and it is the one thing in this document that no
   amount of measurement can substitute for. **The order to listen in: footsteps, then the laugh,
   then the door.** Every older cue's `gain` is
   `synthPeakGain / 0.708`, inherited from the cue it replaced. These had no predecessor, so the
   figure is derived from the peak written for their own synth fallback — coherent with the
   0.006–0.014 range, but nobody has listened. **Footsteps are the one to check first**: they are
   pitched below that derivation on purpose (0.007) because they are the only cue that repeats
   _within_ a single gesture. Worth knowing that the takes came out at very different source levels
   (the door needed +5.1 dB to reach the ceiling, `cue-fridge` only −2.4), and peak-normalizing to a
   common ceiling equalizes peaks, not perceived loudness — which is exactly what an ear pass
   catches and the pipeline cannot.

   **The door is now the second one to check.** Its 0.0127 is the highest gain in the slice-2 block
   and was derived for a `near` play — the Day One check-in, where it is additionally multiplied by
   `NEAR_GAIN`. Since the free pass it also plays _ambiently_, at that same 0.0127, which is louder
   than the printer (0.0099) across the room. It was left alone deliberately: swapping one unheard
   number for another unheard number is not an improvement, and the +5.1 dB it needed at source
   hints its perceived loudness sits below what its peak implies. Decide it with ears, not algebra.

   **The slice-3 six are a different kind of unheard.** They were derived from measured integrated
   loudness rather than from an inherited synth peak (see "A different way of deriving `gain`"), so
   their _relative_ balance should already be close — the arithmetic is sound. What measurement
   cannot decide is **`laugh`**, which is loudness-matched to the ambient set at −63 dB effective
   but is the only cue in the bank a person will look up for. If exactly one number in this document
   turns out to be wrong, it is that one, and the fix is a weight change or a gain cut, not a
   regeneration.

**Deliberately not done:** no runtime ElevenLabs calls, no key in deploy scripts, no Opus/Ogg
variants (MP3 is universally supported and the size difference did not justify format negotiation
at one bed — revisit if per-room beds land and the total climbs past ~1 MB).
