/**
 * Deterministic string → [0, 1) hashes (FNV-1a) for stable per-item visual
 * jitter in the metaphor3d layouts and scenes. Same input, same output, every
 * render — so streaming re-renders and revision diffs never reshuffle a scene.
 */

export function hash01(input) {
  const str = String(input ?? '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

export function hash01Salted(input, salt) {
  return hash01(`${salt}::${input}`);
}
