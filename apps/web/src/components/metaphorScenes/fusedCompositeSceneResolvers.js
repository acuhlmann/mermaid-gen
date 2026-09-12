/**
 * The two things the scene asks the composite planner for that are not part of
 * the plan: which sky to hang over a fused world, and where a moving primitive
 * sits at time `t`. Both are pure, both are consumed by R3F components rather
 * than by the planner itself, and both were priority/style chains inline in
 * `fusedCompositePlanner.js` — which is over its `max-lines` budget.
 */
import { getCompositeCapability } from './compositePrimitiveRegistry.js';

// Copied verbatim from fusedCompositePlanner.js rather than re-derived: the
// argument order in `clamp` differs from the obvious spelling when min > max,
// and `finite` rejects non-number types explicitly. Both are behaviour these
// resolvers must not change.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Sky/theme family for a fused world, most-specific first.
 *
 * A table rather than an if-chain (the `peekDiagramDirective` fix in #569, same
 * shape): every new base kind used to add another branch to one function, and
 * the ORDER is the whole contract — a world holding both an archipelago and a
 * city gets an ocean sky, not a city one, because a substrate decides the
 * horizon that a thing standing on it does not. Reordering these rows changes
 * what the sky looks like; adding one at the end cannot.
 */
const ATMOSPHERE_RULES = [
  { atmosphere: 'archipelago', role: 'substrate', kinds: ['archipelago'] },
  { atmosphere: 'river', role: 'path', kinds: ['river'] },
  { atmosphere: 'garden', kinds: ['garden'] },
  { atmosphere: 'galaxy', kinds: ['galaxy', 'orrery'] },
  { atmosphere: 'machine', kinds: ['machine'] },
  { atmosphere: 'tree', kinds: ['tree'] },
  { atmosphere: 'layercake', kinds: ['layercake'] },
  { atmosphere: 'city', kinds: ['city'] },
  { atmosphere: 'terrain', kinds: ['terrain'] }
];

/**
 * Pick sky/theme family from fused layer roles so mixed worlds do not inherit
 * only layers[0] (e.g. city sky over an ocean substrate).
 */
export function resolveCompositeAtmosphere(dsl) {
  const layers = Array.isArray(dsl?.layers) ? dsl.layers : [];
  const kinds = layers.map((layer) => layer.as);
  const roles = new Set(kinds.map((kind) => getCompositeCapability(kind).role));
  const hit = ATMOSPHERE_RULES.find(
    (rule) =>
      (rule.role !== undefined && roles.has(rule.role)) ||
      rule.kinds.some((kind) => kinds.includes(kind))
  );
  return hit?.atmosphere ?? kinds[0] ?? 'city';
}

/**
 * Per-style motion. Each takes the same resolved frame so the shared wave,
 * amplitude and clock are computed once and no style can disagree about them.
 * A style absent from this table falls through to `DRIFT`.
 */
const MOTION_STYLES = {
  orbit: ({ t, wave, amplitude, speed, phase }) => {
    const angle = t * speed + phase;
    return {
      offset: [
        Math.cos(angle) * amplitude * 2.6,
        wave * amplitude * 0.4,
        Math.sin(angle) * amplitude * 2.6
      ],
      rotation: [0, angle * 0.22, 0],
      scale: 1
    };
  },
  sway: ({ wave, amplitude }) => ({
    offset: [0, Math.abs(wave) * amplitude * 0.18, 0],
    rotation: [wave * amplitude * 0.35, 0, wave * amplitude],
    scale: 1
  }),
  pulse: ({ wave, amplitude }) => ({
    offset: [0, wave * amplitude * 0.16, 0],
    rotation: [0, 0, 0],
    scale: 1 + wave * amplitude * 0.24
  }),
  flow: ({ t, wave, amplitude, speed, phase }) => {
    const drift = t * speed * 0.35 + phase;
    return {
      offset: [
        Math.sin(drift) * amplitude * 1.4,
        Math.abs(Math.sin(drift * 1.3)) * amplitude * 0.55,
        Math.cos(drift * 0.85) * amplitude * 0.9
      ],
      rotation: [0, Math.sin(drift) * amplitude * 0.8, wave * amplitude * 0.25],
      scale: 1 + Math.abs(wave) * amplitude * 0.08
    };
  }
};

const DRIFT = ({ wave, amplitude }) => ({
  offset: [0, wave * amplitude * 0.12, 0],
  rotation: [0, 0, 0],
  scale: 1
});

/** Pure motion resolver used by the R3F scene and reduced-motion tests. */
export function resolveCompositeMotionTransform(motion, time, intensity, animated = true) {
  const safeIntensity = clamp(finite(intensity, 0), 0, 1);
  const t = animated ? finite(time, 0) : 0;
  const speed = finite(motion?.speed, 1);
  const phase = finite(motion?.phase, 0);
  const frame = {
    t,
    speed,
    phase,
    wave: Math.sin(t * speed + phase),
    amplitude: finite(motion?.amplitude, 0) * safeIntensity
  };
  return (MOTION_STYLES[motion?.style] ?? DRIFT)(frame);
}
