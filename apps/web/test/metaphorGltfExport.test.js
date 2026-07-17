// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  METAPHOR_GLTF_ROOT_NAME,
  exportMetaphorGltfBlob,
  isMetaphorGltfExporterReady,
  registerMetaphorGltfExporter,
  serializeMetaphorRootToGltf,
  unregisterMetaphorGltfExporter
} from '../src/utils/metaphorGltfExport.js';

describe('metaphorGltfExport', () => {
  afterEach(() => {
    registerMetaphorGltfExporter(null);
  });

  it('tracks exporter readiness', () => {
    expect(isMetaphorGltfExporterReady()).toBe(false);
    const exporter = async () => new Blob();
    registerMetaphorGltfExporter(exporter);
    expect(isMetaphorGltfExporterReady()).toBe(true);
    unregisterMetaphorGltfExporter(exporter);
    expect(isMetaphorGltfExporterReady()).toBe(false);
  });

  it('rejects export when no canvas bridge is registered', async () => {
    await expect(exportMetaphorGltfBlob()).rejects.toThrow(/not ready/i);
  });

  it('serializes a tagged content root to a GLB blob with archislop extras', async () => {
    const root = new THREE.Group();
    root.name = METAPHOR_GLTF_ROOT_NAME;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: 0x4488ff })
    );
    mesh.name = 'auth-service';
    mesh.userData = {
      archislop: { id: 'auth-service', label: 'Auth Service', metaphor: 'city' }
    };
    root.add(mesh);

    const blob = await serializeMetaphorRootToGltf(root, {
      diagramSource: '{"metaphor":"city","items":[]}',
      metaphor: 'city'
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('model/gltf-binary');
    expect(blob.size).toBeGreaterThan(100);
    expect(root.userData.archislop.contentType).toBe('metaphor3d');
    expect(root.userData.archislop.diagramSource).toContain('"metaphor":"city"');
  });
});
