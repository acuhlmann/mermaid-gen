/**
 * Pure scheduler brain for the office soundscape (docs/office-parody.md) —
 * decides WHEN a room-tone cue plays and WHICH one it is, mirroring
 * officeCadence.js: no timers, no audio, no store access. The
 * useOfficeSoundscape hook ticks and calls `pickNextSoundscapeCue`.
 *
 * Anti-annoyance policy: a brief quiet opening, a denser warm-up window (the
 * room "fades in" while the user settles), then a jittered cruise gap, and no
 * back-to-back set pieces (the printer, espresso machine, desk phone,
 * watercooler, chair squeak, vending machine, elevator, whiteboard and front
 * door are events; only the desk textures — keyboard clatter, mouse clicks,
 * and paper shuffles — may repeat).
 *
 * Cadence is deliberately denser than a "background music" bed: a corporate-IT
 * office is keyboards all day. At the desk, typing/mouse/paper are heavily
 * preferred; on the floor, kitchen/printer set pieces get a fairer share.
 *
 * **And it now asks how many people are in the room.** Every table below is
 * the busy floor's — `occupancy` (from `roomOccupancyAt`) is the one dial that
 * thins them, stretching the gap and scaling every cue that needs a person to
 * make it. See `AMBIENT_MACHINE_CUES`.
 */

export const SOUNDSCAPE_FIRST_CUE_MIN_MS = 4_000;
/** While the session is younger than this, cues arrive on the warm-up gap so
 * the soundscape establishes itself quickly, then settles to the cruise gap. */
export const SOUNDSCAPE_WARMUP_WINDOW_MS = 120_000;
export const SOUNDSCAPE_WARMUP_MIN_GAP_MS = 7_000;
export const SOUNDSCAPE_WARMUP_GAP_JITTER_MS = 8_000;
/** Cruise: roughly one cue every ~18–38 s — present without becoming a loop. */
export const SOUNDSCAPE_MIN_GAP_MS = 18_000;
export const SOUNDSCAPE_GAP_JITTER_MS = 20_000;

/**
 * Relative frequency of each cue. Keyboard is the office's heartbeat — weight
 * 7 means it lands ~3× more often than a set piece even before the at-desk bias.
 */
const CUE_WEIGHTS = [
  ['keyboard', 7],
  ['mouse', 2.5],
  ['paper', 2],
  ['printer', 1.5],
  ['chair', 1.2],
  ['phone', 1.1],
  ['watercooler', 0.9],
  ['espresso', 1.2],
  ['vending', 0.7],
  ['elevator', 0.6],
  ['fridge', 0.8],
  /*
   * Both of these were baked as *diegetic* cues — the whiteboard for walking up
   * to it, the door for the Day One check-in — which meant two paid samples
   * that could play at most once each in a session, and never at all for a
   * returning user who does not visit the prop. Ambient rows cost nothing and
   * are what the sounds already are: somebody else writing on the board,
   * somebody else coming through the front door. Low weights, because the
   * elevator ding is already telling the "a person arrived" joke.
   */
  ['whiteboard', 0.7],
  ['door', 0.5],
  /*
   * Slice 3 — the room gets people in it.
   *
   * Every cue above this line is an object. The bed murmurs distant
   * conversation, but a bed is a texture: it has no position and cannot be an
   * event, so across a whole session nothing here ever coughed or laughed.
   * That was the palette's only structural hole.
   *
   * Weights are low on purpose and the laugh is the lowest thing in the table.
   * A person is far more attention-grabbing than a machine at equal loudness —
   * you look up — so the budget is "once or twice a session", not "as often as
   * the fridge". `cough` outranks it because clearing your throat is
   * background where laughing is an event you were not part of.
   */
  ['laugh', 0.45],
  ['cough', 0.8],
  ['phoneBuzz', 1.1],
  // Fan noise; carries the pod the way the fridge carries the kitchen.
  ['serverRack', 0.6]
];

/**
 * The two cues that are a machine running whether or not anybody is there.
 *
 * Every other row in the table above is a person doing something — a keyboard
 * has hands on it, a printer was sent a job, a door was opened by somebody. So
 * "how full is the room" has exactly one honest consequence for this table:
 * the people thin out and the building does not. An empty office at eight in
 * the evening is the fridge and the fans, and that is what falls out of
 * scaling everything but these two by `occupancy`.
 */
const AMBIENT_MACHINE_CUES = new Set(['fridge', 'serverRack']);

/**
 * How much longer the wait gets in an empty room, at occupancy 0. A sparse
 * room is not only different in *what* it plays but in how often anything
 * happens at all — that is most of what makes a building feel empty.
 *
 * 1.2 doubles the cruise gap after hours (occupancy 0.15 → ~2×, so ~36–77 s
 * against the busy room's 18–38 s) and leaves midday exactly where it was,
 * because `roomOccupancyAt` puts midday at 1 and this is a multiplier of
 * `1 + (1 - occupancy) * …`. The tuned cadence in the constants above is the
 * busy room's; nothing here retunes it.
 */
const OCCUPANCY_GAP_STRETCH = 1.2;

