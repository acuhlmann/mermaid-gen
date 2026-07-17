/**
 * Live-canvas glTF (GLB) export for metaphor3d.
 *
 * The Metaphor JSON DSL stays the canonical authoring format. This module
 * registers a baker from inside the primary R3F canvas and serializes the
 * tagged content root via Three's GLTFExporter (glTF 2.0.1 binary). Item ids
 * and labels land in node extras; the full DSL is attached as root extras so
 * consumers can recover semantics without claiming OpenUSD compliance.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export const METAPHOR_GLTF_ROOT_NAME = 'archislop-metaphor-root';

/** @typedef {() => Promise<Blob>} MetaphorGltfExporter */

/** @type {MetaphorGltfExporter | null} */
let activeExporter = null;

/**
 * @param {MetaphorGltfExporter | null} exporter
 */
export function registerMetaphorGltfExporter(exporter) {
  activeExporter = exporter;
}

/**
 * @param {MetaphorGltfExporter} exporter
 */
export function unregisterMetaphorGltfExporter(exporter) {
  if (activeExporter === exporter) {
    activeExporter = null;
  }
}

/**
 * @returns {boolean}
 */
export function isMetaphorGltfExporterReady() {
  return typeof activeExporter === 'function';
}

/**
 * Bake the live metaphor content root to a .glb blob.
 * @returns {Promise<Blob>}
 */
export async function exportMetaphorGltfBlob() {
  if (!activeExporter) {
    throw new Error(
      '3D scene is not ready to export — wait for the canvas to load, then try again.'
    );
  }
  return activeExporter();
}

/**
 * Serialize a Three.js Object3D subtree to a binary glTF blob.
 * @param {import('three').Object3D} root
 * @param {{ diagramSource?: string, metaphor?: string }} [meta]
 * @returns {Promise<Blob>}
 */
export async function serializeMetaphorRootToGltf(root, meta = {}) {
  if (!root) {
    throw new Error('Metaphor export root is missing');
  }
  root.updateMatrixWorld(true);

  const extras = {
    archislop: {
      contentType: 'metaphor3d',
      format: 'gltf-baked',
      ...(meta.metaphor ? { metaphor: meta.metaphor } : {}),
      ...(typeof meta.diagramSource === 'string' && meta.diagramSource.trim()
        ? { diagramSource: meta.diagramSource.trim() }
        : {})
    }
  };
  const previousExtras = root.userData?.archislop ? { ...root.userData } : { ...root.userData };
  root.userData = { ...previousExtras, ...extras };

  const exporter = new GLTFExporter();
  const buffer = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: true,
    embedImages: true
  });
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error('GLTFExporter did not return a binary buffer');
  }
  return new Blob([buffer], { type: 'model/gltf-binary' });
}

/**
 * R3F bridge: registers a GLB baker for the named content root while mounted.
 * Mount only on the primary metaphor canvas (not insights embeds).
 *
 * @param {{ diagramSource?: string, metaphor?: string, enabled?: boolean }} props
 */
export function MetaphorGltfExportBridge({ diagramSource = '', metaphor = '', enabled = true }) {
  const { scene } = useThree();

  useEffect(() => {
    if (!enabled) return undefined;

    const exporter = async () => {
      const root = scene.getObjectByName(METAPHOR_GLTF_ROOT_NAME);
      if (!root) {
        throw new Error('Metaphor export root not found in the live scene');
      }
      return serializeMetaphorRootToGltf(root, { diagramSource, metaphor });
    };

    registerMetaphorGltfExporter(exporter);
    return () => unregisterMetaphorGltfExporter(exporter);
  }, [scene, diagramSource, metaphor, enabled]);

  return null;
}
