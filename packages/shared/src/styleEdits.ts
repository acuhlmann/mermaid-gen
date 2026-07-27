/**
 * Server-built style edit cards (AG-UI CUSTOM artifact `style_edits`).
 * Parses numbered/bullet lines from critique/style/gilfoyle prose — no model-authored UI JSON.
 */

import { z } from 'zod';
import { DEFAULT_DIAGRAM_STYLE, normalizeDiagramStyleConfig } from './mermaidStyle.js';

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;

export const StyleEditIconReplaceSchema = z.object({
  kind: z.literal('icon_replace'),
  id: z.string().optional(),
  from: z.string(),
  to: z.string()
});

export const StyleEditColorShiftSchema = z.object({
  kind: z.literal('color_shift'),
  id: z.string().optional(),
  variable: z.string().optional(),
  from: z.string(),
  to: z.string().optional(),
  toLabel: z.string().optional()
});

export const StyleEditGenericSchema = z.object({
  kind: z.literal('generic'),
  id: z.string().optional(),
  text: z.string()
});

export const StyleEditSchema = z.discriminatedUnion('kind', [
  StyleEditIconReplaceSchema,
  StyleEditColorShiftSchema,
  StyleEditGenericSchema
]);

export type StyleEdit = z.infer<typeof StyleEditSchema>;

export type StyleEditsArtifact = {
  type: 'artifact';
  kind: 'style_edits';
  edits: StyleEdit[];
};

const THEME_VAR_NAMES = [
  'tertiaryTextColor',
  'primaryColor',
  'secondaryColor',
  'primaryTextColor',
  'secondaryTextColor',
  'tertiaryColor',
  'primaryBorderColor',
  'secondaryBorderColor',
  'tertiaryBorderColor',
  'lineColor',
  'textColor',
  'mainBkg',
  'nodeBorder',
  'clusterBkg',
  'clusterBorder',
  'edgeLabelBackground',
  'titleColor',
  'background',
  'fontFamily'
];

function extractStepId(line: string): string | undefined {
  const m = line.trim().match(/^(\d+)[.)]\s+/);
  return m ? m[1] : undefined;
}

function stripStepPrefix(line: string): string {
  return line
    .trim()
    .replace(/^(\d+)[.)]\s+/, '')
    .replace(/^[-•*]\s+/, '');
}

function parseIconReplace(body: string, id?: string): StyleEdit | null {
  const m = body.match(/replace\s*::?\s*icon\s*\(\s*(fa\s+fa-[\w-]+)\s*\)\s*(?:with|→)\s*(\S+)/i);
  if (!m) return null;
  return StyleEditIconReplaceSchema.parse({
    kind: 'icon_replace',
    id,
    from: m[1].trim(),
    to: m[2].trim()
  });
}

function parseColorShift(body: string, id?: string): StyleEdit | null {
  const hexes: string[] = [];
  let hm: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((hm = HEX_RE.exec(body)) !== null) {
    hexes.push(`#${hm[1]}`);
  }
  if (hexes.length === 0) return null;

  let variable: string | undefined;
  for (const name of THEME_VAR_NAMES) {
    if (body.includes(name)) {
      variable = name;
      break;
    }
  }

  const toOptional = /something\s+like|similar\s+to|e\.g\.|approx/i.test(body);
  const from = hexes[0];
  const to = hexes.length > 1 ? hexes[1] : undefined;

  if (!from) return null;

  return StyleEditColorShiftSchema.parse({
    kind: 'color_shift',
    id,
    variable,
    from,
    to,
    toLabel: to ? undefined : toOptional ? 'suggested' : undefined
  });
}

