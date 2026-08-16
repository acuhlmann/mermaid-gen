/**
 * Installs the scene's depth haze and keeps its band locked to the live camera
 * distance, so the haze stays a depth cue while the viewer orbits and dollies
 * rather than swallowing the subject when they pull back.
 *
 * The band maths (and why it is expressed in content radii, not world units)
 * lives in metaphorAtmosphere.js.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { hazeBand } from './metaphorAtmosphere.js';

const centerVec = new THREE.Vector3();

export function AdaptiveFog({ color, haze, fitRef }) {
  const camera = useThree((state) => state.camera);
  const fogRef = useRef(null);

  useFrame(() => {
    const fog = fogRef.current;
    if (!fog) return;
    const radius = fitRef?.ready ? fitRef.radius : 12;
    const center = fitRef?.ready ? fitRef.center : [0, 0, 0];
    centerVec.set(center[0], center[1], center[2]);
    const band = hazeBand(camera.position.distanceTo(centerVec), radius, haze);
    fog.near = band.near;
    fog.far = band.far;
  });

  // Declarative attach — R3F owns installing/removing it from the scene, and the
  // band is then mutated in place each frame rather than by swapping fog objects.
  return <fog ref={fogRef} attach="fog" args={[color, 1, 2]} />;
}
