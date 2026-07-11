import { cityDistrictLayout } from './cityDistrictLayout.js';

/**
 * Pack portfolio items into named garden beds. The mature/impact encodings do
 * not affect placement, so lifecycle changes animate vertically without
 * shuffling the whole composition.
 *
 * @param {Array<Record<string, unknown>>} items
 */
export function gardenBedLayout(items) {
  const projected = items.map((item) => ({
    ...item,
    district: typeof item.bed === 'string' && item.bed.trim() ? item.bed.trim() : 'Shared garden',
    footprint: 2.4
  }));
  const layout = cityDistrictLayout(projected);
  return {
    positions: layout.positions,
    beds: layout.districts.map((district) => ({
      name: district.name,
      center: district.center,
      size: district.size
    })),
    bounds: layout.bounds
  };
}
