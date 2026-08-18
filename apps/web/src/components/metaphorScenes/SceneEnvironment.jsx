/**
 * Image-based lighting for metaphor scenes, generated from the theme's own sky.
 *
 * Why this exists at all: until now `scene.environment` was set only on noir and
 * arcade, via drei's `<Environment preset>`. Two problems with that. The preset
 * fetches an `.hdr` from a CDN at runtime — a network dependency inside a
 * renderer that otherwise has none, and one that simply fails on a locked-down
 * network, leaving those two themes with no IBL either. And whiteboard and
 * blueprint, the two default-ish themes, never had any: with no environment map
 * a `meshStandardMaterial` has nothing to reflect, so `metalness` does almost
 * nothing, `roughness` does almost nothing, and every surface in every scene
 * resolves to flat shaded plastic no matter what its material says.
 *
 * What replaces it is the cheapest honest answer: a three-stop vertical gradient
 * (zenith → horizon → ground bounce) taken from the colours the theme ALREADY
 * paints its sky with, pushed through `PMREMGenerator`. That makes the reflected
 * world agree with the visible one for free — a brass gear on the blueprint
 * theme picks up navy, the same gear on arcade picks up magenta — which is
 * exactly the agreement a fetched HDR cannot give you.
 *
 * It is a 16×64 source texture. PMREM's roughness convolution is what the
 * material actually samples, so a higher-resolution gradient buys nothing.
 */
import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { buildGradientEquirect } from './sceneUtils.js';

/**
 * Installs the theme's sky as `scene.environment`.
 *
 * Renders nothing. Deliberately does NOT touch `scene.background` — the scenes
 * paint their own gradient sphere (and the space kinds their own star field),
 * and a PMREM'd background would fight both.
 *
 * @param {object} props
 * @param {Record<string, unknown>} props.theme
 */
export function SceneEnvironment({ theme }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  const top = theme?.skyTopColor ?? theme?.background ?? '#1b2436';
  const horizon = theme?.skyHorizonColor ?? theme?.background ?? '#1b2436';
  const ground = theme?.groundColor ?? horizon;
  const intensity = theme?.envIntensity ?? 0.55;

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const source = buildGradientEquirect(top, horizon, ground);
    let target = null;
    try {
      target = pmrem.fromEquirectangular(source);
      scene.environment = target.texture;
      scene.environmentIntensity = intensity;
    } catch {
      // A PMREM failure must never blank the scene; the direct lights still
      // light it, exactly as they did before this component existed.
      scene.environment = null;
    }
    source.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      target?.dispose();
    };
  }, [gl, scene, top, horizon, ground, intensity]);

  return null;
}