function parseLine(line: string): StyleEdit | null {
  const id = extractStepId(line);
  const body = stripStepPrefix(line);
  if (!body) return null;

  const icon = parseIconReplace(body, id);
  if (icon) return icon;

  if (/#([0-9a-fA-F]{3,8})\b/i.test(body) || THEME_VAR_NAMES.some((n) => body.includes(n))) {
    const color = parseColorShift(body, id);
    if (color) return color;
  }

  if (
    /::icon\s*\(/i.test(body) ||
    /\breplace\b/i.test(body) ||
    /\bdarken\b/i.test(body) ||
    /\blighten\b/i.test(body)
  ) {
    return StyleEditGenericSchema.parse({ kind: 'generic', id, text: body });
  }

  return null;
}

/**
 * Parse markdown/plain lines into structured style edit cards.
 */
export function parseStyleEditsFromText(text: string): StyleEdit[] {
  if (text == null || typeof text !== 'string') return [];
  const lines = text.split('\n');
  const edits: StyleEdit[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const edit = parseLine(trimmed);
    if (!edit) continue;
    const key = JSON.stringify(edit);
    if (seen.has(key)) continue;
    seen.add(key);
    edits.push(edit);
  }

  return edits;
}

/**
 * Build stream artifact when at least one visual style edit line is detected.
 */
export function buildStyleEditsArtifact(text: string): StyleEditsArtifact | null {
  const edits = parseStyleEditsFromText(text);
  if (edits.length === 0) return null;
  return {
    type: 'artifact',
    kind: 'style_edits',
    edits
  };
}

function normalizeHex(hex: string | null | undefined): string | null {
  const h = String(hex ?? '')
    .replace(/^#/, '')
    .trim();
  if (!h) return null;
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h}`.toLowerCase();
  if (/^[0-9a-fA-F]{8}$/.test(h)) return `#${h}`.toLowerCase();
  return null;
}

/** One-line summary for prompts, A2UI rows, and prose de-duplication. */
export function styleEditSummaryLine(edit: StyleEdit): string {
  if (edit.kind === 'icon_replace') {
    return `Replace ${edit.from} with ${edit.to}`;
  }
  if (edit.kind === 'color_shift') {
    const varPart = edit.variable ? `${edit.variable}: ` : '';
    const toPart = edit.to ? `${edit.from} → ${edit.to}` : edit.from;
    return `${varPart}${toPart}`;
  }
  return edit.text;
}

/** Natural-language prompt for the style agent route. */
export function styleEditsToPrompt(edits: StyleEdit[]): string {
  const lines = edits.map((edit, index) => {
    const step = edit.id ?? String(index + 1);
    if (edit.kind === 'icon_replace') {
      return `${step}. Replace icon ${edit.from} with ${edit.to}`;
    }
    if (edit.kind === 'color_shift') {
      const varPart = edit.variable ? `${edit.variable} ` : '';
      const toPart = edit.to ? `from ${edit.from} to ${edit.to}` : `use ${edit.from}`;
      return `${step}. Adjust ${varPart}${toPart}`;
    }
    return `${step}. ${edit.text}`;
  });
  return `Apply these style tweaks to the diagram:\n${lines.join('\n')}`;
}

function resolveColorVariable(
  edit: z.infer<typeof StyleEditColorShiftSchema>,
  themeVariables: Record<string, unknown>
): string | undefined {
  if (edit.variable) return edit.variable;
  if (!edit.from || !edit.to) return undefined;
  const fromNorm = normalizeHex(edit.from);
  if (!fromNorm) return undefined;
  for (const [key, value] of Object.entries(themeVariables)) {
    if (normalizeHex(String(value)) === fromNorm) return key;
  }
  return undefined;
}

/** True when every edit is a resolvable theme-variable color shift (no LLM). */
export function canApplyStyleEditsDeterministically(
  edits: StyleEdit[],
  styleConfig: unknown = DEFAULT_DIAGRAM_STYLE
): boolean {
  if (!Array.isArray(edits) || edits.length === 0) return false;
  const normalized = normalizeDiagramStyleConfig(styleConfig);
  return edits.every((edit) => {
    if (edit.kind !== 'color_shift' || !edit.to) return false;
    return Boolean(resolveColorVariable(edit, normalized.themeVariables));
  });
}

/** Merge parsed color shifts into a diagram style config. */
export function applyStyleEditsToStyleConfig(
  edits: StyleEdit[],
  styleConfig: unknown = DEFAULT_DIAGRAM_STYLE
) {
  const normalized = normalizeDiagramStyleConfig(styleConfig);
  const themeVariables = { ...normalized.themeVariables };

  for (const edit of edits) {
    if (edit.kind !== 'color_shift' || !edit.to) continue;
    const key = resolveColorVariable(edit, normalized.themeVariables);
    if (!key) continue;
    themeVariables[key] = normalizeHex(edit.to) ?? edit.to;
  }

  return normalizeDiagramStyleConfig({
    ...normalized,
    themeVariables
  });
}