/** Desk textures get this multiplier while you are sitting at your screen. */
const AT_DESK_TEXTURE_BOOST = 2.4;
/** Set pieces thin out a bit at the desk — they happen down the hall. */
const AT_DESK_SET_PIECE_SCALE = 0.55;
/** On the floor, set pieces (kitchen, printer) step forward. */
const ON_FLOOR_SET_PIECE_BOOST = 1.6;

/**
 * Cues that belong to a room, and how much louder that room makes them.
 *
 * This is the cheap half of "per-room beds" (docs/audio-assets.md): a second
 * 30 s ElevenLabs bed costs 300 credits and an entire crossfading multi-buffer
 * player, where standing in the kitchen and hearing the kitchen's own sounds
 * three times as often costs one 20-credit cue and this table. The bed keeps
 * doing the room's *timbre* through `setRoomToneZone`'s filter; this does its
 * *events*, which is the half a filter cannot fake.
 */
const ZONE_CUES = {
  kitchen: { fridge: 3, espresso: 2.2, watercooler: 2, vending: 1.8 },
  /*
   * The engineering pod, bought the same way the kitchen was: one 20-credit
   * cue and a row here, rather than a 300-credit bed. `serverRack` is a
   * `FLOOR_PROPS` entry sitting in this zone and was pure scenery until now.
   *
   * The pod is also where the desks are, so its identity is partly the typing
   * that already happens there — this only has to add the corner nobody sits in.
   */
  pod: { serverRack: 3.2, phoneBuzz: 1.6 }
};

export const SOUNDSCAPE_CUES = CUE_WEIGHTS.map(([cue]) => cue);

/** Desk textures that may play twice in a row; everything else is a set piece. */
const REPEATABLE_CUES = new Set(['keyboard', 'mouse', 'paper']);

/**
 * @param {string} cue
 * @param {number} base
 * @param {boolean} atDesk
 * @param {string} zone
 * @param {number} occupancy
 * @returns {number}
 */
function weightFor(cue, base, atDesk, zone, occupancy) {
  const deskTexture = REPEATABLE_CUES.has(cue);
  // Occupancy applies at the desk too. The zone does not, because it is about
  // where *you* are standing; this is about how many other people are in the
  // building, which is just as true with your back to the room.
  const peopled = AMBIENT_MACHINE_CUES.has(cue) ? base : base * occupancy;
  if (atDesk) {
    // Zone never applies at the desk: you are looking at a screen, and the
    // floor's idea of where you are standing is stale the moment you sit down.
    return deskTexture ? peopled * AT_DESK_TEXTURE_BOOST : peopled * AT_DESK_SET_PIECE_SCALE;
  }
  const zoned = peopled * (ZONE_CUES[zone]?.[cue] ?? 1);
  return deskTexture ? zoned : zoned * ON_FLOOR_SET_PIECE_BOOST;
}

/**
 * @param {{
 *   now: number,
 *   sessionStartedAt: number,
 *   lastPlayedAt: number,
 *   lastCue?: string | null,
 *   atDesk?: boolean,
 *   zone?: 'neutral' | 'glass' | 'kitchen' | 'pod',
 *   occupancy?: number,
 *   random?: () => number
 * }} args `zone` is where you are standing on the floor (`floorZoneToneAt`);
 *   ignored at the desk. `occupancy` is how full the room is
 *   (`roomOccupancyAt`), 0 to 1; **1 is the default and is a no-op**, because
 *   the tables above are the busy room's and every other value thins them.
 * @returns {'keyboard'|'mouse'|'paper'|'printer'|'chair'|'phone'|'watercooler'|'espresso'|'vending'|'elevator'|'fridge'|'whiteboard'|'door'|'laugh'|'cough'|'phoneBuzz'|'serverRack'|null}
 */
export function pickNextSoundscapeCue({
  now,
  sessionStartedAt,
  lastPlayedAt,
  lastCue = null,
  atDesk = true,
  zone = 'neutral',
  occupancy = 1,
  random = Math.random
}) {
  if (now - sessionStartedAt < SOUNDSCAPE_FIRST_CUE_MIN_MS) return null;
  const level = Math.min(1, Math.max(0, Number.isFinite(occupancy) ? occupancy : 1));
  const warmingUp = now - sessionStartedAt < SOUNDSCAPE_WARMUP_WINDOW_MS;
  const baseGap = warmingUp
    ? SOUNDSCAPE_WARMUP_MIN_GAP_MS + random() * SOUNDSCAPE_WARMUP_GAP_JITTER_MS
    : SOUNDSCAPE_MIN_GAP_MS + random() * SOUNDSCAPE_GAP_JITTER_MS;
  const requiredGap = baseGap * (1 + (1 - level) * OCCUPANCY_GAP_STRETCH);
  if (lastPlayedAt > 0 && now - lastPlayedAt < requiredGap) return null;

  const eligible = CUE_WEIGHTS.filter(([cue]) => REPEATABLE_CUES.has(cue) || cue !== lastCue).map(
    ([cue, base]) =>
      /** @type {[string, number]} */ ([cue, weightFor(cue, base, atDesk, zone, level)])
  );
  const total = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [cue, weight] of eligible) {
    roll -= weight;
    if (roll <= 0) return cue;
  }
  return eligible[eligible.length - 1][0];
}
