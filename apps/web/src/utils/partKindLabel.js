const PART_KIND_LABELS = {
  label: 'Label',
  node: 'Node',
  participant: 'Participant',
  cluster: 'Subgraph',
  edge: 'Edge',
  title: 'Title',
  description: 'Description',
  value: 'Value',
  icon: 'Icon',
  item: 'Item'
};

export function partKindLabel(partKind) {
  return PART_KIND_LABELS[partKind] || 'Element';
}
