/**
 * Bridges Metaphor3D tap-selection to the canvas graph-edit stack (radial menu,
 * toolbar anchor, /user-edit). Three.js owns hit-testing; this module owns the
 * descriptor shape the shared hook already understands.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { measureItemPlacement } from './itemBounds.js';
import { metaphorItemDescriptor } from '../../utils/metaphorGraphEdit.js';

const scratchWorld = new THREE.Vector3();

/**
 * Keeps the external-store selection, parent selectedNode, and screen anchor in
 * sync without re-rendering the scene graph.
 *
 * @param {{
 *   selectionStore: ReturnType<import('../metaphorSelection.js').createMetaphorSelectionStore>;
 *   selectedNode?: object | null;
 *   onSelectedNodeChange?: (value: object | null) => void;
 *   onNodeToolbarAnchor?: (value: object | null) => void;
 *   containerRef: import('react').RefObject<HTMLElement | null>;
 *   contentKey: string;
 *   defaultMetaphor?: string | null;
 * }} props
 */
export function MetaphorGraphEditBridge({
  selectionStore,
  selectedNode = null,
  onSelectedNodeChange,
  onNodeToolbarAnchor,
  containerRef,
  contentKey,
  defaultMetaphor = null
}) {
  const selected = useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.get,
    selectionStore.get
  );
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const lastAnchorKeyRef = useRef('');
  const lastDescriptorIdRef = useRef(null);

  useEffect(() => {
    if (selectedNode?.kind !== 'metaphor-item' || !selectedNode?.dataId) {
      if (!selectedNode && selectionStore.get()) {
        selectionStore.clear();
      }
      return;
    }
    const current = selectionStore.get();
    if (current?.item?.id === selectedNode.dataId) return;
    selectionStore.set({
      item: {
        id: selectedNode.dataId,
        label: selectedNode.label ?? selectedNode.partName ?? selectedNode.dataId
      },
      metaphor: selectedNode.metaphor ?? defaultMetaphor ?? 'tree',
      layerLabel: null
    });
  }, [defaultMetaphor, selectedNode, selectionStore]);

  useEffect(() => {
    if (!onSelectedNodeChange) return;
    const descriptor = selected
      ? metaphorItemDescriptor(selected.item, selected.metaphor ?? defaultMetaphor)
      : null;
    const nextId = descriptor?.dataId ?? null;
    if (nextId === lastDescriptorIdRef.current && (descriptor || !selected)) {
      return;
    }
    lastDescriptorIdRef.current = nextId;
    onSelectedNodeChange(descriptor);
  }, [defaultMetaphor, onSelectedNodeChange, selected]);

  useFrame(() => {
    if (!onNodeToolbarAnchor) return;
    const itemId = selected?.item?.id;
    if (!itemId) {
      if (lastAnchorKeyRef.current !== '') {
        lastAnchorKeyRef.current = '';
        onNodeToolbarAnchor(null);
      }
      return;
    }

    const placement = measureItemPlacement(scene, itemId);
    if (!placement) {
      if (lastAnchorKeyRef.current !== '') {
        lastAnchorKeyRef.current = '';
        onNodeToolbarAnchor(null);
      }
      return;
    }

    placement.object.getWorldPosition(scratchWorld);
    scratchWorld.add(placement.baseOffset);

    const ndc = scratchWorld.clone().project(camera);
    const rect = containerRef.current?.getBoundingClientRect();
    const offsetLeft = rect?.left ?? 0;
    const offsetTop = rect?.top ?? 0;
    const width = rect?.width ?? size.width;
    const height = rect?.height ?? size.height;
    const px = offsetLeft + (ndc.x * 0.5 + 0.5) * width;
    const py = offsetTop + (-ndc.y * 0.5 + 0.5) * height;

    const radius = Math.max(12, placement.groundRadius * 8);
    const left = px;
    const top = py + radius + 10;
    const nodeTop = py - radius;
    const nodeBottom = py + radius;
    const nodeLeft = px - radius;
    const nodeRight = px + radius;
    const centerY = py;
    const anchorKey = `${itemId}:${contentKey}:${Math.round(left)}:${Math.round(top)}`;
    if (anchorKey === lastAnchorKeyRef.current) return;
    lastAnchorKeyRef.current = anchorKey;
    onNodeToolbarAnchor({
      nodeId: itemId,
      left,
      top,
      nodeTop,
      nodeBottom,
      nodeLeft,
      nodeRight,
      centerY
    });
  });

  return null;
}
