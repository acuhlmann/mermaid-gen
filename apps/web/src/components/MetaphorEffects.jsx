/**
 * Post-processing for the metaphor3d canvas, built on three.js' bundled
 * `examples/jsm/postprocessing` passes — no extra dependency.
 *
 * Pipeline: RenderPass → GTAOPass (ambient occlusion) → UnrealBloomPass (HDR
 * glow on emissive windows/stars) → OutputPass (ACES tone-map + sRGB, applied
 * once) → vignette (display-space). The composer renders into a half-float,
 * multisampled target so emissive values above 1.0 survive into the bloom and
 * edges stay antialiased.
 *
 * AO sits directly after the render and before bloom on purpose. It is a
 * *lighting* term — the contact darkening where a tower meets its plinth, where
 * a keel meets the sea, in the gap between two gears — so it belongs in scene
 * linear space where the tone-map can still roll it off. Put it after
 * OutputPass and it becomes a grey wash painted over finished pixels, and the
 * bloom it should be occluding blooms through it.
 *
 * Mounted only when not streaming (see MetaphorRenderer); while mounted it owns
 * the render loop via a priority useFrame. If the composer fails to build for
 * any reason it falls back to a plain render so the scene is never blank.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Multiply-darken vignette (three's stock VignetteShader mixes toward grey, which
// would lighten the corners of dark themes — this always darkens them).
const VignetteEdgeShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.4 },
    offset: { value: 1.1 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = vUv - 0.5;
      float dist = length(uv) * offset;
      float vig = smoothstep(0.85, 0.25, dist);
      float factor = mix(1.0, vig, clamp(darkness, 0.0, 1.0));
      gl_FragColor = vec4(texel.rgb * factor, texel.a);
    }
  `
};

/** Push the live theme params into the (mutable, imperative) three.js passes. */
function syncPostfxParams(bloom, vignette, ao, postfx) {
  if (bloom) {
    bloom.strength = postfx.bloomStrength;
    bloom.radius = postfx.bloomRadius;
    bloom.threshold = postfx.bloomThreshold;
  }
  if (vignette) {
    vignette.uniforms.darkness.value = postfx.vignette;
  }
  if (ao) {
    ao.enabled = postfx.ao !== false && (postfx.aoIntensity ?? 0) > 0;
    ao.blendIntensity = postfx.aoIntensity ?? 0;
    ao.updateGtaoMaterial({
      radius: postfx.aoRadius ?? 0.5,
      screenSpaceRadius: postfx.aoScreenSpace !== false,
      samples: postfx.aoSamples ?? 16,
      distanceExponent: 1,
      // `thickness` is how far BEHIND a sample still counts as an occluder, and
      // the stock 1.0 is what draws a dark halo around every silhouette here:
      // the gradient sky is a back-faced sphere, so it contributes nothing to
      // the depth prepass and the whole background sits at the far plane —
      // which a generous thickness reads as "an occluder just behind the edge".
      // Measured on the machine plate, 1.0 ringed the whole rim in black.
      // Keeping it under the radius confines occlusion to real contact.
      thickness: postfx.aoThickness ?? 0.3,
      scale: 1
    });
  }
}

export function MetaphorEffects({ postfx }) {
  const { gl, scene, camera, size } = useThree();

  // Build the composer + keep handles to the tunable passes. Rebuilds only when
  // the renderer/scene/camera identity changes; params are synced live below.
  const fx = useMemo(() => {
    try {
      const target = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(size.width)),
        Math.max(1, Math.floor(size.height)),
        { type: THREE.HalfFloatType, samples: postfx.samples ?? 4 }
      );
      const composer = new EffectComposer(gl, target);
      composer.addPass(new RenderPass(scene, camera));

      // AO is built even when the theme has it off, so toggling a theme flips a
      // boolean instead of rebuilding the whole composer mid-session.
      let ao = null;
      try {
        ao = new GTAOPass(scene, camera, size.width, size.height);
        ao.output = GTAOPass.OUTPUT.Default;
        composer.addPass(ao);
      } catch {
        ao = null;
      }

      const bloom = new UnrealBloomPass(
        new THREE.Vector2(size.width, size.height),
        postfx.bloomStrength,
        postfx.bloomRadius,
        postfx.bloomThreshold
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());

      const vignette = new ShaderPass(VignetteEdgeShader);
      vignette.uniforms.darkness.value = postfx.vignette;
      composer.addPass(vignette);

      return { composer, bloom, vignette, ao };
    } catch {
      return { composer: null, bloom: null, vignette: null, ao: null };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  const { composer, bloom, vignette, ao } = fx;

  // Keep bloom/vignette/AO params live as the theme (postfx) changes.
  useEffect(() => {
    syncPostfxParams(bloom, vignette, ao, postfx);
  }, [bloom, vignette, ao, postfx]);

  // Track canvas resizes.
  useEffect(() => {
    if (!composer) return;
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());
    bloom?.setSize?.(size.width, size.height);
    ao?.setSize?.(size.width, size.height);
  }, [composer, bloom, ao, gl, size.width, size.height]);

  // Free GPU resources when the effects unmount (e.g. streaming starts).
  useEffect(
    () => () => {
      composer?.dispose?.();
    },
    [composer]
  );

  // Own the render loop while mounted; fall back to a plain render if needed.
  useFrame(() => {
    if (composer) composer.render();
    else gl.render(scene, camera);
  }, 1);

  return null;
}
