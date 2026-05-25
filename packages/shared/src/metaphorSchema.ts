import { z } from 'zod';

export const METAPHOR_KINDS = ['city', 'layercake', 'galaxy', 'tree', 'terrain'] as const;
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
    intensity: z.string().max(80).optional()
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

export const MetaphorLinkSchema = z.object({
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
  label: z.string().max(80).optional()
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
  glyph: MetaphorGlyphSchema.optional()
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

export const MetaphorDslSchema = z.discriminatedUnion('metaphor', [
  CityMetaphorSchema,
  LayercakeMetaphorSchema,
  GalaxyMetaphorSchema,
  TreeMetaphorSchema,
  TerrainMetaphorSchema
]);

export type MetaphorKind = z.infer<typeof MetaphorKindSchema>;
export type MetaphorTheme = z.infer<typeof MetaphorThemeSchema>;
export type MetaphorCamera = z.infer<typeof MetaphorCameraSchema>;
export type MetaphorGlyph = z.infer<typeof MetaphorGlyphSchema>;
export type MetaphorLegend = z.infer<typeof MetaphorLegendSchema>;
export type MetaphorScene = z.infer<typeof MetaphorSceneSchema>;
export type MetaphorPosition = z.infer<typeof MetaphorPositionSchema>;
export type MetaphorNebula = z.infer<typeof MetaphorNebulaSchema>;
export type MetaphorSurface = z.infer<typeof MetaphorSurfaceSchema>;
export type MetaphorLink = z.infer<typeof MetaphorLinkSchema>;
export type CityItem = z.infer<typeof CityItemSchema>;
export type LayerItem = z.infer<typeof LayerItemSchema>;
export type StarItem = z.infer<typeof StarItemSchema>;
export type TreeItem = z.infer<typeof TreeItemSchema>;
export type TerrainItem = z.infer<typeof TerrainItemSchema>;
export type CityMetaphor = z.infer<typeof CityMetaphorSchema>;
export type LayercakeMetaphor = z.infer<typeof LayercakeMetaphorSchema>;
export type GalaxyMetaphor = z.infer<typeof GalaxyMetaphorSchema>;
export type TreeMetaphor = z.infer<typeof TreeMetaphorSchema>;
export type TerrainMetaphor = z.infer<typeof TerrainMetaphorSchema>;
export type MetaphorDsl = z.infer<typeof MetaphorDslSchema>;
