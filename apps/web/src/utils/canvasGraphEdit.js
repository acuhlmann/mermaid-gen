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
import {
  addLinkedMindmapNode,
  connectMindmapNodes,
  deleteMindmapEdge,
  deleteMindmapNode,
  isMindmapFamilySource,
  mindmapLabelRef,
  mindmapNodeRef,
  renameMindmapEdge,
  renameMindmapNode
} from './mermaidMindmapEdit.js';
import {
  addLinkedStateNode,
  connectStateNodes,
  deleteStateEdge,
  deleteStateNode,
  isStateFamilySource,
  renameStateEdge,
  renameStateNode
} from './mermaidStateEdit.js';
import {
  addLinkedSequenceNode,
  connectSequenceNodes,
  deleteSequenceEdge,
  deleteSequenceNode,
  isSequenceFamilySource,
  renameSequenceEdge,
  renameSequenceNode
} from './mermaidSequenceEdit.js';

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

const MINDMAP_ADAPTER = {
  contentType: 'mermaid',
  canLink: false,
  addLinked: addLinkedMindmapNode,
  connect: connectMindmapNodes,
  deleteNode: deleteMindmapNode,
  deleteEdge: deleteMindmapEdge,
  renameNode: renameMindmapNode,
  renameEdge: renameMindmapEdge
};

const STATE_ADAPTER = {
  contentType: 'mermaid',
  canLink: true,
  addLinked: addLinkedStateNode,
  connect: connectStateNodes,
  deleteNode: deleteStateNode,
  deleteEdge: deleteStateEdge,
  renameNode: renameStateNode,
  renameEdge: renameStateEdge
};

const SEQUENCE_ADAPTER = {
  contentType: 'mermaid',
  canLink: true,
  addLinked: addLinkedSequenceNode,
  connect: connectSequenceNodes,
  deleteNode: deleteSequenceNode,
  deleteEdge: deleteSequenceEdge,
  renameNode: renameSequenceNode,
  renameEdge: renameSequenceEdge
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
  const logical = logicalIdFromDiagramSelection(descriptor);
  const nodeIndexMatch = logical?.match(/^node_(\d+)$/i);
  if (nodeIndexMatch) return mindmapNodeRef(Number.parseInt(nodeIndexMatch[1], 10));
  if (logical) return logical;
  if (descriptor.label) return mindmapLabelRef(descriptor.label);
  if (descriptor.partName) return mindmapLabelRef(descriptor.partName);
  return logical;
}

/**
 * @param {string} contentType
 * @param {string} source
 */
export function graphEditAdapterFor(contentType, source) {
  if (contentType === 'mermaid' && isFlowchartFamilySource(source)) {
    return FLOWCHART_ADAPTER;
  }
  if (contentType === 'mermaid' && isMindmapFamilySource(source)) {
    return MINDMAP_ADAPTER;
  }
  if (contentType === 'mermaid' && isStateFamilySource(source)) {
    return STATE_ADAPTER;
  }
  if (contentType === 'mermaid' && isSequenceFamilySource(source)) {
    return SEQUENCE_ADAPTER;
  }
  if (contentType === 'infographic' && isInfographicGraphSource(source)) {
    return {
      ...INFOGRAPHIC_ADAPTER,
      canLink: infographicGraphAllowsLink(source)
    };
  }
  return null;
}
