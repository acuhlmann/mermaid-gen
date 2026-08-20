import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  measureItemPlacement,
  measureItemShape
} from '../src/components/metaphorScenes/itemBounds.js';
import { FRAME_IGNORE } from '../src/components/metaphorScenes/sceneFraming.js';

function boxMesh({ name, size = [2, 4, 2], position = [0, 2, 0], ignore = false } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  mesh.name = name;
  mesh.position.set(...position);
  if (ignore) mesh.userData[FRAME_IGNORE] = true;
  return mesh;
}

describe('measureItemShape', () => {
  it('returns world bounds for visible geometry', () => {
    const group = new THREE.Group();
    group.add(boxMesh({ name: 'tower', size: [2, 6, 2], position: [0, 3, 0] }));
    group.updateMatrixWorld(true);

    const box = measureItemShape(group);
    expect(box).not.toBeNull();
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(6, 5);
  });

  it('prunes FRAME_IGNORE annotation subtrees', () => {
    const group = new THREE.Group();
    group.add(boxMesh({ name: 'tower', size: [2, 4, 2], position: [0, 2, 0] }));
    group.add(
      boxMesh({
        name: 'label-plate',
        size: [20, 1, 20],
        position: [0, 10, 0],
        ignore: true
      })
    );
    group.updateMatrixWorld(true);

    const box = measureItemShape(group);
    expect(box).not.toBeNull();
    expect(box.max.x - box.min.x).toBeCloseTo(2, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(4, 5);
  });

  it('returns null when every mesh is ignored or invisible', () => {
    const group = new THREE.Group();
    const ignored = boxMesh({ ignore: true });
    ignored.visible = false;
    group.add(ignored);
    group.updateMatrixWorld(true);
    expect(measureItemShape(group)).toBeNull();
  });
});

describe('measureItemPlacement', () => {
  it('resolves offsets and radii relative to the item group origin', () => {
    const scene = new THREE.Scene();
    const item = new THREE.Group();
    item.name = 'gateway';
    item.position.set(5, 0, -3);
    item.add(boxMesh({ size: [4, 8, 4], position: [0, 4, 0] }));
    scene.add(item);
    scene.updateMatrixWorld(true);

    const placement = measureItemPlacement(scene, 'gateway');
    expect(placement?.object).toBe(item);
    expect(placement.baseOffset.y).toBeCloseTo(0, 5);
    expect(placement.centerOffset.y).toBeCloseTo(4, 5);
    expect(placement.groundRadius).toBeGreaterThan(1);
    expect(placement.boundRadius).toBeGreaterThan(placement.groundRadius);
  });

  it('returns null for missing scene, id, or object', () => {
    const scene = new THREE.Scene();
    expect(measureItemPlacement(null, 'x')).toBeNull();
    expect(measureItemPlacement(scene, null)).toBeNull();
    expect(measureItemPlacement(scene, 'missing')).toBeNull();
  });
});
