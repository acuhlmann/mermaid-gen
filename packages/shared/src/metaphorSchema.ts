import { z } from 'zod';

export const METAPHOR_KINDS = ['city', 'layercake', 'galaxy'] as const;
export const MetaphorKindSchema = z.enum(METAPHOR_KINDS);

export const METAPHOR_THEMES = ['whiteboard', 'noir', 'arcade'] as const;
export const MetaphorThemeSchema = z.enum(METAPHOR_THEMES).default('whiteboard');

export const METAPHOR_CAMERAS = ['orbit', 'isometric'] as const;
export const MetaphorCameraSchema = z.enum(METAPHOR_CAMERAS).default('orbit');

export const MetaphorSceneSchema = z
  .object({
    theme: MetaphorThemeSchema,
    camera: MetaphorCameraSchema,
    title: z.string().max(160).optional()
  })
  .default(() => ({}) as never);

export const MetaphorPositionSchema = z.tuple([
  z.number().min(-30).max(30),
  z.number().min(-30).max(30),
  z.number().min(-30).max(30)
]);

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
  position: MetaphorPositionSchema.optional()
});

const MetaphorLinksField = z.array(MetaphorLinkSchema).max(METAPHOR_MAX_LINKS).default([]);

export const CITY_MAX_ITEMS = 50;
export const CityItemSchema = MetaphorItemBase.extend({
  height: z.number().positive().max(100).default(10),
  footprint: z.number().positive().max(20).default(2),
  district: z.string().max(64).optional()
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
  components: z.array(z.string().min(1).max(120)).max(20).default([])
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
  cluster: z.string().max(64).optional()
});

export const GalaxyMetaphorSchema = z.object({
  metaphor: z.literal('galaxy'),
  scene: MetaphorSceneSchema,
  items: z.array(StarItemSchema).max(GALAXY_MAX_ITEMS).default([]),
  links: MetaphorLinksField
});

export const MetaphorDslSchema = z.discriminatedUnion('metaphor', [
  CityMetaphorSchema,
  LayercakeMetaphorSchema,
  GalaxyMetaphorSchema
]);

export type MetaphorKind = z.infer<typeof MetaphorKindSchema>;
export type MetaphorTheme = z.infer<typeof MetaphorThemeSchema>;
export type MetaphorCamera = z.infer<typeof MetaphorCameraSchema>;
export type MetaphorScene = z.infer<typeof MetaphorSceneSchema>;
export type MetaphorPosition = z.infer<typeof MetaphorPositionSchema>;
export type MetaphorLink = z.infer<typeof MetaphorLinkSchema>;
export type CityItem = z.infer<typeof CityItemSchema>;
export type LayerItem = z.infer<typeof LayerItemSchema>;
export type StarItem = z.infer<typeof StarItemSchema>;
export type CityMetaphor = z.infer<typeof CityMetaphorSchema>;
export type LayercakeMetaphor = z.infer<typeof LayercakeMetaphorSchema>;
export type GalaxyMetaphor = z.infer<typeof GalaxyMetaphorSchema>;
export type MetaphorDsl = z.infer<typeof MetaphorDslSchema>;
