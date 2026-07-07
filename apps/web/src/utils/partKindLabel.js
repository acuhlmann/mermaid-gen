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

export function partKindLabel(partKind) {
  return PART_KIND_LABELS[partKind] || 'Element';
}
