import { partKindLabel } from './partKindLabel.js';

const PART_KIND_EXPLANATIONS = {
  node: 'A node is a discrete box or shape in the diagram. It usually stands for a component, step, actor, or state that the architecture cares about.',
  label: 'A label is the text attached to a node, edge, or element. Editing it sharpens what that piece is supposed to mean to the reader.',
  timeline: 'A timeline node marks a moment or milestone along a chronological track. It anchors when something happens relative to neighbouring events.',
  participant: 'A participant is an actor or system that takes part in the conversation. Lifelines below it show what messages it sends and receives.',
  cluster: 'A subgraph is a container that visually groups related nodes together. It signals “these things belong to the same boundary or layer”.',
  edge: 'An edge is the line or arrow that links two nodes. It encodes a relationship — a call, a flow, a dependency, or an ordering.',
  title: 'The title sets the diagram’s headline topic. Reword it whenever the focus of the picture shifts.',
  description: 'A description block adds narrative context — what the diagram is about and why the reader should care.',
  value: 'A value is a numeric or short text data point attached to an element. It’s how the diagram carries quantitative meaning, not just structure.',
  icon: 'An icon decorates an element with a glyph that hints at its category. It helps the eye scan without reading every label.',
  item: 'An item is one entry inside a list or grouping element. Treat it as a single unit you can rename, reorder, or remove.'
};

const GENERIC_EXPLANATION =
  'This element is a piece of the diagram. Renaming or restructuring it nudges what the picture is trying to communicate.';

export function partKindExplanation(partKind) {
  if (!partKind) return GENERIC_EXPLANATION;
  return PART_KIND_EXPLANATIONS[partKind] || GENERIC_EXPLANATION;
}

export function describeDescriptor(descriptor) {
  if (!descriptor) {
    return { heading: 'Element', body: GENERIC_EXPLANATION };
  }
  const heading = partKindLabel(descriptor.partKind);
  const body = partKindExplanation(descriptor.partKind);
  return { heading, body };
}
