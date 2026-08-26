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
import {
  addLinkedTreeNode,
  connectTreeNodes,
  deleteTreeEdge,
  deleteTreeNode,
  isTreeFamilySource,
  renameTreeEdge,
  renameTreeNode
} from './metaphorTreeEdit.js';
import {
  addLinkedCityNode,
  connectCityNodes,
  deleteCityEdge,
  deleteCityNode,
  isCityFamilySource,
  renameCityEdge as renameCityGraphEdge,
  renameCityNode
} from './metaphorCityEdit.js';
import {
  addLinkedGardenNode,
  connectGardenNodes,
  deleteGardenEdge,
  deleteGardenNode,
  isGardenFamilySource,
  renameGardenEdge,
  renameGardenNode
} from './metaphorGardenEdit.js';
import {
  addLinkedChartRow,
  connectChartRows,
  deleteChartEdge as deleteChartGraphEdge,
  deleteChartRow,
  isChartValuesFamilySource,
  renameChartEdge as renameChartGraphEdge,
  renameChartRow
} from './chartGraphEdit.js';
import { flatGraphEditAdapter, metaphorFlatGraphEditForSource } from './metaphorFlatKindEdit.js';
import {
  addLinkedCompositeNode,
  compositeGraphAllowsLink,
  connectCompositeNodes,
  deleteCompositeEdge,
  deleteCompositeNode,
  isCompositeFamilySource,
  renameCompositeEdge,
  renameCompositeNode
} from './metaphorCompositeEdit.js';

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

const METAPHOR_TREE_ADAPTER = {
  contentType: 'metaphor3d',
  canLink: false,
  addLinked: addLinkedTreeNode,
  connect: connectTreeNodes,
  deleteNode: deleteTreeNode,
  deleteEdge: deleteTreeEdge,
  renameNode: renameTreeNode,
  renameEdge: renameTreeEdge
};

const METAPHOR_CITY_ADAPTER = {
  contentType: 'metaphor3d',
  canLink: true,
  addLinked: addLinkedCityNode,
  connect: connectCityNodes,
  deleteNode: deleteCityNode,
  deleteEdge: deleteCityEdge,
  renameNode: renameCityNode,
  renameEdge: renameCityGraphEdge
};

const METAPHOR_GARDEN_ADAPTER = {
  contentType: 'metaphor3d',
  canLink: false,
  addLinked: addLinkedGardenNode,
  connect: connectGardenNodes,
  deleteNode: deleteGardenNode,
  deleteEdge: deleteGardenEdge,
  renameNode: renameGardenNode,
  renameEdge: renameGardenEdge
};

const METAPHOR_COMPOSITE_ADAPTER = {
  contentType: 'metaphor3d',
  canLink: true,
  addLinked: addLinkedCompositeNode,
  connect: connectCompositeNodes,
  deleteNode: deleteCompositeNode,
  deleteEdge: deleteCompositeEdge,
  renameNode: renameCompositeNode,
  renameEdge: renameCompositeEdge
};

const CHART_VALUES_ADAPTER = {
  contentType: 'chart',
  canLink: false,
  addLinked: addLinkedChartRow,
  connect: connectChartRows,
  deleteNode: deleteChartRow,
  deleteEdge: deleteChartGraphEdge,
  renameNode: renameChartRow,
  renameEdge: renameChartGraphEdge
};

/**
 * Logical id for Connect targeting: mermaid node id, AntV `data-indexes`, or `~label:`.
 * @param {object | null | undefined} descriptor
 * @returns {string | null}
 */
export function graphEditIdFromDescriptor(descriptor) {
  if (!descriptor) return null;
  if (descriptor.kind === 'edge' || descriptor.kind === 'cluster') return null;
  if (descriptor.kind === 'chart-mark') {
    if (descriptor.indexes != null && String(descriptor.indexes) !== '') {
      return String(descriptor.indexes);
    }
    return null;
  }
  if (
    descriptor.kind === 'metaphor-item' ||
    descriptor.kind === 'infographic-item' ||
    descriptor.indexes ||
    descriptor.elementType
  ) {
    if (descriptor.dataId) return String(descriptor.dataId);
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
  if (contentType === 'metaphor3d' && isTreeFamilySource(source)) {
    return METAPHOR_TREE_ADAPTER;
  }
  if (contentType === 'metaphor3d' && isCityFamilySource(source)) {
    return METAPHOR_CITY_ADAPTER;
  }
  if (contentType === 'metaphor3d' && isGardenFamilySource(source)) {
    return METAPHOR_GARDEN_ADAPTER;
  }
  if (contentType === 'metaphor3d' && isCompositeFamilySource(source)) {
    return {
      ...METAPHOR_COMPOSITE_ADAPTER,
      canLink: compositeGraphAllowsLink(source)
    };
  }
  if (contentType === 'metaphor3d') {
    const flatEdit = metaphorFlatGraphEditForSource(source);
    if (flatEdit) return flatGraphEditAdapter(flatEdit);
  }
  if (contentType === 'chart' && isChartValuesFamilySource(source)) {
    return CHART_VALUES_ADAPTER;
  }
  return null;
}
