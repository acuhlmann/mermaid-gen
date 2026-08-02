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
#   ./scripts/generate-office-audio.sh cue-espresso       # regenerate ONE asset
#   ./scripts/generate-office-audio.sh --verify           # check installed assets, free
#   ./scripts/generate-office-audio.sh --verify cue-laugh # ...or just one
#   ./scripts/generate-office-audio.sh                    # regenerate EVERYTHING
#
# That last form costs the whole manifest (900 credits as of slice 3) and
# overwrites every committed .mp3. Pass an asset name unless you mean it.
#
# Generation needs ELEVENLABS_API_KEY in .env and ffmpeg on PATH. --verify needs
# neither the key nor the network: it only reads what is already installed, so
# it is safe to run any time and is the fastest way to answer "is the committed
# bank still sane".
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
  #
  # --- Slice 3: the room has people in it -----------------------------------
  #
  # Every cue above this line is an OBJECT. Across a whole session nothing in
  # this office ever coughed or laughed — the bed murmurs distant conversation
  # as a texture, but a texture has no position and cannot be an event. These
  # three are the palette's only structural hole, and the one category
  # synthesis cannot even attempt: a synthesized cough is unthinkable, where a
  # synthesized printer is merely bad.
  #
  # Lower prompt_influence than the mechanical cues on purpose. High influence
  # makes the model perform the prompt, and a performed laugh is a caricature;
  # what is wanted is a room that happens to contain one.
  "cue-laugh|cue|3|0.4|A short burst of laughter from two or three people across an open-plan office, heard from a distance, dry indoor recording, no music"
  "cue-cough|cue|2|0.45|One person clearing their throat and coughing once at a desk a few metres away, dry indoor office recording, no music"
  "cue-phone-buzz|cue|2|0.55|A mobile phone vibrating against a hard desk surface, three short buzzes, close-up, no music"
  # The all-hands (docs/office-parody.md §10.4) draws an audience row of faces
  # and fires confetti "for an outcome that does not exist" — and sounded
  # exactly like a two-person headset call. Applause is that joke's punchline.
  "cue-crowd-settle|cue|4|0.45|A room full of people settling into seats before a presentation, chairs and murmured conversation dying down, no music"
  "cue-applause|cue|3|0.45|Scattered polite applause from a small seated audience in a meeting room, no cheering, no music"
  # Gives the engineering pod an identity the way cue-fridge gave the kitchen
  # one: a ZONE_CUES row, not a 300-credit bed.
  "cue-server-rack|cue|2|0.55|Server rack cooling fans whirring with hard drives chattering, heard from a metre away, no music"
  # Second takes. Same prompt as the base take on purpose — a second take of one
  # sound, not a different sound. Footsteps need it most: they are the only cue
  # that repeats WITHIN a single gesture (one per walk leg), so one recording
  # wears through faster than anything else in the bank.
  "cue-footstep-carpet-b|cue|2|0.55|Two footsteps walking on office carpet, close-up, dry indoor recording, no music"
  "cue-footstep-hard-b|cue|2|0.55|Two footsteps walking on hard vinyl office flooring, close-up, dry indoor recording, no music"
  "cue-paper-b|cue|2|0.55|Shuffling a small stack of paper sheets on a desk, close-up, dry, no music"
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

# How far past CUE_TARGET_PEAK_DB an installed cue may sit before it is worth a
# look. Measured across the shipped bank: LAME at 64k moves a peak by up to
# ~2.6 dB in EITHER direction, so the "-3 dBFS ceiling" the gain table is
# anchored on is only true of the WAV, not of the .mp3 that ships. 3.5 dB is
# that observed wobble plus a little headroom — tighter and it cries wolf.
CUE_PEAK_TOLERANCE_DB=3.5
# Above this, a cue is close enough to full scale that the encoder may clip it.
CUE_PEAK_CEILING_DB=-0.5
# A bed's loop seam: near-silence at either edge clicks once per lap.
BED_EDGE_SILENCE_MAX_MS=5
# ...and its head/tail levels must match, or the wrap thumps.
BED_RMS_MATCH_MAX_DB=1.0

