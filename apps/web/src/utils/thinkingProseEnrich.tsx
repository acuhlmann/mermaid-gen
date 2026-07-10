/**
 * Deterministic micro-viz for Thinking pane prose (hex swatches, color ramps, icons, theme vars).
 * Model keeps writing markdown; the host interprets tokens — no model-authored UI JSON.
 */

import type { ReactNode } from 'react';
import { DEFAULT_THEME_VARIABLES } from '@archislop/shared';

const THEME_VAR_KEYS = Object.keys(DEFAULT_THEME_VARIABLES);

const MERMAID_THEME_LABELS = new Set([
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

const MERMAID_LOOK_LABELS = new Set(['classic', 'handDrawn', 'neo']);

const MERMAID_CURVE_LABELS = new Set([
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

const DIAGRAM_TYPE_LABELS = new Set([
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'statediagram',
  'erdiagram',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'journey',
  'gitgraph',
  'c4context',
  'requirementdiagram',
  'sankey'
]);

export function normalizeHex(hex: string | null | undefined): string | null {
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

/** Relative luminance 0–1 for contrast hint. */
function hexLuminance(hex: string | null | undefined): number {
  const n = normalizeHex(hex);
  if (!n) return 0.5;
  const raw = n.slice(1);
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function ColorSwatch({
  hex,
  label,
  keyPrefix = 'sw'
}: {
  hex?: string;
  label?: string;
  keyPrefix?: string;
}) {
  const color = normalizeHex(hex) ?? hex;
  const lum = hexLuminance(color);
  const darkText = lum > 0.55;
  return (
    <span
      className="insights-color-swatch"
      title={label ?? color}
      data-testid="thinking-color-swatch"
    >
      <span
        className="insights-color-swatch-chip"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <code className={`insights-color-swatch-hex ${darkText ? 'is-on-light' : 'is-on-dark'}`}>
        {color}
      </code>
    </span>
  );
}

export function ColorRamp({
  fromHex,
  toHex,
  keyPrefix = 'ramp'
}: {
  fromHex?: string;
  toHex?: string;
  keyPrefix?: string;
}) {
  const from = normalizeHex(fromHex) ?? fromHex;
  const to = normalizeHex(toHex) ?? toHex;
  return (
    <span
      className="insights-color-ramp"
      data-testid="thinking-color-ramp"
      title={`${from} → ${to}`}
    >
      <ColorSwatch hex={from} keyPrefix={`${keyPrefix}-f`} />
      <span className="insights-color-ramp-arrow" aria-hidden="true">
        →
      </span>
      <span
        className="insights-color-ramp-gradient"
        style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
        aria-hidden="true"
      />
      <ColorSwatch hex={to} keyPrefix={`${keyPrefix}-t`} />
    </span>
  );
}

export function ThemeVarPill({ name, keyPrefix = 'tv' }: { name: string; keyPrefix?: string }) {
  const lookup = (DEFAULT_THEME_VARIABLES as Record<string, string>)[name];
  const defaultHex = typeof lookup === 'string' ? lookup : null;
  return (
    <span className="insights-theme-var-pill" data-testid="thinking-theme-var" title={name}>
      <span className="insights-theme-var-label">{name}</span>
      {defaultHex ? (
        <ColorSwatch hex={defaultHex} label={`Default ${name}`} keyPrefix={`${keyPrefix}-d`} />
      ) : null}
    </span>
  );
}

export function IconChip({
  faClasses,
  keyPrefix = 'ic'
}: {
  faClasses?: string;
  keyPrefix?: string;
}) {
  const parts = String(faClasses ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const iconClass = parts.length ? parts.join(' ') : 'fa fa-circle';
  const short = parts.filter((p) => p.startsWith('fa-')).pop() ?? 'icon';
  return (
    <span className="insights-icon-chip" data-testid="thinking-icon-chip" title={iconClass}>
      <i className={iconClass} aria-hidden="true" />
      <span className="insights-icon-chip-label">{short.replace(/^fa-/, '')}</span>
    </span>
  );
}

export function IconReplaceRow({
  fromFa,
  toEmoji,
  keyPrefix = 'ir'
}: {
  fromFa?: string;
  toEmoji?: string;
  keyPrefix?: string;
}) {
  return (
    <span className="insights-icon-replace" data-testid="thinking-icon-replace">
      <IconChip faClasses={fromFa} keyPrefix={`${keyPrefix}-from`} />
      <span className="insights-icon-replace-arrow" aria-hidden="true">
        →
      </span>
      <span className="insights-icon-replace-emoji" aria-hidden="true">
        {toEmoji}
      </span>
    </span>
  );
}

export function DiagramTypeBadge({
  typeLabel,
  direction,
  keyPrefix = 'dt'
}: {
  typeLabel: string;
  direction?: string;
  keyPrefix?: string;
}) {
  const dir = direction ? ` ${direction}` : '';
  return (
    <span className="insights-diagram-type-badge" data-testid="thinking-diagram-type">
      {typeLabel}
      {dir}
    </span>
  );
}

export function StyleEnumPill({
  value,
  kind = 'theme',
  keyPrefix = 'se'
}: {
  value: string;
  kind?: string;
  keyPrefix?: string;
}) {
  return (
    <span className={`insights-style-enum-pill is-${kind}`} data-testid="thinking-style-enum">
      {value}
    </span>
  );
}

export function PatchLinesBar({
  added = 0,
  removed = 0,
  keyPrefix = 'pb'
}: {
  added?: number;
  removed?: number;
  keyPrefix?: string;
}) {
  const a = Math.max(0, Number(added) || 0);
  const r = Math.max(0, Number(removed) || 0);
  const total = a + r || 1;
  const addPct = (a / total) * 100;
  const remPct = (r / total) * 100;
  return (
    <span
      className="insights-patch-lines-bar"
      data-testid="thinking-patch-bar"
      title={`+${a} / −${r} lines`}
    >
      <span className="insights-patch-lines-bar-track" aria-hidden="true">
        {a > 0 ? (
          <span className="insights-patch-lines-bar-add" style={{ width: `${addPct}%` }} />
        ) : null}
        {r > 0 ? (
          <span className="insights-patch-lines-bar-rem" style={{ width: `${remPct}%` }} />
        ) : null}
      </span>
      <span className="insights-patch-lines-bar-label">
        +{a} / −{r} lines
      </span>
    </span>
  );
}

const INLINE_MARKDOWN = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/;

const COLOR_RAMP_RE =
  /(?:from|#)\s*(#[0-9a-fA-F]{3,8})\b[\s\S]{0,80}?(?:to|like|→)\s*(#[0-9a-fA-F]{3,8})\b/i;

const ICON_REPLACE_RE = /replace\s*::?\s*icon\s*\(\s*(fa\s+fa-[\w-]+)\s*\)\s*(?:with|→)\s*(\S+)/i;

const ICON_SYNTAX_RE = /::icon\s*\(\s*(fa\s+fa-[\w-]+)\s*\)/gi;

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;

const THEME_VAR_RE = new RegExp(`\\b(${THEME_VAR_KEYS.join('|')})\\b`, 'g');

const DIAGRAM_TYPE_RE =
  /\b(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|journey|gitGraph|C4Context|requirementDiagram|sankey-beta|sankey)\s+([A-Za-z]{1,3})?\b/gi;

const PATCH_LINES_RE = /\+\s*(\d+)\s*\/\s*[−-]\s*(\d+)\s*lines?/i;

type EarliestToken =
  | { index: number; len: number; kind: 'icon'; data: string }
  | { index: number; len: number; kind: 'diagram'; data: RegExpExecArray }
  | { index: number; len: number; kind: 'themeVar'; data: string }
  | { index: number; len: number; kind: 'hex'; data: string }
  | { index: number; len: number; kind: 'enum'; data: { value: string; enumKind: string } };

/**
 * Tokenize a prose segment for rich inline rendering (longest-match priority).
 */
export function tokenizeThinkingProse(text: string, keyBase = 'tp'): ReactNode[] {
  if (!text) return [];
  const ramp = text.match(COLOR_RAMP_RE);
  if (ramp) {
    const idx = text.indexOf(ramp[0]);
    const before = text.slice(0, idx);
    const after = text.slice(idx + ramp[0].length);
    return [
      ...tokenizeThinkingProse(before, `${keyBase}-b`),
      <ColorRamp
        key={`${keyBase}-ramp`}
        fromHex={ramp[1]}
        toHex={ramp[2]}
        keyPrefix={`${keyBase}-r`}
      />,
      ...tokenizeThinkingProse(after, `${keyBase}-a`)
    ];
  }

  const iconReplace = text.match(ICON_REPLACE_RE);
  if (iconReplace) {
    const idx = text.indexOf(iconReplace[0]);
    const before = text.slice(0, idx);
    const after = text.slice(idx + iconReplace[0].length);
    return [
      ...tokenizeThinkingProse(before, `${keyBase}-ib`),
      <IconReplaceRow
        key={`${keyBase}-ir`}
        fromFa={iconReplace[1]}
        toEmoji={iconReplace[2]}
        keyPrefix={`${keyBase}-ir`}
      />,
      ...tokenizeThinkingProse(after, `${keyBase}-ia`)
    ];
  }

  const patchLines = text.match(PATCH_LINES_RE);
  if (patchLines) {
    const idx = text.indexOf(patchLines[0]);
    const before = text.slice(0, idx);
    const after = text.slice(idx + patchLines[0].length);
    return [
      ...tokenizeThinkingProse(before, `${keyBase}-pb-b`),
      <PatchLinesBar
        key={`${keyBase}-plb`}
        added={Number(patchLines[1])}
        removed={Number(patchLines[2])}
        keyPrefix={`${keyBase}-pl`}
      />,
      ...tokenizeThinkingProse(after, `${keyBase}-pb-a`)
    ];
  }

  let earliest: EarliestToken | null = null;

  ICON_SYNTAX_RE.lastIndex = 0;
  const iconM = ICON_SYNTAX_RE.exec(text);
  if (iconM) {
    earliest = {
      index: iconM.index,
      len: (iconM[0] ?? '').length,
      kind: 'icon',
      data: iconM[1] ?? ''
    };
  }

  DIAGRAM_TYPE_RE.lastIndex = 0;
  const dtM = DIAGRAM_TYPE_RE.exec(text);
  if (dtM && (!earliest || dtM.index < earliest.index)) {
    earliest = { index: dtM.index, len: (dtM[0] ?? '').length, kind: 'diagram', data: dtM };
  }

  THEME_VAR_RE.lastIndex = 0;
  const tvM = THEME_VAR_RE.exec(text);
  if (tvM && (!earliest || tvM.index < earliest.index)) {
    earliest = {
      index: tvM.index,
      len: (tvM[0] ?? '').length,
      kind: 'themeVar',
      data: tvM[1] ?? ''
    };
  }

  HEX_RE.lastIndex = 0;
  const hexM = HEX_RE.exec(text);
  if (hexM && (!earliest || hexM.index < earliest.index)) {
    earliest = { index: hexM.index, len: (hexM[0] ?? '').length, kind: 'hex', data: hexM[0] ?? '' };
  }

  for (const word of text.split(/\b/)) {
    const w = word.replace(/[^a-zA-Z0-9-]/g, '');
    if (!w) continue;
    const idx = text.indexOf(word);
    if (idx < 0) continue;
    if (earliest && idx >= earliest.index) continue;
    if (MERMAID_THEME_LABELS.has(w)) {
      earliest = {
        index: idx,
        len: word.length,
        kind: 'enum',
        data: { value: w, enumKind: 'theme' }
      };
      break;
    }
    if (MERMAID_LOOK_LABELS.has(w)) {
      earliest = {
        index: idx,
        len: word.length,
        kind: 'enum',
        data: { value: w, enumKind: 'look' }
      };
      break;
    }
    if (MERMAID_CURVE_LABELS.has(w)) {
      earliest = {
        index: idx,
        len: word.length,
        kind: 'enum',
        data: { value: w, enumKind: 'curve' }
      };
      break;
    }
  }

  if (!earliest) {
    return tokenizeMarkdownInline(text, keyBase);
  }

  const before = text.slice(0, earliest.index);
  const after = text.slice(earliest.index + earliest.len);
  const mid: ReactNode[] = [];

  if (earliest.kind === 'icon') {
    mid.push(
      <IconChip key={`${keyBase}-ic`} faClasses={earliest.data} keyPrefix={`${keyBase}-ic`} />
    );
  } else if (earliest.kind === 'diagram') {
    const match = earliest.data;
    const typeRaw = match[1] ?? '';
    const dir = match[2];
    mid.push(
      <DiagramTypeBadge
        key={`${keyBase}-dt`}
        typeLabel={typeRaw}
        direction={dir}
        keyPrefix={`${keyBase}-dt`}
      />
    );
  } else if (earliest.kind === 'themeVar') {
    mid.push(
      <ThemeVarPill key={`${keyBase}-tv`} name={earliest.data} keyPrefix={`${keyBase}-tv`} />
    );
  } else if (earliest.kind === 'hex') {
    mid.push(<ColorSwatch key={`${keyBase}-hx`} hex={earliest.data} keyPrefix={`${keyBase}-hx`} />);
  } else if (earliest.kind === 'enum') {
    mid.push(
      <StyleEnumPill
        key={`${keyBase}-en`}
        value={earliest.data.value}
        kind={earliest.data.enumKind}
        keyPrefix={`${keyBase}-en`}
      />
    );
  }

  return [
    ...tokenizeThinkingProse(before, `${keyBase}-l`),
    ...mid,
    ...tokenizeThinkingProse(after, `${keyBase}-r`)
  ];
}

function tokenizeMarkdownInline(text: string, keyBase: string): ReactNode[] {
  const fragments: ReactNode[] = [];
  let rest = text;
  let keyIndex = 0;
  while (rest.length > 0) {
    const match = rest.match(INLINE_MARKDOWN);
    if (!match || match.index == null) {
      if (rest) fragments.push(rest);
      break;
    }
    if (match.index > 0) {
      const chunk = rest.slice(0, match.index);
      fragments.push(...splitPlainWithEnums(chunk, `${keyBase}-p${keyIndex}`));
    }
    const token = match[0] ?? '';
    if (token.startsWith('**')) {
      fragments.push(
        <strong key={`${keyBase}-s-${keyIndex}`}>
          {enrichInline(token.slice(2, -2), `${keyBase}-s${keyIndex}`)}
        </strong>
      );
    } else if (token.startsWith('_')) {
      fragments.push(
        <em key={`${keyBase}-e-${keyIndex}`}>
          {enrichInline(token.slice(1, -1), `${keyBase}-e${keyIndex}`)}
        </em>
      );
    } else if (token.startsWith('`')) {
      const inner = token.slice(1, -1);
      const nodeId = /^[A-Za-z][\w-]*$/.test(inner);
      fragments.push(
        <code
          key={`${keyBase}-c-${keyIndex}`}
          className={`insights-inline-code ${nodeId ? 'is-node-id' : ''}`}
          data-testid={nodeId ? 'thinking-node-chip' : undefined}
        >
          {nodeId ? <span className="insights-node-chip-label">{inner}</span> : inner}
        </code>
      );
    }
    keyIndex += 1;
    rest = rest.slice(match.index + token.length);
  }
  return fragments.length ? fragments : text ? [text] : [];
}

function splitPlainWithEnums(chunk: string, keyBase: string): ReactNode[] {
  if (!chunk) return [];
  const out: ReactNode[] = [];
  let cursor = 0;
  const re = /\b([a-zA-Z][\w-]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const w = m[1];
    if (w === undefined) continue;
    let enumKind: string | null = null;
    if (MERMAID_THEME_LABELS.has(w)) enumKind = 'theme';
    else if (MERMAID_LOOK_LABELS.has(w)) enumKind = 'look';
    else if (MERMAID_CURVE_LABELS.has(w)) enumKind = 'curve';
    else if (DIAGRAM_TYPE_LABELS.has(w.toLowerCase())) enumKind = 'diagram';
    if (!enumKind) continue;
    if (m.index > cursor) out.push(chunk.slice(cursor, m.index));
    out.push(
      enumKind === 'diagram' ? (
        <DiagramTypeBadge
          key={`${keyBase}-d-${m.index}`}
          typeLabel={w}
          keyPrefix={`${keyBase}-d`}
        />
      ) : (
        <StyleEnumPill
          key={`${keyBase}-e-${m.index}`}
          value={w}
          kind={enumKind}
          keyPrefix={`${keyBase}-e`}
        />
      )
    );
    cursor = m.index + w.length;
  }
  if (cursor < chunk.length) out.push(chunk.slice(cursor));
  return out.length ? out : [chunk];
}

/**
 * Drop-in replacement for InsightsPane parseInline — adds generative micro-viz.
 */
export function enrichInline(text: string | null | undefined, keyPrefix = 'inl'): ReactNode[] {
  if (typeof text !== 'string' || !text) return [];
  return tokenizeThinkingProse(text, keyPrefix);
}

/**
 * Detect replace/icon lines for step-card wrapper (ordered list enhancement).
 */
export function isVisualStepLine(line: string): boolean {
  return (
    ICON_REPLACE_RE.test(line) ||
    COLOR_RAMP_RE.test(line) ||
    /tertiaryTextColor|primaryColor|::icon\s*\(/i.test(line)
  );
}
