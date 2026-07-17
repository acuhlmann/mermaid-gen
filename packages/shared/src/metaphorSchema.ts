import { z } from 'zod';

/** Spatial stories that own their own item encodings and scene modules. */
export const METAPHOR_BASE_KINDS = [
  'city',
  'layercake',
  'galaxy',
  'tree',
  'terrain',
  'orrery',
  'river',
  'garden',
  'archipelago'
] as const;
export const MetaphorBaseKindSchema = z.enum(METAPHOR_BASE_KINDS);

/**
 * All metaphor discriminators, including `composite`, whose semantic layers are
 * fused by a deterministic planner. Base kinds are unchanged.
 */
export const METAPHOR_KINDS = [...METAPHOR_BASE_KINDS, 'composite'] as const;
export const MetaphorKindSchema = z.enum(METAPHOR_KINDS);

export const METAPHOR_THEMES = ['whiteboard', 'noir', 'arcade', 'blueprint'] as const;
export const MetaphorThemeSchema = z.enum(METAPHOR_THEMES).default('whiteboard');

export const METAPHOR_CAMERAS = ['orbit', 'isometric', 'cinematic'] as const;
export const MetaphorCameraSchema = z.enum(METAPHOR_CAMERAS).default('orbit');

export const METAPHOR_GLYPH_KINDS = [
  'database',
  'cache',
  'queue',
  'filestore',
  'datalake',
  'service',
  'compute',
  'container',
  'function',
  'model',
  'gateway',
  'network',
  'cdn',
  'loadbalancer',
  'security',
  'identity',
  'firewall',
  'user',
  'team',
  'agent',
  'event',
  'channel',
  'signal',
  'document',
  'money',
  'time',
  'decision',
  'metric',
  'anchor',
  'target'
] as const;
export const MetaphorGlyphSchema = z.enum(METAPHOR_GLYPH_KINDS);

export const MetaphorLegendSchema = z
  .object({
    height: z.string().max(80).optional(),
    footprint: z.string().max(80).optional(),
    district: z.string().max(80).optional(),
    magnitude: z.string().max(80).optional(),
    cluster: z.string().max(80).optional(),
    thickness: z.string().max(80).optional(),
    weight: z.string().max(80).optional(),
    elevation: z.string().max(80).optional(),
    intensity: z.string().max(80).optional(),
    orbit: z.string().max(80).optional(),
    size: z.string().max(80).optional(),
    stage: z.string().max(80).optional(),
    flow: z.string().max(80).optional(),
    maturity: z.string().max(80).optional(),
    impact: z.string().max(80).optional(),
    bed: z.string().max(80).optional(),
    health: z.string().max(80).optional(),
    mass: z.string().max(80).optional(),
    relief: z.string().max(80).optional(),
    chain: z.string().max(80).optional()
  })
  .strict();

export const MetaphorPositionSchema = z.tuple([
  z.number().min(-30).max(30),
  z.number().min(-30).max(30),
  z.number().min(-30).max(30)
]);

export const MetaphorNebulaSchema = z.object({
  center: MetaphorPositionSchema,
  radius: z.number().positive().max(20).default(8),
  color: z.string().min(1).max(32).optional()
});

export const MetaphorSurfaceSchema = z.object({
  metric: z.string().max(80).optional(),
  baseline: z.number().min(-10).max(20).default(0)
});

export const MetaphorSceneSchema = z
  .object({
    theme: MetaphorThemeSchema,
    camera: MetaphorCameraSchema,
    title: z.string().max(160).optional(),
    subtitle: z.string().max(200).optional(),
    legend: MetaphorLegendSchema.optional(),
    nebula: z.array(MetaphorNebulaSchema).max(8).optional(),
    surface: MetaphorSurfaceSchema.optional()
  })
  .default(() => ({}) as never);

export const METAPHOR_LINK_KINDS = ['flow', 'dependency', 'ownership'] as const;
export const MetaphorLinkKindSchema = z.enum(METAPHOR_LINK_KINDS);

export const MetaphorLinkSchema = z.object({
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
  label: z.string().max(80).optional(),
  // Semantic edge type — drives link colour and whether a flow pulse animates.
  kind: MetaphorLinkKindSchema.optional()
});

export const METAPHOR_MAX_LINKS = 80;

const MetaphorItemBase = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'id must be alphanumeric with dashes/underscores'),
  label: z.string().min(1).max(120),
  position: MetaphorPositionSchema.optional(),
  glyph: MetaphorGlyphSchema.optional(),
  // Optional one-line annotation shown in the hover tooltip.
  note: z.string().max(140).optional()
});

