/**
 * Shared voice constants for the office-parody narration layer
 * (see docs/office-parody.md, docs/office-narration-roadmap.md).
 *
 * Two engines speak the cast: Google Cloud TTS on the server (Chirp3-HD
 * default, with a Chirp3-HD → Neural2 → WaveNet fallback ladder —
 * apps/server/src/agents/officeTts.js) and the browser Speech Synthesis API as
 * the final "system voice" fallback (apps/web/src/utils/officeNarration.js). Each keeps its own
 * prosody table because the engines take different pitch units, but both key
 * off the same speaker ids and both apply the same global rate scale — so
 * those two things live here, in the leaf package both apps can import.
 */

/**
 * Every speaker the narration layer can voice, ordered by cast tier to mirror
 * CAST_TIERS in apps/web/src/utils/castTiers.js. Both prosody tables are
 * asserted against this tuple so they cannot silently drift apart.
 */
export const OFFICE_SPEAKER_IDS = [
  // team
  'gilfoyle',
  'dinesh',
  'erlich',
  'goMad',
  'jared',
  'explain',
  // senior
  'ciso',
  'cto',
  'cfo',
  'barker',
  // office
  'intern',
  'scrumMaster',
  'helpdesk',
  'facilities',
  'hr',
  'greybeard'
] as const;

export type OfficeSpeakerId = (typeof OFFICE_SPEAKER_IDS)[number];

/**
 * Global multiplier applied on top of every per-persona speaking rate.
 *
 * The per-persona tables are authored as *relative* comedy fingerprints and
 * happen to sit around a median of 0.95, which made the whole cast drag. This
 * scale lifts the median just above real-time while preserving every relative
 * difference (greybeard stays the slowest, goMad the fastest). Tune this one
 * number rather than editing the tables.
 */
export const OFFICE_TTS_RATE_SCALE = 1.18;

/**
 * Max characters per Google Cloud TTS request. The API allows ~5000 bytes;
 * 800 chars keeps English and CJK safely under that while still fitting a full
 * meeting beat. Longer lines are split client-side and spoken sequentially.
 */
export const OFFICE_TTS_CHUNK_MAX_CHARS = 800;

/** @internal Shared clamp — engines disagree on their valid rate ranges. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Apply the global rate scale to one persona's authored rate, clamped to the
 * range the target speech engine accepts.
 *
 * Non-finite input (a malformed env override, a missing table entry) falls
 * back to unscaled 1 rather than propagating NaN into an audio request.
 *
 * @param rate Per-persona rate as authored in the prosody table.
 * @param opts.min Lowest rate the engine accepts.
 * @param opts.max Highest rate the engine accepts.
 * @param opts.scale Override for the global scale (server env tuning).
 */
export function scaleSpeakingRate(
  rate: number,
  opts: { min: number; max: number; scale?: number }
): number {
  const { min, max, scale = OFFICE_TTS_RATE_SCALE } = opts;
  const base = Number.isFinite(rate) ? rate : 1;
  const factor = Number.isFinite(scale) && scale > 0 ? scale : OFFICE_TTS_RATE_SCALE;
  return clamp(base * factor, min, max);
}

/** Valid `audioConfig.speakingRate` range for Google Cloud Text-to-Speech. */
export const CLOUD_TTS_RATE_RANGE = { min: 0.25, max: 4 } as const;

/**
 * Practical rate range for `SpeechSynthesisUtterance`. The spec allows 0.1–10,
 * but browsers clamp far tighter and degrade badly past 2.
 */
export const WEB_SPEECH_RATE_RANGE = { min: 0.5, max: 2 } as const;

const SENTENCE_SPLIT_RE = /(?<=[.!?…])\s+/u;

/**
 * Split narration text into TTS-safe chunks at sentence boundaries. Hard-splits
 * overlong sentences so Google Cloud TTS never truncates mid-thought.
 */
export function chunkOfficeNarrationText(
  text: string,
  maxChars: number = OFFICE_TTS_CHUNK_MAX_CHARS
): string[] {
  const cleaned = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  if (maxChars <= 0 || cleaned.length <= maxChars) return [cleaned];

  /** @type {string[]} */
  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    const piece = buffer.trim();
    if (piece) chunks.push(piece);
    buffer = '';
  };

  const pushHardSplit = (sentence: string) => {
    let rest = sentence.trim();
    while (rest.length > maxChars) {
      chunks.push(rest.slice(0, maxChars).trimEnd());
      rest = rest.slice(maxChars).trimStart();
    }
    buffer = rest;
  };

  for (const sentence of cleaned.split(SENTENCE_SPLIT_RE)) {
    const part = sentence.trim();
    if (!part) continue;
    if (part.length > maxChars) {
      flush();
      pushHardSplit(part);
      continue;
    }
    const candidate = buffer ? `${buffer} ${part}` : part;
    if (candidate.length <= maxChars) {
      buffer = candidate;
    } else {
      flush();
      buffer = part;
    }
  }
  flush();
  return chunks.length > 0 ? chunks : [cleaned.slice(0, maxChars)];
}
