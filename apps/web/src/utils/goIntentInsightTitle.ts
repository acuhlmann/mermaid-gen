import { formatLocale } from '../i18n/formatLocale.js';
import { getActiveControlsCopy } from '../i18n/activeControlsCopy.js';
import { partKindLabel } from './partKindLabel.js';

const GO_TITLE_PROMPT_MAX = 72;

type GoIntentCopy = {
  go?: string;
  goQuoted?: string;
  goDiagram?: string;
  delegateGo?: string;
  edge?: string;
  title?: string;
  description?: string;
  itemDesc?: string;
  itemValue?: string;
  itemIcon?: string;
  item?: string;
  subgraph?: string;
  node?: string;
};

type SelectionLike = {
  partKind?: string;
  partName?: string;
  kind?: string;
  selectionKind?: string;
  edgeFrom?: string;
  edgeTo?: string;
  label?: string;
  clickedLabel?: string;
  id?: string;
  elementType?: string;
};

type GoCopyInput = {
  goIntent?: GoIntentCopy;
  selectionKinds?: Record<string, string>;
};

function goCopy(copy?: GoCopyInput): GoIntentCopy {
  return copy?.goIntent ?? getActiveControlsCopy().insights?.goIntent ?? {};
}

function selectionKindsCopy() {
  return getActiveControlsCopy().insights;
}

/** Focus fragment without the leading verb (e.g. `node "API"`). */
export function selectionFocusFragment(
  selectionLike: SelectionLike | null | undefined,
  copy?: GoCopyInput
): string {
  const c = goCopy(copy);
  const kinds = selectionKindsCopy();
  if (!selectionLike) return '';
  if (selectionLike.partKind && selectionLike.partName) {
    return `${partKindLabel(selectionLike.partKind, kinds)} · ${selectionLike.partName}`;
  }
  const edgeLike =
    selectionLike.kind === 'edge' ||
    (selectionLike.selectionKind === 'edge' && selectionLike.edgeFrom && selectionLike.edgeTo);
  if (edgeLike) {
    return `${c.edge ?? 'edge'} ${selectionLike.edgeFrom} → ${selectionLike.edgeTo}`;
  }
  const infographicLike =
    selectionLike.kind === 'infographic-item' || selectionLike.selectionKind === 'infographic-item';
  if (infographicLike) {
    const labelText = selectionLike.label || selectionLike.clickedLabel || selectionLike.id;
    const elementType = selectionLike.elementType || '';
    const noun =
      elementType === 'title'
        ? (c.title ?? 'title')
        : elementType === 'desc'
          ? (c.description ?? 'description')
          : elementType === 'item-desc'
            ? (c.itemDesc ?? 'item desc')
            : elementType === 'item-value'
              ? (c.itemValue ?? 'item value')
              : elementType === 'item-icon' || elementType === 'item-icon-group'
                ? (c.itemIcon ?? 'item icon')
                : (c.item ?? 'item');
    return `${noun} “${labelText}”`;
  }
  const metaphorLike =
    selectionLike.kind === 'metaphor-item' || selectionLike.selectionKind === 'metaphor-item';
  if (metaphorLike) {
    const labelText = selectionLike.label || selectionLike.id;
    return `${c.item ?? 'item'} “${labelText}”`;
  }
  const clusterLike = selectionLike.kind === 'cluster' || selectionLike.selectionKind === 'cluster';
  if (clusterLike) {
    return `${c.subgraph ?? 'subgraph'} “${selectionLike.label || selectionLike.id}”`;
  }
  return `${c.node ?? 'node'} “${selectionLike.label || selectionLike.id}”`;
}

function promptExcerpt(promptText: string | null | undefined): string {
  const trimmed = (promptText ?? '').trim();
  if (!trimmed) return '';
  return trimmed.length > GO_TITLE_PROMPT_MAX
    ? `${trimmed.slice(0, GO_TITLE_PROMPT_MAX).trimEnd()}…`
    : trimmed;
}

type GoIntentOptions = {
  delegateName?: string;
};

/** Thinking-panel title for Go / intent runs. */
export function goIntentInsightTitle(
  promptText: string | null | undefined,
  selectionLike: SelectionLike | null | undefined,
  copy?: GoCopyInput | null,
  options: GoIntentOptions = {}
): string {
  const c = goCopy(copy ?? undefined);
  const { delegateName } = options;
  const excerpt = promptExcerpt(promptText);
  const quoted = excerpt
    ? formatLocale(c.goQuoted ?? "Go '{excerpt}'", { excerpt })
    : (c.go ?? 'Go');
  if (!excerpt) {
    const focus = selectionFocusFragment(selectionLike, copy ?? undefined);
    const base = focus ? `${c.go ?? 'Go'} — ${focus}` : (c.goDiagram ?? 'Go — diagram');
    return delegateName
      ? formatLocale(c.delegateGo ?? '{name} · {title}', { name: delegateName, title: base })
      : base;
  }
  const focus = selectionFocusFragment(selectionLike, copy ?? undefined);
  const core = focus ? `${quoted} · ${focus}` : quoted;
  return delegateName
    ? formatLocale(c.delegateGo ?? '{name} · {title}', { name: delegateName, title: core })
    : core;
}
