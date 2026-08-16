/**
 * Scene-agnostic building-block components shared by the per-metaphor scene
 * modules and MetaphorRenderer: billboarded labels, hover wiring, the links
 * layer (elbow + arc routing), the grounded contact shadow, and the gradient
 * sky sphere. Extracted from MetaphorRenderer.jsx (ADR-0005 sibling-module
 * pattern); pure helpers live in sceneUtils.js.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, ContactShadows, Line, Text } from '@react-three/drei';
import { useMetaphorHover } from '../metaphorHover.js';
import { useMetaphorChangeHighlight } from '../metaphorChangeHighlightContext.js';
import { MetaphorChangeHighlightRing } from '../MetaphorChangeHighlightRing.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { useLabelDeclutter } from './labelDeclutterContext.js';
import { ItemAccentContext, useItemAccent } from './itemAccentContext.js';
import {
  getRadialSpriteTexture,
  idHash2,
  resolveLinkAppearance,
  samplePolyline
} from './sceneUtils.js';

/** Billboarded additive glow using the soft radial sprite (round, not square). */
export function GlowSprite({ size, color, opacity }) {
  const map = getRadialSpriteTexture();
  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={map ?? undefined}
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

/**
 * Billboarded item label.
 *
 * `importance` (higher = keeps its space) and `pinned` (never hidden) feed the
 * screen-space declutter pass — see labelDeclutter.js. A scene that passes
 * neither still works: everything ranks equal and nearest-to-camera wins, which
 * is the right default for an unordered scene.
 *
 * Opacity is written imperatively onto the troika text object rather than
 * through props: the pass runs every ~110 ms and re-rendering a hundred labels
 * at that rate would cost more than the labels themselves.
 */
export function ItemLabel({
  text,
  position,
  fontSize = 0.55,
  color = '#0f172a',
  outlineColor = '#ffffff',
  importance = 0,
  pinned = false
}) {
  const billboardRef = useRef(null);
  const textRef = useRef(null);
  const declutter = useLabelDeclutter();
  // An accented item's own label inherits the pin, so a scene only has to mark
  // the item — it never has to thread `pinned` down to every ItemLabel call.
  const accented = useItemAccent();
  const isPinned = pinned || accented;

  // Approximate the label's world footprint from its glyph count — troika only
  // publishes real bounds after an async sync, and the pass needs a size the
  // first time it runs, not two frames later.
  const width = Math.min(fontSize * 16, (text?.length ?? 0) * fontSize * 0.55);
  const height = fontSize * 1.35;

  useEffect(() => {
    if (!declutter || !text) return undefined;
    return declutter.register({
      object: billboardRef.current,
      importance,
      pinned: isPinned,
      width,
      height,
      apply: (opacity) => {
        const label = textRef.current;
        if (!label) return;
        label.fillOpacity = opacity;
        label.outlineOpacity = opacity;
        if (label.material) label.material.transparent = true;
      }
    });
  }, [declutter, text, importance, isPinned, width, height]);

  if (!text) return null;
  return (
    <Billboard position={position} ref={billboardRef}>
      <Text
        ref={textRef}
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        maxWidth={fontSize * 16}
        outlineWidth={fontSize * 0.14}
        outlineColor={outlineColor}
        outlineOpacity={1}
      >
        {text}
      </Text>
    </Billboard>
  );
}

/**
 * Drives the declutter pass and the label fades from one frame subscription.
 * Mounted once by MetaphorRenderer inside the canvas.
 */
export function LabelDeclutterRunner({ store }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useFrame((_, delta) => {
    if (!store) return;
    store.update(camera, size, performance.now(), delta);
  });
  return null;
}

/** Soft grounded contact shadow — used by the flat-ground scenes (city, tree). */
export function MetaphorGroundShadow({ theme, y = 0.01, scale }) {
  const sfx = theme.postfx ?? {};
  return (
    <ContactShadows
      position={[0, y, 0]}
      scale={scale ?? sfx.shadowScale ?? 44}
      opacity={sfx.shadowOpacity ?? 0.35}
      blur={sfx.shadowBlur ?? 2.6}
      color={sfx.shadowColor ?? '#0a0f1e'}
      far={50}
      resolution={512}
    />
  );
}

/**
 * Wraps a per-item group with pointer handlers that drive the hover tooltip.
 * Writes only to the external hover store (no scene re-render) and stops event
 * propagation so it coexists with OrbitControls (drag still rotates the view).
 * No-ops when hover is disabled (store is null during streaming).
 */
export function HoverableItem({ item, metaphor, children, onActiveIdChange }) {
  const store = useMetaphorHover();
  const highlightCategory = useMetaphorChangeHighlight(item?.id);
  const update = (event) => {
    if (!store) return;
    event.stopPropagation();
    store.set({ item, metaphor, x: event.clientX, y: event.clientY });
  };
  const handleOver = (event) => {
    if (!store) return;
    update(event);
    onActiveIdChange?.(item?.id ?? null);
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  };
  const handleOut = (event) => {
    if (!store) return;
    event.stopPropagation();
    store.set(null);
    onActiveIdChange?.(null);
    if (typeof document !== 'undefined') document.body.style.cursor = '';
  };
  const itemId = typeof item?.id === 'string' ? item.id : undefined;
  return (
    <group
      name={itemId}
      userData={
        itemId
          ? {
              archislop: {
                id: itemId,
                label: typeof item?.label === 'string' ? item.label : itemId,
                metaphor: metaphor ?? null
              }
            }
          : undefined
      }
      onPointerOver={handleOver}
      onPointerMove={update}
      onPointerOut={handleOut}
    >
      {highlightCategory ? <MetaphorChangeHighlightRing category={highlightCategory} /> : null}
      <ItemAccentContext.Provider value={item?.accent === true}>
        {children}
      </ItemAccentContext.Provider>
    </group>
  );
}

/** A glowing dot that travels from→to along a link, conveying flow direction. */
function LinkFlowPulse({ points, color, seed }) {
  const ref = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!ref.current) return;
    const t = animated ? (getTime() * 0.16 + seed) % 1 : seed;
    const p = samplePolyline(points, t);
    ref.current.position.set(p[0], p[1], p[2]);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.13, 10, 10]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.92} />
    </mesh>
  );
}

