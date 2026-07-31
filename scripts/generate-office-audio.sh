#!/usr/bin/env bash
#
# Build-time generator for the office audio assets (docs/audio-assets.md).
#
# ElevenLabs is a BUILD-TIME dependency only. Output is committed, so nothing
# here runs in CI or on Cloud Run: no ELEVENLABS_API_KEY in prod, no runtime
# latency, no quota risk, and the office still works offline. You only run this
# to add an asset or replace an existing one.
#
#   ./scripts/generate-office-audio.sh --dry-run          # print cost, spend nothing
#   ./scripts/generate-office-audio.sh                    # regenerate everything
#   ./scripts/generate-office-audio.sh cue-espresso       # regenerate one asset
#
# Needs ELEVENLABS_API_KEY in .env and ffmpeg on PATH.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSET_DIR="$REPO_ROOT/apps/web/src/assets/audio"
WORK_DIR="${TMPDIR:-/tmp}/archislop-office-audio"

# --- The manifest -----------------------------------------------------------
# name|kind|seconds|prompt_influence|prompt
#
# kind=bed  a seamless loop, levelled to a fixed loudness, never trimmed
# kind=cue  a one-shot, trimmed to its content and peak-normalized
#
# Prompts are recorded verbatim next to the asset they produced. Keep it that
# way: rewording a prompt gives a different room, and re-rolling costs credits.
#
# Only cues that synthesis genuinely loses on are sampled — broadband
# mechanical/textural sounds. The elevator ding, desk phone and mouse clicks
# stay synthesized in agentChimes.js, because synthesis is right for a tone.
ASSETS=(
  "office-room-tone|bed|30|0.3|office ambience, a few people are talking quietly in the background"
  "cue-keyboard|cue|3|0.55|Close-up mechanical keyboard typing, a short burst of about a dozen keystrokes, dry office recording, no music"
  "cue-paper|cue|2|0.55|Shuffling a small stack of paper sheets on a desk, close-up, dry, no music"
  "cue-printer|cue|3|0.55|Office laser printer printing two pages, motor whirr and paper feed, heard from across the room, no music"
  "cue-chair|cue|2|0.55|Office chair creaking as someone shifts their weight, then castors rolling a short distance on carpet, no music"
  "cue-watercooler|cue|3|0.55|Water cooler dispensing into a paper cup, then a large air bubble glugging up through the bottle, no music"
  "cue-espresso|cue|4|0.55|Espresso machine grinding beans then steaming milk, office kitchen, no music"
  "cue-vending|cue|4|0.55|Vending machine, a coin drops in, spiral motor turns, snack falls and thuds into the tray, no music"
  # Slice 2 — moments that were dead air rather than cues that needed deepening.
  #
  # The footsteps are two footfalls, not a walk cycle: useWalkAnimation fires
  # one cue per leg and clamps a leg to 420-2000 ms, so the walk itself is
  # already the rhythm. A longer sample would overlap its own next leg.
  "cue-footstep-carpet|cue|2|0.55|Two footsteps walking on office carpet, close-up, dry indoor recording, no music"
  "cue-footstep-hard|cue|2|0.55|Two footsteps walking on hard vinyl office flooring, close-up, dry indoor recording, no music"
  # Fires while the huddle ring is drawn and before the script exists, so it is
  # also the feedback that the click landed. Mob only — a pair keeps cue-chair.
  "cue-chairs-gather|cue|3|0.55|Several office chairs rolling and scraping on carpet as people sit down around a table, no music"
  "cue-door-badge|cue|3|0.55|Heavy glass office door pushed open and swinging shut, quiet lobby behind it, no music"
  # keyboard fires ~4x more than any other cue (weight 7 x at-desk boost 2.4),
  # so it wears first. Same prompt as cue-keyboard on purpose: a second take of
  # one sound, not a different sound.
  "cue-keyboard-b|cue|3|0.55|Close-up mechanical keyboard typing, a short burst of about a dozen keystrokes, dry office recording, no music"
  "cue-whiteboard|cue|2|0.55|Whiteboard marker squeaking as someone writes a few strokes, then the cap clicks on, close-up, no music"
  # Ambient, not a prop cue: the fridge is scenery and FLOOR_PROP_USES stays at
  # four. Weighted up in the kitchen zone, which is what gives that corner an
  # identity without a 300-credit room-tone bed of its own.
  "cue-fridge|cue|2|0.55|Office fridge door sucking open, bottles rattling in the shelf, door thudding shut, close-up, no music"
)

