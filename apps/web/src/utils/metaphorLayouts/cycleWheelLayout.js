function phaseValue(item) {
  const raw = typeof item.phase === 'number' && Number.isFinite(item.phase) ? item.phase : 0;
  return Math.max(0, Math.min(100, raw));
}

function sizeValue(item) {
  const raw = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 3;
  return Math.max(0.1, Math.min(10, raw));
}

function frictionValue(item) {
  const raw =
    typeof item.friction === 'number' && Number.isFinite(item.friction) ? item.friction : 0;
  return Math.max(0, Math.min(1, raw));
}

/** Gondola scale from importance — sqrt keeps the headline pod elegant, not huge. */
export function cyclePodScaleForSize(size) {
  return 0.62 + Math.sqrt(Math.max(0.1, size)) * 0.22;
}

/**
 * Lay out a ferris wheel for the cycle metaphor. Each item is a gondola pod
 * placed on the rim by `phase` (0–100 around the loop); the wheel stands
 * vertical in the XY plane and slowly turns about the hub. `size` scales the
 * pod, `friction` marks the pod that slows the loop (rendered hot).
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {{
 *   pods: Array<{
 *     id: string,
 *     angle: number,
 *     position: [number, number, number],
 *     scale: number,
 *     phase: number,
 *     friction: number
 *   }>,
 *   wheelRadius: number,
 *   hubY: number,
 *   bounds: { radius: number }
 * }}
 */
export function cycleWheelLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const wheelRadius = Math.max(4.6, Math.min(9.2, 4.2 + valid.length * 0.32));
  const podClearance = 1.4;
  const hubY = wheelRadius + podClearance;

  const pods = valid.map((item) => {
    const phase = phaseValue(item);
    // phase 0 at the top of the loop, running clockwise (procession order).
    const angle = Math.PI / 2 - (phase / 100) * Math.PI * 2;
    return {
      id: item.id,
      angle,
      position: [Math.cos(angle) * wheelRadius, hubY + Math.sin(angle) * wheelRadius, 0],
      scale: cyclePodScaleForSize(sizeValue(item)),
      phase,
      friction: frictionValue(item)
    };
  });

  return {
    pods,
    wheelRadius,
    hubY,
    bounds: { radius: wheelRadius + podClearance + 1.2 }
  };
}
