import { z } from 'zod';

export const MermaidThemeSchema = z.enum([
  'default',
  'base',
  'dark',
  'forest',
  'neutral',
  'neo',
  'neo-dark',
  'redux',
  'redux-dark',
  'redux-color',
  'redux-dark-color',
  'null'
]);

export const MermaidLookSchema = z.enum(['classic', 'handDrawn', 'neo']);

export const MermaidCurveSchema = z.enum([
  'basis',
  'bumpX',
  'bumpY',
  'cardinal',
  'catmullRom',
  'linear',
  'monotoneX',
  'monotoneY',
  'natural',
  'step',
  'stepAfter',
  'stepBefore',
  'rounded'
]);

export const DEFAULT_THEME_VARIABLES = Object.freeze({
  background: '#f7f7f7',
  primaryColor: '#d7ffb8',
  primaryTextColor: '#3c3c3c',
  primaryBorderColor: '#58cc02',
  secondaryColor: '#ddf4ff',
  secondaryTextColor: '#1f4f66',
  secondaryBorderColor: '#1cb0f6',
  tertiaryColor: '#fff4b8',
  tertiaryTextColor: '#4b3b00',
  tertiaryBorderColor: '#ffc800',
  lineColor: '#4b4b4b',
  textColor: '#3c3c3c',
  mainBkg: '#d7ffb8',
  nodeBorder: '#58cc02',
  clusterBkg: '#efffe5',
  clusterBorder: '#89e219',
  edgeLabelBackground: '#ffffff',
  titleColor: '#3c3c3c',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
});

export const DEFAULT_DIAGRAM_STYLE_VALUES = Object.freeze({
  theme: 'base',
  look: 'neo',
  themeVariables: DEFAULT_THEME_VARIABLES,
  themeCSS: '',
  flowchart: { curve: 'rounded' as const }
} as const);

export const DiagramStyleSchema = z.object({
  theme: MermaidThemeSchema.default(DEFAULT_DIAGRAM_STYLE_VALUES.theme),
  look: MermaidLookSchema.default(DEFAULT_DIAGRAM_STYLE_VALUES.look),
  themeVariables: z.record(z.string(), z.unknown()).default(DEFAULT_THEME_VARIABLES),
  themeCSS: z.string().default(''),
  flowchart: z
    .object({
      curve: MermaidCurveSchema.default(DEFAULT_DIAGRAM_STYLE_VALUES.flowchart.curve)
    })
    .default(DEFAULT_DIAGRAM_STYLE_VALUES.flowchart)
});

export const DEFAULT_DIAGRAM_STYLE = Object.freeze(DiagramStyleSchema.parse({}));

const INIT_DIRECTIVE_PATTERN = /^\s*%%\{\s*(?:init|initialize)\s*:\s*([\s\S]*?)\s*\}%%\s*/;

function formatZodError(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'styleConfig'}: ${issue.message}`)
    .join('; ');
}

export function normalizeDiagramStyleConfig(styleConfig: unknown = {}) {
  return DiagramStyleSchema.parse(styleConfig ?? {});
}

export function extractMermaidInitDirective(mermaidSource: string | null | undefined) {
  const source = mermaidSource ?? '';
  const match = source.match(INIT_DIRECTIVE_PATTERN);

  if (!match) {
    return {
      hasDirective: false,
      directive: '',
      argsText: '',
      body: source
    };
  }

  return {
    hasDirective: true,
    directive: match[0],
    argsText: match[1].trim(),
    body: source.slice(match[0].length)
  };
}

export function parseMermaidStyleConfig(
  mermaidSource: string | null | undefined
):
  | { accepted: true; styleConfig: z.infer<typeof DiagramStyleSchema> }
  | { accepted: false; error: string } {
  const directive = extractMermaidInitDirective(mermaidSource);
  if (!directive.hasDirective) {
    return {
      accepted: true,
      styleConfig: DEFAULT_DIAGRAM_STYLE
    };
  }

  let parsedArgs;
  try {
    parsedArgs = JSON.parse(directive.argsText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      accepted: false,
      error: `Invalid Mermaid init JSON: ${message}`
    };
  }

  const parsedStyle = DiagramStyleSchema.safeParse(parsedArgs);
  if (!parsedStyle.success) {
    return {
      accepted: false,
      error: `Invalid Mermaid style config: ${formatZodError(parsedStyle.error)}`
    };
  }

  return {
    accepted: true,
    styleConfig: parsedStyle.data
  };
}

export function buildMermaidInitDirective(styleConfig = DEFAULT_DIAGRAM_STYLE) {
  const normalized = normalizeDiagramStyleConfig(styleConfig);
  const mermaidConfig = styleConfigToMermaidConfig(normalized);

  return `%%{init: ${JSON.stringify(mermaidConfig)}}%%`;
}

export function styleConfigToMermaidConfig(styleConfig = DEFAULT_DIAGRAM_STYLE) {
  const normalized = normalizeDiagramStyleConfig(styleConfig);
  const mermaidConfig: Record<string, unknown> = {
    theme: normalized.theme,
    look: normalized.look,
    themeVariables: normalized.themeVariables,
    flowchart: normalized.flowchart
  };

  if (normalized.themeCSS.trim()) {
    mermaidConfig.themeCSS = normalized.themeCSS;
  }

  return mermaidConfig;
}

export function applyMermaidStyleDirective({
  mermaidSource,
  styleConfig
}: {
  mermaidSource: string | null | undefined;
  styleConfig?: unknown;
}) {
  const normalized = normalizeDiagramStyleConfig(styleConfig);
  const directive = buildMermaidInitDirective(normalized);
  const current = extractMermaidInitDirective(mermaidSource);

  return {
    mermaidSource: `${directive}\n${current.body.trimStart()}`,
    styleConfig: normalized
  };
}

export function stripMermaidInitDirective(mermaidSource: string | null | undefined) {
  return extractMermaidInitDirective(mermaidSource).body.trimStart();
}
