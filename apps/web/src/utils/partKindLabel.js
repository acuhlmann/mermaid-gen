import { getActiveControlsCopy } from '../i18n/activeControlsCopy.js';

const PART_KIND_LABELS = {
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

export function partKindLabel(partKind, copy) {
  const kinds = copy?.selectionKinds ?? getActiveControlsCopy().insights?.selectionKinds;
  if (kinds?.[partKind]) return kinds[partKind];
  return PART_KIND_LABELS[partKind] || kinds?.element || PART_KIND_LABELS.item || 'Element';
}