/** Right-angle conduit routing — suits the architectural scenes (city, layercake). */
function elbowRoute(from, to) {
  const midY = Math.max(from[1], to[1]) + 1.5;
  const points = [from, [from[0], midY, from[2]], [to[0], midY, to[2]], to];
  const midpoint = [(from[0] + to[0]) / 2, midY + 0.3, (from[2] + to[2]) / 2];
  return { points, midpoint };
}

/** Smooth ballistic arc — suits the organic scenes (tree, galaxy). */
function arcRoute(from, to) {
  const fromVec = new THREE.Vector3(from[0], from[1], from[2]);
  const toVec = new THREE.Vector3(to[0], to[1], to[2]);
  const dist = fromVec.distanceTo(toVec);
  const mid = fromVec.clone().add(toVec).multiplyScalar(0.5);
  mid.y = Math.max(from[1], to[1]) + 0.7 + dist * 0.16;
  const curve = new THREE.QuadraticBezierCurve3(fromVec, mid, toVec);
  const points = curve.getPoints(22).map((v) => [v.x, v.y, v.z]);
  const labelAt = curve.getPoint(0.5);
  return { points, midpoint: [labelAt.x, labelAt.y + 0.35, labelAt.z] };
}

export function MetaphorLinks({ links, anchors, theme, variant = 'elbow' }) {
  if (!links?.length) return null;

  return (
    <group>
      {links.map((link, idx) => {
        const from = anchors.get(link.from);
        const to = anchors.get(link.to);
        if (!from || !to) return null;

        const route = variant === 'arc' ? arcRoute(from, to) : elbowRoute(from, to);
        const appearance = resolveLinkAppearance(link.kind, theme);
        return (
          <group key={`${link.from}-${link.to}-${idx}`}>
            <Line
              points={route.points}
              color={appearance.lineColor}
              lineWidth={1}
              transparent
              opacity={theme.linkOpacity ?? 0.75}
            />
            {appearance.showPulse ? (
              <LinkFlowPulse
                points={route.points}
                color={appearance.pulseColor}
                seed={idHash2(`${link.from}-${link.to}`, 'flow')}
              />
            ) : null}
            {link.label ? (
              <ItemLabel
                text={link.label}
                position={route.midpoint}
                fontSize={0.35}
                color={theme.labelColor}
                outlineColor={theme.labelOutline}
              />
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Vertical-gradient backdrop sphere (top colour → horizon colour). Rendered as
 * a big back-faced sphere *outside* `<Bounds>` so it never enlarges the framed
 * footprint, and `depthWrite={false}` keeps it behind the scene. Used by the
 * city sky and the galaxy's deep-space backdrop.
 */
export function GradientSkySphere({ topColor, horizonColor, scale = 220 }) {
  const material = useMemo(() => {
    const top = new THREE.Color(topColor ?? '#0b1020');
    const horizon = new THREE.Color(horizonColor ?? '#1b2436');
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: top },
        horizonColor: { value: horizon },
        offset: { value: 0.08 },
        exponent: { value: 0.85 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = pow(clamp((h + offset) / (1.0 + offset), 0.0, 1.0), exponent);
          gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
        }
      `
    });
  }, [topColor, horizonColor]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} scale={scale} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}
