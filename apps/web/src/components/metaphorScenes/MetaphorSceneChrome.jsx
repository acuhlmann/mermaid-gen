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
import { createTapGesture, useMetaphorSelection } from '../metaphorSelection.js';
import { useMetaphorChangeHighlight } from '../metaphorChangeHighlightContext.js';
import { MetaphorChangeHighlightRing } from '../MetaphorChangeHighlightRing.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { useLabelDeclutter } from './labelDeclutterContext.js';
import { ItemAccentContext, useItemAccent } from './itemAccentContext.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';
import { labelPlateEm, labelRoleStyle, labelRoleText } from './labelRoles.js';
import {
  LABEL_TARGET_PX,
  LINK_LABEL_TARGET_PX,
  useScreenConstantScale
} from './metaphorScreenScale.js';
import {
  ensureReadableInk,
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
 * Billboarded item label, drawn at a constant size on screen.
 *
 * The size is the reason this is not just a `<Text>`: a world-authored label is
 * three times bigger at the front of a scene than at the back, and on a phone
 * the back half falls under the size anyone can read. `metaphorScreenScale.js`
 * carries the conversion and why it is the same rule the fog band, the AO radius
 * and the tour camera already follow. The billboard still moves in perspective —
 * only its size stops arguing with the camera.
 *
 * `importance` (higher = keeps its space) and `pinned` (never hidden) feed the
 * screen-space declutter pass — see labelDeclutter.js. A scene that passes
 * neither still works: everything ranks equal and nearest-to-camera wins, which
 * is the right default for an unordered scene.
 *
 * `role` says what the label NAMES — a thing, a territory, or a relation — and
 * that is what picks the chip, the tracking, the case and the size. See
 * labelRoles.js; a scene passes the noun, never a font size.
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
  pinned = false,
  role = 'item',
  targetPx = LABEL_TARGET_PX
}) {
  const billboardRef = useRef(null);
  const scaleRef = useRef(null);
  const textRef = useRef(null);
  const plateRef = useRef(null);
  const declutter = useLabelDeclutter();
  // An accented item's own label inherits the pin, so a scene only has to mark
  // the item — it never has to thread `pinned` down to every ItemLabel call.
  const accented = useItemAccent();
  const isPinned = pinned || accented;

  const style = labelRoleStyle(role);
  const drawn = labelRoleText(text, style);
  const size = fontSize * style.scale;
  // Every label is read against `outlineColor` — as a halo for a group placard,
  // as the chip itself for the other two — so that is the only background the
  // ink has, and a scene-coloured name (a subway route, a district) is picked
  // to look right as a lit surface rather than as type. See ensureReadableInk.
  const ink = useMemo(() => ensureReadableInk(color, outlineColor), [color, outlineColor]);

  // The chip footprint, estimated from the glyph count — see labelPlateEm.
  const plateEm = labelPlateEm(drawn, style);
  const plateWidth = plateEm.width * size;
  const plateHeight = plateEm.height * size;
  const plateOpacity = style.plate;
  // The declutter pass wants screen boxes, and a screen-constant label knows its
  // own directly: the world size never reaches the screen unscaled any more, so
  // projecting it would report the authored size instead of the drawn one.
  // The rank's size is spent on screen, not in world units: these labels are
  // screen-constant, so a world-size bump would be undone by the very next frame.
  const drawnPx = targetPx * style.scale;
  const screenWidthPx = plateEm.width * drawnPx;
  const screenHeightPx = plateEm.height * drawnPx;

  useScreenConstantScale(scaleRef, size, drawnPx);

  useEffect(() => {
    if (!declutter || !text) return undefined;
    return declutter.register({
      object: billboardRef.current,
      importance,
      pinned: isPinned,
      screenWidthPx,
      screenHeightPx,
      apply: (opacity) => {
        const label = textRef.current;
        if (label) {
          label.fillOpacity = opacity;
          label.outlineOpacity = opacity;
          if (label.material) label.material.transparent = true;
        }
        const plate = plateRef.current;
        if (plate?.material) {
          plate.material.opacity = opacity * plateOpacity;
          plate.visible = opacity > 0.05;
        }
      }
    });
  }, [declutter, text, importance, isPinned, screenWidthPx, screenHeightPx]);

  if (!text) return null;
  return (
    <Billboard position={position} ref={billboardRef}>
      <group ref={scaleRef}>
        {/* Chip behind every label so one-word names stay readable against a
            lit facade, a bright sky, or a busy fused landscape. The plate is
            scaffolding, not subject — keep it out of the camera fit. A group
            placard has none: it is written across its ground, and its heavier
            outline is what carries it. Not rendered at all rather than drawn at
            zero alpha — an invisible transparent quad still costs a sorted draw
            call, and a fused world can hold a dozen placards. */}
        {plateOpacity > 0 ? (
          <mesh
            ref={plateRef}
            position={[0, 0, -size * 0.05]}
            userData={FRAME_IGNORE_DATA}
            renderOrder={8}
          >
            <planeGeometry args={[plateWidth, plateHeight]} />
            <meshBasicMaterial
              color={outlineColor}
              transparent
              opacity={plateOpacity}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ) : null}
        <Text
          ref={textRef}
          fontSize={size}
          color={ink}
          anchorX="center"
          anchorY="middle"
          letterSpacing={style.tracking}
          maxWidth={size * 16}
          outlineWidth={size * style.outline}
          outlineColor={outlineColor}
          outlineOpacity={1}
        >
          {drawn}
        </Text>
      </group>
    </Billboard>
  );
}

