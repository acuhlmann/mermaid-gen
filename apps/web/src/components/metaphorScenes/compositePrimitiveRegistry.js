/**
 * Small standards-neutral render-plan vocabulary for Composite v2.
 *
 * The JSON DSL remains the canonical semantic source. These entries describe
 * internal render capabilities only; they are intentionally not serialized as
 * a scene format or presented as OpenUSD/glTF compliance.
 */
export const COMPOSITE_PRIMITIVE_REGISTRY = Object.freeze({
  island: Object.freeze({
    role: 'substrate',
    bounds: Object.freeze({ radius: [1.8, 4.6], height: [0.4, 1.8] }),
    anchor: 'surface-top',
    placement: 'world-site',
    motionStyle: 'sway',
    estimatedCost: 5
  }),
  platform: Object.freeze({
    role: 'substrate',
    bounds: Object.freeze({ radius: [2.2, 4.2], height: [0.25, 0.8] }),
    anchor: 'surface-top',
    placement: 'world-site',
    motionStyle: 'pulse',
    estimatedCost: 3
  }),
  tower: Object.freeze({
    role: 'landmark',
    bounds: Object.freeze({ radius: [0.45, 1.5], height: [1.8, 7.5] }),
    anchor: 'roof',
    placement: 'attach-to-site',
    motionStyle: 'pulse',
    estimatedCost: 6
  }),
  terrace: Object.freeze({
    role: 'container',
    bounds: Object.freeze({ radius: [0.9, 2.2], height: [0.6, 3.8] }),
    anchor: 'top-tier',
    placement: 'attach-to-site',
    motionStyle: 'pulse',
    estimatedCost: 5
  }),
  tree: Object.freeze({
    role: 'connector',
    bounds: Object.freeze({ radius: [0.7, 1.8], height: [1.8, 5.5] }),
    anchor: 'canopy',
    placement: 'attach-to-site',
    motionStyle: 'sway',
    estimatedCost: 7
  }),
  mound: Object.freeze({
    role: 'field',
    bounds: Object.freeze({ radius: [1.1, 2.7], height: [0.5, 3.8] }),
    anchor: 'summit',
    placement: 'attach-to-site',
    motionStyle: 'pulse',
    estimatedCost: 4
  }),
  bloom: Object.freeze({
    role: 'landmark',
    bounds: Object.freeze({ radius: [0.55, 1.5], height: [1.2, 4.5] }),
    anchor: 'blossom',
    placement: 'attach-to-site',
    motionStyle: 'sway',
    estimatedCost: 7
  }),
  star: Object.freeze({
    role: 'accent',
    bounds: Object.freeze({ radius: [0.3, 1.1], height: [0.3, 1.1] }),
    anchor: 'center',
    placement: 'orbit-site',
    motionStyle: 'orbit',
    estimatedCost: 3
  }),
  orb: Object.freeze({
    role: 'accent',
    bounds: Object.freeze({ radius: [0.45, 1.5], height: [0.45, 1.5] }),
    anchor: 'center',
    placement: 'orbit-site',
    motionStyle: 'orbit',
    estimatedCost: 4
  }),
  gear: Object.freeze({
    role: 'connector',
    bounds: Object.freeze({ radius: [0.55, 1.8], height: [0.4, 1.2] }),
    anchor: 'hub',
    placement: 'attach-to-site',
    motionStyle: 'orbit',
    estimatedCost: 6
  }),
  waypoint: Object.freeze({
    role: 'path',
    bounds: Object.freeze({ radius: [0.35, 0.9], height: [0.5, 1.4] }),
    anchor: 'marker-top',
    placement: 'on-path',
    motionStyle: 'flow',
    estimatedCost: 3
  }),
  // A bridge layer is a crossing between sites, so it reads as a path like the
  // river's waypoints rather than as another landmark planted on one island.
  pylon: Object.freeze({
    role: 'path',
    bounds: Object.freeze({ radius: [0.3, 0.9], height: [1.2, 4.2] }),
    anchor: 'marker-top',
    placement: 'on-path',
    motionStyle: 'flow',
    estimatedCost: 4
  }),
  // A cycle layer is a recurring loop; an orbiting accent is the closest the
  // fused vocabulary gets to "this comes round again".
  pod: Object.freeze({
    role: 'accent',
    bounds: Object.freeze({ radius: [0.4, 1.2], height: [0.4, 1.2] }),
    anchor: 'center',
    placement: 'orbit-site',
    motionStyle: 'orbit',
    estimatedCost: 4
  }),
  berg: Object.freeze({
    role: 'landmark',
    bounds: Object.freeze({ radius: [0.7, 2.2], height: [0.8, 4.2] }),
    anchor: 'summit',
    placement: 'attach-to-site',
    motionStyle: 'pulse',
    estimatedCost: 6
  })
});

export const COMPOSITE_CAPABILITY_BY_KIND = Object.freeze({
  archipelago: Object.freeze({ role: 'substrate', primitive: 'island', metric: 'mass' }),
  city: Object.freeze({ role: 'landmark', primitive: 'tower', metric: 'height' }),
  layercake: Object.freeze({ role: 'container', primitive: 'terrace', metric: 'thickness' }),
  tree: Object.freeze({ role: 'connector', primitive: 'tree', metric: 'weight' }),
  terrain: Object.freeze({ role: 'field', primitive: 'mound', metric: 'elevation' }),
  river: Object.freeze({ role: 'path', primitive: 'waypoint', metric: 'flow' }),
  garden: Object.freeze({ role: 'landmark', primitive: 'bloom', metric: 'impact' }),
  galaxy: Object.freeze({ role: 'accent', primitive: 'star', metric: 'magnitude' }),
  orrery: Object.freeze({ role: 'accent', primitive: 'orb', metric: 'size' }),
  machine: Object.freeze({ role: 'connector', primitive: 'gear', metric: 'size' }),
  // Without these two, a bridge or cycle layer fell through to the generic
  // landmark/tower default and every crossing or ceremony was drawn as an
  // anonymous block on whichever island it happened to bind to.
  bridge: Object.freeze({ role: 'path', primitive: 'pylon', metric: 'load' }),
  cycle: Object.freeze({ role: 'accent', primitive: 'pod', metric: 'size' }),
  // A subway layer is a set of routes between sites — the same "path" role a
  // river plays. An iceberg layer is bulk sitting on a site, so it lands as a
  // landmark; the waterline it needs cannot exist inside a fused world that
  // already has ground at y = 0, which is why iceberg is better used alone.
  subway: Object.freeze({ role: 'path', primitive: 'waypoint', metric: 'traffic' }),
  iceberg: Object.freeze({ role: 'landmark', primitive: 'berg', metric: 'mass' })
});

export function getCompositeCapability(kind) {
  return (
    COMPOSITE_CAPABILITY_BY_KIND[kind] ??
    Object.freeze({ role: 'landmark', primitive: 'tower', metric: null })
  );
}

export function getCompositePrimitive(primitive) {
  return COMPOSITE_PRIMITIVE_REGISTRY[primitive] ?? COMPOSITE_PRIMITIVE_REGISTRY.tower;
}
