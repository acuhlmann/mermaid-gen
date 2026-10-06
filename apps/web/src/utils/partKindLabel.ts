import { getActiveControlsCopy } from '../i18n/activeControlsCopy.js';

const PART_KIND_LABELS: Record<string, string> = {
  label: 'Label',
  node: 'Node',
  timeline: 'Timeline',
  participant: 'Participant',
  cluster: 'Subgraph',
  edge: 'Edge',
  title: 'Title',
  description: 'Description',
  value: 'Value',
  icon: 'Icon',
  item: 'Item',
  mark: 'Mark',
  axis: 'Axis',
  legend: 'Legend'
};

type SelectionKindsCopy = {
  selectionKinds?: Record<string, string>;
};

export function partKindLabel(partKind: string, copy?: SelectionKindsCopy): string {
  const kinds = copy?.selectionKinds ?? getActiveControlsCopy().insights?.selectionKinds;
  if (kinds?.[partKind]) return kinds[partKind] ?? PART_KIND_LABELS[partKind] ?? 'Element';
  return PART_KIND_LABELS[partKind] ?? kinds?.element ?? PART_KIND_LABELS.item ?? 'Element';
}