/**
 * Drives the declutter pass and the label fades from one frame subscription.
 * Mounted once by MetaphorRenderer inside the canvas.
 */
export function LabelDeclutterRunner({ store, chromeRects = null }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useFrame((_, delta) => {
    if (!store) return;
    store.update(camera, size, performance.now(), delta, chromeRects ?? undefined);
  });
  return null;
}

/**
 * Soft grounded contact shadow — used by the flat-ground scenes (city, tree).
 *
 * `FRAME_IGNORE_DATA` is load-bearing, not tidiness. This is a *catcher* plane:
 * it is sized well beyond the subject so the blur has somewhere to fall, and it
 * is invisible except where a shadow lands on it. Left in the camera fit it
 * therefore became the binding constraint on almost every grounded kind, and
 * the scene was framed around a rectangle nobody can see — measured, the city
 * needed 44 units for its actual skyline and 57 for this plane (‑23% subject
 * size), the garden 22 vs 30, and the fused composite 20 vs 30, which is why
 * every scene read as small and far away. Same rule as the ambience layers:
 * anything that is not the subject must not decide how the subject is framed.
 */
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
      userData={FRAME_IGNORE_DATA}
    />
  );
}

/**
 * Wraps a per-item group with pointer handlers that drive the hover tooltip and
 * the tap-to-inspect selection. Writes only to the external stores (no scene
 * re-render) and stops event propagation so it coexists with OrbitControls
 * (drag still rotates the view). No-ops when a store is absent (hover is null
 * during streaming).
 *
 * Tap detection is ours rather than R3F's `onClick`: the canvas is a single DOM
 * element, so an orbit drag that starts and ends inside it still produces a DOM
 * click, and a phone would select whatever the finger happened to be over when
 * the rotation stopped. Down/up with a `TAP_SLOP_PX` budget is the gesture the
 * viewer actually means.
 */
export function HoverableItem({ item, metaphor, layerLabel, children, onActiveIdChange }) {
  const store = useMetaphorHover();
  const selection = useMetaphorSelection();
  const tapRef = useRef(null);
  const highlightCategory = useMetaphorChangeHighlight(item?.id);
  const resolvedLayerLabel =
    typeof layerLabel === 'string' && layerLabel.trim() ? layerLabel.trim() : null;
  const update = (event) => {
    if (!store) return;
    event.stopPropagation();
    store.set({
      item,
      metaphor,
      layerLabel: resolvedLayerLabel,
      x: event.clientX,
      y: event.clientY
    });
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
  const handleTapStart = (event) => {
    if (!selection) return;
    if (!tapRef.current) tapRef.current = createTapGesture();
    tapRef.current.start(event);
  };
  const handleTapEnd = (event) => {
    if (!selection || !tapRef.current) return;
    if (!tapRef.current.end(event)) return;
    event.stopPropagation();
    selection.toggle({ item, metaphor, layerLabel: resolvedLayerLabel });
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
      onPointerDown={handleTapStart}
      onPointerUp={handleTapEnd}
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
                role="link"
                targetPx={LINK_LABEL_TARGET_PX}
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