DRY_RUN=0
VERIFY_ONLY=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --verify) VERIFY_ONLY=1 ;;
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
if [[ "$VERIFY_ONLY" == "0" ]]; then
  echo "Manifest: ${#selected[@]} asset(s), ${total_seconds}s total"
  echo "Estimated cost: $((total_seconds * CREDITS_PER_SECOND)) credits of the 10,000/month free tier"
fi

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

# --- Verification ------------------------------------------------------------
#
# The checks docs/audio-assets.md used to describe as "a one-off ritual at
# generation time", run automatically instead. A ritual nobody performs is a
# comment, and this batch found things by measurement that an ear pass had not
# got to yet.
#
# Peak is read from the installed STEREO .mp3, not from a mono downmix: a
# downmix averages the channels, so a peak living in one of them reads up to
# 6 dB quiet and invents failures that are not there (observed on
# cue-door-badge: -10.2 dB mono against -5.6 dB real). Geometry — edge silence,
# the loop seam — is read from a mono decode, which is what those checks want
# and what the doc's hand ritual always used.
verify_asset() {
  local name="$1" kind="$2" path="$ASSET_DIR/$1.mp3"
  [[ -f "$path" ]] || { echo "  VERIFY FAIL: $path is missing"; return 1; }

  local peak lufs wav
  peak=$(ffmpeg -hide_banner -nostats -i "$path" -af volumedetect -f null /dev/null 2>&1 |
    grep max_volume | awk '{print $5}')
  # awk is last in that pipeline and succeeds on empty input, so a file ffmpeg
  # cannot read yields an empty string rather than a non-zero status. Catch it
  # here: an unmeasurable asset is a failure, not a crash inside Python.
  if [[ -z "$peak" ]]; then
    echo "  VERIFY FAIL: ffmpeg could not measure $path - is it a valid mp3?"
    return 1
  fi
  lufs=$(ffmpeg -hide_banner -nostats -i "$path" -af ebur128=framelog=quiet -f null /dev/null 2>&1 |
    grep -A1 'Integrated' | grep 'I:' | awk '{print $2}')
  wav="$WORK_DIR/$name.verify.wav"
  ffmpeg -hide_banner -loglevel error -y -i "$path" -ac 1 -ar 44100 -f wav "$wav"

  # Paths are passed as their own argv entries and never joined with ':' —
  # MSYS declines to convert a POSIX path that sits next to a colon, and the
  # unconverted /c/... then does not exist as far as Windows Python is
  # concerned. Learned the tedious way.
  "$PYTHON" -c '
import sys, wave, struct, math

path, kind, peak, lufs = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
tol, ceiling, target = float(sys.argv[5]), float(sys.argv[6]), float(sys.argv[7])
edge_ms, rms_db, bed_lufs = float(sys.argv[8]), float(sys.argv[9]), float(sys.argv[10])

w = wave.open(path, "rb")
n, sr = w.getnframes(), w.getframerate()
s = struct.unpack("<%dh" % n, w.readframes(n))
dur = n / sr

def db(x):
    return 20 * math.log10(max(abs(x), 1e-9) / 32768.0)

def rms(seq):
    return math.sqrt(sum(float(v) * v for v in seq) / len(seq)) if seq else 0.0

pk = max(abs(x) for x in s) or 1
thr = pk * 0.02
lead = next((i for i, x in enumerate(s) if abs(x) > thr), n) / sr * 1000
tail = next((i for i, x in enumerate(reversed(s)) if abs(x) > thr), n) / sr * 1000

fails, warns = [], []
if dur < 0.2:
    fails.append(f"only {dur:.2f}s long - the trim probably ate the content")

if kind == "cue":
    if peak > ceiling:
        fails.append(f"peaks at {peak:.1f} dB, close enough to full scale to clip")
    elif abs(peak - target) > tol:
        warns.append(f"peaks at {peak:.1f} dB against a {target:.0f} dB target")
else:
    # A bed loops forever; these three are the difference between a room and a
    # tick once per lap.
    if lead > edge_ms or tail > edge_ms:
        fails.append(f"silence at the loop edges ({lead:.0f}ms/{tail:.0f}ms) will click each lap")
    steps = sorted(abs(s[i + 1] - s[i]) for i in range(min(n - 1, sr * 5)))
    p99 = steps[int(len(steps) * 0.99)] if steps else 0
    wrap = abs(s[0] - s[-1])
    if wrap > p99:
        fails.append(f"wrap-around step {wrap} exceeds the interior p99 {p99} - audible seam")
    half = int(sr * 0.5)
    head_db, tail_db = db(rms(s[:half])), db(rms(s[-half:]))
    if abs(head_db - tail_db) > rms_db:
        warns.append(f"head/tail RMS differ by {abs(head_db - tail_db):.1f} dB - the wrap will thump")
    try:
        if abs(float(lufs) - bed_lufs) > 1.0:
            warns.append(f"{lufs} LUFS against a {bed_lufs:.0f} target")
    except ValueError:
        pass

# LUFS is reported even when nothing is wrong: it is the input to the loudness
# -matched gain derivation in officeCueSamples.js, and measuring it here is
# what stops the next batch guessing.
print(f"  measured {dur:.2f}s, peak {peak:.1f} dB, {lufs} LUFS")
for f in fails:
    print(f"  VERIFY FAIL: {f}")
for x in warns:
    print(f"  VERIFY WARN: {x}")
if not fails and not warns:
    print("  VERIFY OK")
sys.exit(1 if fails else 0)
' "$wav" "$kind" "$peak" "${lufs:-?}" "$CUE_PEAK_TOLERANCE_DB" "$CUE_PEAK_CEILING_DB" \
    "$CUE_TARGET_PEAK_DB" "$BED_EDGE_SILENCE_MAX_MS" "$BED_RMS_MATCH_MAX_DB" "$BED_TARGET_LUFS"
}

