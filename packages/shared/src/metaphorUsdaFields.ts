import type { MetaphorBaseKind } from './metaphorSchema.js';

export type ItemFieldType = 'double' | 'string' | 'token' | 'string[]' | 'rel' | 'rel[]';

export interface ItemFieldMapping {
  field: string;
  type: ItemFieldType;
}

/**
 * Per-kind item fields beyond the common id/label/position/glyph/note/accent, in
 * stable emission order. `rel` / `rel[]` fields reference item ids and become
 * UsdRelationship targets when they resolve.
 */
export const KIND_ITEM_FIELDS: Record<MetaphorBaseKind, ItemFieldMapping[]> = {
  city: [
    { field: 'height', type: 'double' },
    { field: 'footprint', type: 'double' },
    { field: 'district', type: 'string' },
    { field: 'lighting', type: 'token' },
    { field: 'condition', type: 'token' }
  ],
  layercake: [
    { field: 'thickness', type: 'double' },
    { field: 'components', type: 'string[]' },
    { field: 'cracks', type: 'double' },
    { field: 'tilt', type: 'double' }
  ],
  galaxy: [
    { field: 'magnitude', type: 'double' },
    { field: 'cluster', type: 'string' },
    { field: 'binary', type: 'rel' }
  ],
  tree: [
    { field: 'parent', type: 'rel' },
    { field: 'weight', type: 'double' },
    { field: 'kind', type: 'token' }
  ],
  terrain: [
    { field: 'elevation', type: 'double' },
    { field: 'intensity', type: 'double' }
  ],
  orrery: [
    { field: 'orbit', type: 'double' },
    { field: 'size', type: 'double' },
    { field: 'moon', type: 'rel' }
  ],
  river: [
    { field: 'stage', type: 'double' },
    { field: 'flow', type: 'double' },
    { field: 'hazard', type: 'double' }
  ],
  garden: [
    { field: 'maturity', type: 'double' },
    { field: 'impact', type: 'double' },
    { field: 'bed', type: 'string' },
    { field: 'health', type: 'token' }
  ],
  archipelago: [
    { field: 'mass', type: 'double' },
    { field: 'relief', type: 'double' },
    { field: 'chain', type: 'string' }
  ],
  machine: [
    { field: 'size', type: 'double' },
    { field: 'speed', type: 'double' },
    { field: 'axle', type: 'string' },
    { field: 'torque', type: 'double' },
    { field: 'mesh', type: 'rel' }
  ],
  bridge: [
    { field: 'span', type: 'double' },
    { field: 'load', type: 'double' },
    { field: 'side', type: 'string' },
    { field: 'strain', type: 'double' }
  ],
  cycle: [
    { field: 'phase', type: 'double' },
    { field: 'size', type: 'double' },
    { field: 'friction', type: 'double' }
  ],
  subway: [
    { field: 'line', type: 'string' },
    { field: 'stop', type: 'double' },
    { field: 'traffic', type: 'double' },
    { field: 'interchange', type: 'rel[]' }
  ],
  iceberg: [
    { field: 'depth', type: 'double' },
    { field: 'mass', type: 'double' },
    { field: 'berg', type: 'string' },
    { field: 'peril', type: 'double' }
  ]
};
