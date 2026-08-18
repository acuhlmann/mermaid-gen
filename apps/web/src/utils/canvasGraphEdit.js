import { logicalIdFromDiagramSelection } from './mermaidSourceLocate.js';
import {
  addLinkedFlowchartNode,
  connectFlowchartNodes,
  deleteFlowchartEdge,
  deleteFlowchartNode,
  isFlowchartFamilySource,
  renameFlowchartEdge,
  renameFlowchartNode
} from './mermaidFlowchartEdit.js';
import {
  addLinkedInfographicNode,
  connectInfographicNodes,
  deleteInfographicEdge,
  deleteInfographicNode,
  infographicGraphAllowsLink,
  infographicLabelRef,
  isInfographicGraphSource,
  renameInfographicNode
} from './infographicGraphEdit.js';

function fail(reason) {
  return { ok: false, reason };
}

const FLOWCHART_ADAPTER = {
  contentType: 'mermaid',
  canLink: true,
  addLinked: addLinkedFlowchartNode,
  connect: connectFlowchartNodes,
  deleteNode: deleteFlowchartNode,
  deleteEdge: deleteFlowchartEdge,
  renameNode: renameFlowchartNode,
  renameEdge: renameFlowchartEdge
};

const INFOGRAPHIC_ADAPTER = {
  contentType: 'infographic',
  get canLink() {
    return false;
  },
  addLinked: addLinkedInfographicNode,
  connect: connectInfographicNodes,
  deleteNode: deleteInfographicNode,
  deleteEdge: deleteInfographicEdge,
  renameNode: renameInfographicNode,
  renameEdge: () => fail('not-graph')
};

/**
 * Logical id for Connect targeting: mermaid node id, AntV `data-indexes`, or `~label:`.
 * @param {object | null | undefined} descriptor
 * @returns {string | null}
 */
export function graphEditIdFromDescriptor(descriptor) {
  if (!descriptor) return null;
  if (descriptor.kind === 'edge' || descriptor.kind === 'cluster') return null;
  if (descriptor.kind === 'infographic-item' || descriptor.indexes || descriptor.elementType) {
    if (descriptor.indexes) return String(descriptor.indexes);
    if (descriptor.label) return infographicLabelRef(descriptor.label);
    return null;
  }
  return logicalIdFromDiagramSelection(descriptor);
}

/**
 * @param {string} contentType
 * @param {string} source
 */
export function graphEditAdapterFor(contentType, source) {
  if (contentType === 'mermaid' && isFlowchartFamilySource(source)) {
    return FLOWCHART_ADAPTER;
  }
  if (contentType === 'infographic' && isInfographicGraphSource(source)) {
    return {
      ...INFOGRAPHIC_ADAPTER,
      canLink: infographicGraphAllowsLink(source)
    };
  }
  return null;
}