mkdir -p "$WORK_DIR" "$ASSET_DIR"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  echo "Verifying ${#selected[@]} installed asset(s) — no API calls, no credits."
  failed=0
  for entry in "${selected[@]}"; do
    IFS='|' read -r name kind _ _ _ <<<"$entry"
    echo
    echo "→ $name ($kind)"
    verify_asset "$name" "$kind" || failed=$((failed + 1))
  done
  echo
  if [[ "$failed" -gt 0 ]]; then
    echo "$failed asset(s) FAILED verification." >&2
    exit 1
  fi
  echo "All ${#selected[@]} asset(s) verified."
  exit 0
fi

# shellcheck disable=SC1090
set -a; . <(sed $'1s/^\xEF\xBB\xBF//' "$REPO_ROOT/.env"); set +a
[[ -n "${ELEVENLABS_API_KEY:-}" ]] || { echo "ERROR: ELEVENLABS_API_KEY missing from .env" >&2; exit 1; }

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

  # Verify the file that actually shipped, not the WAV it came from — the
  # encoder moves the peak, which is the whole reason the ceiling needs
  # checking after the fact rather than being assumed from the gain applied.
  # A failure here does NOT abort: the credits are already spent, the .mp3 is
  # already on disk, and the useful outcome is a clear verdict on every asset in
  # the batch rather than a stop at the first bad one.
  verify_asset "$name" "$kind" || verify_failures=$((${verify_failures:-0} + 1))
done

echo
echo "Spent $spent credits. Commit the .mp3 files — this script never runs in CI or production."
if [[ "${verify_failures:-0}" -gt 0 ]]; then
  echo
  echo "WARNING: ${verify_failures} asset(s) failed verification above — listen before committing." >&2
  echo "Re-run a single one to replace it, or './scripts/generate-office-audio.sh --verify' to re-check." >&2
  exit 1
fi