# Measured empirically, not documented: the v2 model bills 10 credits/second
# (a 0.5 s probe returned character-cost: 5). The free tier is 10,000/month.
CREDITS_PER_SECOND=10
# Beds: every bed lands here so a new one drops in at the level of the last.
BED_TARGET_LUFS=-24
# Cues: peak-normalized instead, because officeCueSamples.js derives each cue's
# playback gain from this exact ceiling (gain = old synth peakGain / 0.708).
# Changing it silently rebalances every cue — update that table too.
CUE_TARGET_PEAK_DB=-3
BITRATE=64k

DRY_RUN=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) ONLY="$arg" ;;
  esac
done

selected=()
for entry in "${ASSETS[@]}"; do
  IFS='|' read -r name _ _ _ _ <<<"$entry"
  [[ -z "$ONLY" || "$ONLY" == "$name" ]] && selected+=("$entry")
done
[[ ${#selected[@]} -gt 0 ]] || { echo "ERROR: no asset named '$ONLY' in the manifest" >&2; exit 1; }

total_seconds=0
for entry in "${selected[@]}"; do
  IFS='|' read -r _ _ secs _ _ <<<"$entry"
  total_seconds=$((total_seconds + secs))
done
echo "Manifest: ${#selected[@]} asset(s), ${total_seconds}s total"
echo "Estimated cost: $((total_seconds * CREDITS_PER_SECOND)) credits of the 10,000/month free tier"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "(dry run — nothing generated)"
  exit 0
fi

command -v ffmpeg >/dev/null || { echo "ERROR: ffmpeg not found (apt install ffmpeg)" >&2; exit 1; }

# Resolve an interpreter that actually runs Python 3. On Windows `python3` is
# usually the Microsoft Store alias stub: it exists on PATH, prints an ad about
# installing from the Store, and exits — so `command -v python3` is not enough,
# and the failure lands mid-generation looking like an API error. Probe instead.
PYTHON=""
for candidate in python3 python py; do
  command -v "$candidate" >/dev/null 2>&1 || continue
  "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1 ||
    continue
  PYTHON="$candidate"
  break
done
[[ -n "$PYTHON" ]] || { echo "ERROR: no working python3 on PATH" >&2; exit 1; }

# Python on Windows writes CRLF, and `$(...)` strips only the LF — the trailing
# \r then rides into ffmpeg as part of a number, which it rejects with the
# distinctly unhelpful "Invalid duration for option t: 2.000". Every numeric
# hand-off goes through here. (The JSON request body does not: a trailing \r is
# insignificant whitespace in JSON, so it is harmless there.)
pynum() { "$PYTHON" "$@" | tr -d '\r'; }
# A UTF-8 BOM on line 1 — which Windows editors add freely — would make the
# shell try to run `<BOM>PORT=4000` as a command and abort under `set -e`. Strip
# it on the way in rather than rewriting .env, which is not this script's to
# touch (see CLAUDE.md's don't-touch list).
# shellcheck disable=SC1090
set -a; . <(sed $'1s/^\xEF\xBB\xBF//' "$REPO_ROOT/.env"); set +a
[[ -n "${ELEVENLABS_API_KEY:-}" ]] || { echo "ERROR: ELEVENLABS_API_KEY missing from .env" >&2; exit 1; }

mkdir -p "$WORK_DIR" "$ASSET_DIR"
spent=0

for entry in "${selected[@]}"; do
  IFS='|' read -r name kind secs influence prompt <<<"$entry"
  raw="$WORK_DIR/$name.raw.mp3"
  echo
  echo "→ $name ($kind, ${secs}s): $prompt"

  # `loop: true` is what makes a bed seamless — the API returns audio whose
  # tail flows back into its head. Verified on the shipped bed: no silence
  # padding at either edge and a wrap-around sample step well inside the
  # interior range, so no crossfade surgery is needed.
  #
  # `output_format` is silently IGNORED on the free tier — every value returns
  # 128 kbps stereo — which is why size reduction happens in ffmpeg below.
  loop=false
  [[ "$kind" == "bed" ]] && loop=true
  body=$(REQ_PROMPT="$prompt" REQ_SECS="$secs" REQ_INFL="$influence" REQ_LOOP="$loop" "$PYTHON" -c '
import json, os
print(json.dumps({
  "text": os.environ["REQ_PROMPT"],
  "duration_seconds": float(os.environ["REQ_SECS"]),
  "prompt_influence": float(os.environ["REQ_INFL"]),
  "loop": os.environ["REQ_LOOP"] == "true",
  "model_id": "eleven_text_to_sound_v2",
}))')

  headers="$WORK_DIR/$name.headers"
  curl -sS -D "$headers" -o "$raw" \
    -X POST "https://api.elevenlabs.io/v1/sound-generation" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$body"

  if [[ "$(stat -c%s "$raw")" -lt 2000 ]]; then
    echo "ERROR: generation failed:" >&2; cat "$raw" >&2; echo >&2; exit 1
  fi
  cost=$(grep -i '^character-cost:' "$headers" | tr -d '\r' | awk '{print $2}')
  spent=$((spent + ${cost:-0}))
  echo "  spent ${cost:-?} credits"

  if [[ "$kind" == "bed" ]]; then
    measured=$(ffmpeg -hide_banner -nostats -i "$raw" -af ebur128=framelog=quiet -f null /dev/null 2>&1 |
      grep -A1 'Integrated' | grep 'I:' | awk '{print $2}')
    gain=$(pynum -c "print(f'{$BED_TARGET_LUFS - ($measured):.1f}')")
    echo "  measured ${measured} LUFS → ${gain} dB to reach ${BED_TARGET_LUFS} LUFS"
    # Pure linear gain, never loudnorm's dynamic mode: a bed must be levelled,
    # not compressed.
    src="$raw"; filter="volume=${gain}dB"
  else
    # Trim to where the sound actually is — the model pads a requested duration
    # with room tone, and a cue that starts 0.8 s late fires 0.8 s late.
    read -r start dur < <(ffmpeg -hide_banner -loglevel error -y -i "$raw" -ac 1 -ar 44100 \
      -f wav "$WORK_DIR/$name.probe.wav" && pynum - "$WORK_DIR/$name.probe.wav" <<'PY'
import sys, wave, struct
w = wave.open(sys.argv[1], 'rb'); n = w.getnframes(); sr = w.getframerate()
s = struct.unpack('<%dh' % n, w.readframes(n))
peak = max(abs(x) for x in s) or 1
thr = peak * 0.02
first = next((i for i, x in enumerate(s) if abs(x) > thr), 0)
last = n - next((i for i, x in enumerate(reversed(s)) if abs(x) > thr), 0)
start = max(0.0, first / sr - 0.02)          # 20 ms of air before the attack
end = min(n / sr, last / sr + 0.15)          # 150 ms so the decay survives
print(f"{start:.3f} {end - start:.3f}")
PY
    )
    echo "  content at ${start}s for ${dur}s"
    fade_out=$(pynum -c "print(round($dur - 0.03, 3))")
    ffmpeg -hide_banner -loglevel error -y -ss "$start" -t "$dur" -i "$raw" \
      -af "afade=t=in:st=0:d=0.008,afade=t=out:st=${fade_out}:d=0.03" \
      -c:a pcm_s16le "$WORK_DIR/$name.trim.wav"
    pk=$(ffmpeg -hide_banner -nostats -i "$WORK_DIR/$name.trim.wav" -af volumedetect -f null /dev/null 2>&1 |
      grep max_volume | awk '{print $5}')
    gain=$(pynum -c "print(round($CUE_TARGET_PEAK_DB - ($pk), 2))")
    echo "  peak ${pk} dB → ${gain} dB to reach ${CUE_TARGET_PEAK_DB} dBFS"
    src="$WORK_DIR/$name.trim.wav"; filter="volume=${gain}dB"
  fi

  # Stereo is deliberate: beds carry real width (L/R correlation ~0.36 on the
  # shipped one) and mono collapses the room into a flat hiss. Joint stereo at
  # 64k costs the same as mono at 64k, so width is effectively free.
  ffmpeg -hide_banner -loglevel error -y -i "$src" -af "$filter" \
    -c:a libmp3lame -b:a "$BITRATE" -joint_stereo 1 -ar 44100 "$ASSET_DIR/$name.mp3"
  echo "  installed $ASSET_DIR/$name.mp3 ($(stat -c%s "$ASSET_DIR/$name.mp3") bytes)"
done

echo
echo "Spent $spent credits. Commit the .mp3 files — this script never runs in CI or production."
