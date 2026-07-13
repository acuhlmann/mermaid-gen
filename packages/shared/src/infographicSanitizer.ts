/**
 * Deterministic AntV Infographic DSL cleanup before parse/render.
 * Shared by server validation and the web renderer so pasted DSL matches agent output.
 */

import { parseSyntax } from '@antv/infographic';

const VALID_THEME_CHILD_KEY = 'palette';
const HUB_HIERARCHY_TEMPLATE = 'hierarchy-tree-curved-line-rounded-rect-node';
const GENERIC_RELATION_LABELS = new Set([
  '',
  'connects to',
  'connected to',
  'related to',
  'links to',
  'linked to',
  'leads to',
  'goes to',
  'points to',
  'associated with',
  'has',
  'includes'
]);

function leadingIndent(line: string) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

/**
 * Drops unknown keys under a root-level `theme` block.
 */
export function stripInvalidThemeKeys(text: string) {
  const lines = text.split('\n');
  const out = [];
  let stripped = false;

  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^theme\s*$/i.test(trimmed) && leadingIndent(line) === 0) {
      const themeIndent = leadingIndent(line);
      out.push(line);
      i += 1;
      let keptChild = false;
      while (i < lines.length) {
        const child = lines[i];
        if (child.trim() === '') {
          out.push(child);
          i += 1;
          continue;
        }
        const childIndent = leadingIndent(child);
        if (childIndent <= themeIndent) break;
        const key = child.trim().split(/\s+/)[0]?.toLowerCase();
        if (key === VALID_THEME_CHILD_KEY) {
          out.push(child);
          keptChild = true;
        } else {
          stripped = true;
        }
        i += 1;
      }
      if (!keptChild) {
        out.pop();
      }
      continue;
    }
    out.push(line);
    i += 1;
  }

  return {
    text: out.join('\n'),
    applied: stripped ? ['strip-invalid-theme-keys'] : []
  };
}

/**
 * Collapse repeated palette colors (models often echo the same hex 6×).
 */
export function dedupeThemePalette(text: string) {
  const lines = text.split('\n');
  let changed = false;
  const out = lines.map((line) => {
    const m = line.match(/^(\s*)palette\s+(.+)$/i);
    if (!m) return line;
    const colors = m[2]
      .trim()
      .split(/\s+/)
      .filter((c) => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c));
    if (colors.length <= 1) return line;
    const unique = [];
    const seen = new Set();
    for (const c of colors) {
      const key = c.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
      if (unique.length >= 5) break;
    }
    if (unique.length === colors.length) return line;
    changed = true;
    return `${m[1]}palette ${unique.join(' ')}`;
  });
  return {
    text: out.join('\n'),
    applied: changed ? ['dedupe-theme-palette'] : []
  };
}

function isGenericRelationLabel(label: unknown) {
  const norm = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return GENERIC_RELATION_LABELS.has(norm);
}

type InfographicSyntaxNode = {
  id?: string;
  label?: string;
  icon?: string;
  desc?: string;
  [key: string]: unknown;
};

function resolveNode(nodes: InfographicSyntaxNode[], ref: unknown) {
  const key = String(ref ?? '').trim();
  if (!key) return null;
  for (const node of nodes) {
    if (node?.id === key || node?.label === key) return node;
  }
  return null;
}

function formatHierarchyItem(node: InfographicSyntaxNode, indent: string) {
  const lines = [`${indent}- label ${node.label ?? ''}`];
  if (node.icon) lines.push(`${indent}  icon ${node.icon}`);
  if (node.desc) lines.push(`${indent}  desc ${node.desc}`);
  return lines.join('\n');
}

/**
 * Hub-and-spoke "overview" graphs parse on relation-* but layout poorly (dagre TB + circle
 * nodes + redundant edge labels). Rewrite to a hierarchy tree when edges are generic.
 */
export function convertHubRelationToHierarchy(text: string): { text: string; applied: string[] } {
  let parsed;
  try {
    parsed = parseSyntax(text);
  } catch {
    return { text, applied: [] };
  }
  if (parsed?.errors?.length) return { text, applied: [] };

  const template = parsed?.options?.template ?? '';
  if (!/^relation-/.test(template)) return { text, applied: [] };

  const data = parsed?.options?.data ?? {};
  const relations: Array<{ from?: string; to?: string; label?: string }> = Array.isArray(
    data.relations
  )
    ? data.relations
    : [];
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  if (relations.length < 3 || nodes.length < 3) return { text, applied: [] };

  const fromIds = new Set(relations.map((r) => r?.from).filter(Boolean));
  if (fromIds.size !== 1) return { text, applied: [] };

  const labels = relations.map((r) => r?.label ?? '');
  if (!labels.every(isGenericRelationLabel)) return { text, applied: [] };

  const hubRef = [...fromIds][0];
  const hub = resolveNode(nodes, hubRef);
  if (!hub) return { text, applied: [] };

  const childRefs = relations.map((r) => r?.to).filter(Boolean);
  const children = childRefs.map((ref) => resolveNode(nodes, ref)).filter(Boolean);
  if (children.length < 2) return { text, applied: [] };

  const lines = [`infographic ${HUB_HIERARCHY_TEMPLATE}`, 'data'];
  if (data.title) lines.push(`  title ${data.title}`);
  if (data.desc) lines.push(`  desc ${data.desc}`);
  lines.push('  root');
  lines.push(`    label ${hub.label ?? hubRef}`);
  if (hub.icon) lines.push(`    icon ${hub.icon}`);
  if (hub.desc) lines.push(`    desc ${hub.desc}`);
  lines.push('    children');
  for (const child of children) {
    if (!child) continue;
    lines.push(formatHierarchyItem(child, '      '));
  }

  const themeMatch = text.match(/^theme\n([\s\S]*)$/im);
  if (themeMatch) {
    const themeBlock = themeMatch[0].trimEnd();
    const stripped = stripInvalidThemeKeys(`${themeBlock}\n`);
    if (stripped.text.trim()) {
      lines.push(stripped.text.trim());
    }
  }

  return {
    text: `${lines.join('\n')}\n`,
    applied: ['convert-hub-relation-to-hierarchy']
  };
}

/**
 * @param {string} raw
 * @param {{ allowStructureRewrite?: boolean }} [options]
 * @returns {{ text: string, applied: string[] }}
 */
export function sanitizeInfographicDsl(
  raw: unknown,
  options: { allowStructureRewrite?: boolean } = {}
) {
  const { allowStructureRewrite = true } = options;
  const applied = [];
  let text = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');

  const theme = stripInvalidThemeKeys(text);
  if (theme.applied.length) {
    text = theme.text;
    applied.push(...theme.applied);
  }

  const palette = dedupeThemePalette(text);
  if (palette.applied.length) {
    text = palette.text;
    applied.push(...palette.applied);
  }

  if (allowStructureRewrite) {
    const hierarchy = convertHubRelationToHierarchy(text);
    if (hierarchy.applied.length) {
      text = hierarchy.text;
      applied.push(...hierarchy.applied);
    }
  }

  return { text, applied };
}
