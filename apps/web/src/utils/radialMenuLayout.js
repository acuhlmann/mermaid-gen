/** Matches `.radial-action-button` width (3.55rem) at default 16px root. */
export const RADIAL_BUTTON_SIZE_PX = 57;
/** Minimum gap between button edges along the arc. */
export const RADIAL_BUTTON_GAP_PX = 10;
export const RADIAL_MIN_CENTER_SEPARATION_PX = RADIAL_BUTTON_SIZE_PX + RADIAL_BUTTON_GAP_PX;

export const ARC_SPREAD_DEFAULT_DEG = 165;
export const ARC_SPREAD_MAX_DEG = 250;

/**
 * Minimum total arc spread (degrees) so button centers are at least
 * {@link RADIAL_MIN_CENTER_SEPARATION_PX} apart at the given radius.
 */
export function minArcSpreadDeg(count, radiusPx) {
  if (count <= 1) return 0;
  const halfChord = RADIAL_MIN_CENTER_SEPARATION_PX / 2;
  const ratio = Math.min(1, halfChord / radiusPx);
  const stepRad = 2 * Math.asin(ratio);
  return (stepRad * 180) / Math.PI * (count - 1);
}

/** Smallest radius that fits `count` buttons with the given total spread. */
export function radiusForSpreadDeg(count, spreadDeg) {
  if (count <= 1) return 0;
  const halfAngleRad = (spreadDeg / (count - 1) / 2) * (Math.PI / 180);
  const halfChord = RADIAL_MIN_CENTER_SEPARATION_PX / 2;
  return halfChord / Math.sin(halfAngleRad);
}

/**
 * Pick arc radius and spread so radial buttons do not overlap, preferring
 * the base radius and widening the arc before pushing buttons farther out.
 */
export function resolveArcGeometry(count, baseRadiusPx) {
  if (count <= 0) return { radiusPx: baseRadiusPx, spreadDeg: 0 };
  if (count === 1) return { radiusPx: baseRadiusPx, spreadDeg: 0 };

  const minSpreadAtBase = minArcSpreadDeg(count, baseRadiusPx);
  let spreadDeg = Math.max(ARC_SPREAD_DEFAULT_DEG, minSpreadAtBase);
  let radiusPx = baseRadiusPx;

  if (spreadDeg > ARC_SPREAD_MAX_DEG) {
    spreadDeg = ARC_SPREAD_MAX_DEG;
    radiusPx = Math.max(baseRadiusPx, radiusForSpreadDeg(count, spreadDeg));
    const minSpreadAtRadius = minArcSpreadDeg(count, radiusPx);
    if (minSpreadAtRadius > spreadDeg) {
      spreadDeg = Math.min(minSpreadAtRadius, ARC_SPREAD_MAX_DEG + 40);
      radiusPx = Math.max(radiusPx, radiusForSpreadDeg(count, spreadDeg));
    }
  }

  return { radiusPx, spreadDeg };
}

/** Chord distance between two adjacent button centers on the arc. */
export function adjacentButtonSeparationPx(count, radiusPx, spreadDeg) {
  if (count <= 1) return Infinity;
  const stepDeg = spreadDeg / (count - 1);
  const stepRad = (stepDeg * Math.PI) / 180;
  return 2 * radiusPx * Math.sin(stepRad / 2);
}