const MetaphorLinksField = z.array(MetaphorLinkSchema).max(METAPHOR_MAX_LINKS).default([]);

export const CITY_LIGHTING = ['lit', 'dim', 'dark'] as const;
export const CITY_CONDITION = ['new', 'aging', 'crumbling'] as const;
export const CITY_MAX_ITEMS = 50;
export const CityItemSchema = MetaphorItemBase.extend({
  height: z.number().positive().max(100).default(10),
  footprint: z.number().positive().max(20).default(2),
  district: z.string().max(64).optional(),
  lighting: z.enum(CITY_LIGHTING).optional(),
  condition: z.enum(CITY_CONDITION).optional()
});

export const CityMetaphorSchema = z.object({
  metaphor: z.literal('city'),
  scene: MetaphorSceneSchema,
  items: z.array(CityItemSchema).max(CITY_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const LAYERCAKE_MAX_ITEMS = 20;
export const LayerItemSchema = MetaphorItemBase.extend({
  thickness: z.number().positive().max(10).default(1),
  components: z.array(z.string().min(1).max(120)).max(20).default([]),
  cracks: z.number().min(0).max(1).optional(),
  tilt: z.number().min(0).max(15).optional()
});

export const LayercakeMetaphorSchema = z.object({
  metaphor: z.literal('layercake'),
  scene: MetaphorSceneSchema,
  items: z.array(LayerItemSchema).max(LAYERCAKE_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const GALAXY_MAX_ITEMS = 150;
export const StarItemSchema = MetaphorItemBase.extend({
  magnitude: z.number().positive().max(20).default(5),
  cluster: z.string().max(64).optional(),
  binary: z.string().max(64).optional()
});

export const GalaxyMetaphorSchema = z.object({
  metaphor: z.literal('galaxy'),
  scene: MetaphorSceneSchema,
  items: z.array(StarItemSchema).max(GALAXY_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const TREE_KINDS = ['trunk', 'branch', 'leaf'] as const;
export const TREE_MAX_ITEMS = 60;
export const TreeItemSchema = MetaphorItemBase.extend({
  parent: z.string().min(1).max(64).optional(),
  weight: z.number().positive().max(20).default(3),
  kind: z.enum(TREE_KINDS).optional()
});

export const TreeMetaphorSchema = z.object({
  metaphor: z.literal('tree'),
  scene: MetaphorSceneSchema,
  items: z.array(TreeItemSchema).max(TREE_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const TERRAIN_MAX_ITEMS = 40;
export const TerrainItemSchema = MetaphorItemBase.extend({
  elevation: z.number().min(-10).max(20).default(3),
  intensity: z.number().min(0.1).max(10).default(3)
});

export const TerrainMetaphorSchema = z.object({
  metaphor: z.literal('terrain'),
  scene: MetaphorSceneSchema,
  items: z.array(TerrainItemSchema).max(TERRAIN_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const ORRERY_MAX_ITEMS = 40;
export const OrreryItemSchema = MetaphorItemBase.extend({
  /** Ring distance from the core; 0 = the central sun itself. */
  orbit: z.number().min(0).max(12).default(3),
  /** Body size (planet radius scale). */
  size: z.number().positive().max(10).default(3),
  /** Id of another item this body circles as a moon (renders beside its parent). */
  moon: z.string().max(64).optional()
});

export const OrreryMetaphorSchema = z.object({
  metaphor: z.literal('orrery'),
  scene: MetaphorSceneSchema,
  items: z.array(OrreryItemSchema).max(ORRERY_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const RIVER_MAX_ITEMS = 30;
export const RiverItemSchema = MetaphorItemBase.extend({
  /** Order along the river, source → mouth. Ties keep authoring order. */
  stage: z.number().min(0).max(100).default(0),
  /** Water volume passing this station — drives channel width. */
  flow: z.number().positive().max(20).default(5),
  /** 0–1 turbulence at this station — renders whitewater rapids. */
  hazard: z.number().min(0).max(1).optional()
});

export const RiverMetaphorSchema = z.object({
  metaphor: z.literal('river'),
  scene: MetaphorSceneSchema,
  items: z.array(RiverItemSchema).max(RIVER_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const GARDEN_HEALTH = ['thriving', 'steady', 'at-risk'] as const;
export const GARDEN_MAX_ITEMS = 40;
export const GardenItemSchema = MetaphorItemBase.extend({
  /** 0–1 lifecycle progress; drives stem height and bloom stage. */
  maturity: z.number().min(0).max(1).default(0.5),
  /** Relative value or influence; drives the flower/canopy scale. */
  impact: z.number().positive().max(10).default(3),
  /** Domain grouping rendered as a planted bed. */
  bed: z.string().max(64).optional(),
  /** Current state rendered through posture and foliage colour. */
  health: z.enum(GARDEN_HEALTH).default('steady')
});

export const GardenMetaphorSchema = z.object({
  metaphor: z.literal('garden'),
  scene: MetaphorSceneSchema,
  items: z.array(GardenItemSchema).max(GARDEN_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const ARCHIPELAGO_MAX_ITEMS = 40;
export const ArchipelagoItemSchema = MetaphorItemBase.extend({
  /** Island footprint / domain mass — drives island radius. */
  mass: z.number().positive().max(20).default(4),
  /** 0–1 vertical prominence — drives peak height and cliff drama. */
  relief: z.number().min(0).max(1).default(0.45),
  /** Island-chain grouping (region, bounded context family, product line). */
  chain: z.string().max(64).optional()
});

export const ArchipelagoMetaphorSchema = z.object({
  metaphor: z.literal('archipelago'),
  scene: MetaphorSceneSchema,
  items: z.array(ArchipelagoItemSchema).max(ARCHIPELAGO_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

/**
 * Composite v2 fuses semantic layers into one planned world. The v1
 * `adjacent` and `overlay` layouts remain accepted for authored compatibility.
 */
export const COMPOSITE_MAX_LAYERS = 4;
export const COMPOSITE_LAYOUTS = ['fused', 'adjacent', 'overlay'] as const;
export const CompositeLayoutSchema = z.enum(COMPOSITE_LAYOUTS).default('fused');
export const CompositeSeedSchema = z
  .union([z.string().trim().min(1).max(64), z.number().int().min(0).max(2_147_483_647)])
  .default(0);
export const CompositeNoveltySchema = z.number().min(0).max(1).default(0.55);
export const CompositeMotionIntensitySchema = z.number().min(0).max(1).default(0.65);

export const MetaphorLayerTransformSchema = z.object({
  position: MetaphorPositionSchema.optional(),
  scale: z.number().positive().max(4).default(1)
});

/** Loose item bag — per-layer `as` re-validates against that kind's item schema. */
export const CompositeLayerItemSchema = MetaphorItemBase.passthrough();

export const MetaphorCompositeLayerSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'id must be alphanumeric with dashes/underscores'),
  /** Which existing metaphor scene module to mount for this layer. */
  as: MetaphorBaseKindSchema,
  label: z.string().max(80).optional(),
  transform: MetaphorLayerTransformSchema.optional(),
  // The per-kind mini-schema below applies the tighter cap (for example city
  // 50); this outer cap must allow the largest base kind (galaxy 150).
  items: z.array(CompositeLayerItemSchema).max(GALAXY_MAX_ITEMS).default([])
});

const BASE_METAPHOR_SCHEMA_BY_KIND = {
  city: CityMetaphorSchema,
  layercake: LayercakeMetaphorSchema,
  galaxy: GalaxyMetaphorSchema,
  tree: TreeMetaphorSchema,
  terrain: TerrainMetaphorSchema,
  orrery: OrreryMetaphorSchema,
  river: RiverMetaphorSchema,
  garden: GardenMetaphorSchema,
  archipelago: ArchipelagoMetaphorSchema
} as const;

export const CompositeMetaphorSchema = z
  .object({
    metaphor: z.literal('composite'),
    scene: MetaphorSceneSchema,
    layout: CompositeLayoutSchema,
    /** Stable planner input. Same document + seed produces the same world. */
    seed: CompositeSeedSchema,
    /** 0 = conservative topology, 1 = bounded maximum spatial variation. */
    novelty: CompositeNoveltySchema,
    /** Semantic motion amplitude/speed multiplier; reduced motion still freezes it. */
    motionIntensity: CompositeMotionIntensitySchema,
    layers: z.array(MetaphorCompositeLayerSchema).min(1).max(COMPOSITE_MAX_LAYERS),
    /** Composite keeps items on layers; top-level stays empty for wire uniformity. */
    items: z.array(MetaphorItemBase).max(0).default([]),
    links: MetaphorLinksField
  })
  .superRefine((data, ctx) => {
    const seenLayerIds = new Set<string>();
    const seenItemIds = new Set<string>();
    for (let i = 0; i < data.layers.length; i += 1) {
      const layer = data.layers[i];
      if (seenLayerIds.has(layer.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate layer id "${layer.id}"`,
          path: ['layers', i, 'id']
        });
      }
      seenLayerIds.add(layer.id);

      for (let itemIndex = 0; itemIndex < layer.items.length; itemIndex += 1) {
        const itemId = layer.items[itemIndex]?.id;
        if (seenItemIds.has(itemId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate composite item id "${itemId}"`,
            path: ['layers', i, 'items', itemIndex, 'id']
          });
        }
        seenItemIds.add(itemId);
      }

      const mini = {
        metaphor: layer.as,
        scene: {},
        items: layer.items,
        links: []
      };
      const parsed = BASE_METAPHOR_SCHEMA_BY_KIND[layer.as].safeParse(mini);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          // Remap item paths under layers[i]; skip the synthetic metaphor/scene/links roots.
          if (issue.path[0] === 'items') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: issue.message,
              path: ['layers', i, ...issue.path]
            });
          } else if (issue.path[0] !== 'metaphor' && issue.path[0] !== 'scene') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: issue.message,
              path: ['layers', i, ...issue.path]
            });
          }
        }
      }
    }
  });

export const MetaphorDslSchema = z.discriminatedUnion('metaphor', [
  CityMetaphorSchema,
  LayercakeMetaphorSchema,
  GalaxyMetaphorSchema,
  TreeMetaphorSchema,
  TerrainMetaphorSchema,
  OrreryMetaphorSchema,
  RiverMetaphorSchema,
  GardenMetaphorSchema,
  ArchipelagoMetaphorSchema,
  CompositeMetaphorSchema
]);

export type MetaphorKind = z.infer<typeof MetaphorKindSchema>;
export type MetaphorBaseKind = z.infer<typeof MetaphorBaseKindSchema>;
export type MetaphorTheme = z.infer<typeof MetaphorThemeSchema>;
export type MetaphorCamera = z.infer<typeof MetaphorCameraSchema>;
export type MetaphorGlyph = z.infer<typeof MetaphorGlyphSchema>;
export type MetaphorLegend = z.infer<typeof MetaphorLegendSchema>;
export type MetaphorScene = z.infer<typeof MetaphorSceneSchema>;
export type MetaphorPosition = z.infer<typeof MetaphorPositionSchema>;
export type MetaphorNebula = z.infer<typeof MetaphorNebulaSchema>;
export type MetaphorSurface = z.infer<typeof MetaphorSurfaceSchema>;
export type MetaphorLinkKind = z.infer<typeof MetaphorLinkKindSchema>;
export type MetaphorLink = z.infer<typeof MetaphorLinkSchema>;
export type CityItem = z.infer<typeof CityItemSchema>;
export type LayerItem = z.infer<typeof LayerItemSchema>;
export type StarItem = z.infer<typeof StarItemSchema>;
export type TreeItem = z.infer<typeof TreeItemSchema>;
export type TerrainItem = z.infer<typeof TerrainItemSchema>;
export type OrreryItem = z.infer<typeof OrreryItemSchema>;
export type RiverItem = z.infer<typeof RiverItemSchema>;
export type GardenItem = z.infer<typeof GardenItemSchema>;
export type ArchipelagoItem = z.infer<typeof ArchipelagoItemSchema>;
export type CityMetaphor = z.infer<typeof CityMetaphorSchema>;
export type LayercakeMetaphor = z.infer<typeof LayercakeMetaphorSchema>;
export type GalaxyMetaphor = z.infer<typeof GalaxyMetaphorSchema>;
export type TreeMetaphor = z.infer<typeof TreeMetaphorSchema>;
export type TerrainMetaphor = z.infer<typeof TerrainMetaphorSchema>;
export type OrreryMetaphor = z.infer<typeof OrreryMetaphorSchema>;
export type RiverMetaphor = z.infer<typeof RiverMetaphorSchema>;
export type GardenMetaphor = z.infer<typeof GardenMetaphorSchema>;
export type ArchipelagoMetaphor = z.infer<typeof ArchipelagoMetaphorSchema>;
export type CompositeLayout = z.infer<typeof CompositeLayoutSchema>;
export type CompositeSeed = z.infer<typeof CompositeSeedSchema>;
export type MetaphorCompositeLayer = z.infer<typeof MetaphorCompositeLayerSchema>;
export type CompositeMetaphor = z.infer<typeof CompositeMetaphorSchema>;
export type MetaphorDsl = z.infer<typeof MetaphorDslSchema>;
