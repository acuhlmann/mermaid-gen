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
import {
  LINK_PICK_CASING_OPACITY,
  LINK_PICK_COLOR,
  LINK_PICK_USER_DATA,
  LINK_PICK_WIDTH_SCALE,
  linkPickKey,
  useMetaphorLinkSelection,
  usePickedLink
} from './metaphorLinkPick.js';
import { useMetaphorChangeHighlight } from '../metaphorChangeHighlightContext.js';
import { MetaphorChangeHighlightRing } from '../MetaphorChangeHighlightRing.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { useLabelDeclutter } from './labelDeclutterContext.js';
import { ItemAccentContext, useItemAccent } from './itemAccentContext.js';
import { useLabelDepthTest } from './metaphorLabelDepth.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';
import {
  labelLines,
  labelPlateEm,
  labelRoleStyle,
  labelRoleText,
  labelStackLiftEm
} from './labelRoles.js';
import {
  ACCENT_ITEM_LABEL_ORDER,
  ACCENT_ITEM_LABEL_PLATE_OPACITY,
  ACCENT_ITEM_LABEL_PLATE_ORDER,
  LABEL_PLATE_ORDER,
  PICKED_LINK_ORDER
} from './metaphorDrawOrder.js';
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
import {
  LINK_CASING_OPACITY,
  arrowFromRoute,
  linkCoreOpacity,
  linkInk,
  linkMetricsFor
} from './linkRoutes.js';

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
 * `layerKey` says which of a composite's grammars this name belongs to, so the
 * pass can guarantee each of them one surviving name before any of them gets a
 * second — see `resolveLabels`. A base kind leaves it null and the rule no-ops.
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
  layerKey = null,
  targetPx = LABEL_TARGET_PX
}) {
  // The declutter pass measures THIS group, not the Billboard: a stacked sign
  // is lifted inside the screen-constant group (see `lift` below), so the
  // Billboard's own origin is no longer the centre of the drawn box, and a box
  // registered there would under-claim the top line by exactly the lift.
  const boxRef = useRef(null);
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
  // A stacked sign lengthens upward: troika anchors at the block's middle, and
  // down is where the thing being named stands. See labelStackLiftEm.
  const lift = labelStackLiftEm(labelLines(drawn).length);
  const plateWidth = plateEm.width * size;
  const plateHeight = plateEm.height * size;
  // An accented item's chip carries a saturated amber rod behind it now that the
  // name is drawn over its own callout, and a 0.58 chip lets that rod read as a
  // line struck through the word. See metaphorDrawOrder.js.
  const plateOpacity =
    accented && style.plate > 0
      ? Math.max(style.plate, ACCENT_ITEM_LABEL_PLATE_OPACITY)
      : style.plate;
  // The declutter pass wants screen boxes, and a screen-constant label knows its
  // own directly: the world size never reaches the screen unscaled any more, so
  // projecting it would report the authored size instead of the drawn one.
  // The rank's size is spent on screen, not in world units: these labels are
  // screen-constant, so a world-size bump would be undone by the very next frame.
  const drawnPx = targetPx * style.scale;
  const screenWidthPx = plateEm.width * drawnPx;
  const screenHeightPx = plateEm.height * drawnPx;

  useScreenConstantScale(scaleRef, size, drawnPx);

  // Depth has to be set through troika's own object rather than a
  // `material-depthTest` prop, AND re-applied whenever the accent moves —
  // `onSync` fires once and then never again for a change of accent, because
  // being accented is not one of troika's syncable props. Both halves, and why
  // neither is visible to a screenshot, are in metaphorLabelDepth.js.
  const applyLabelDepth = useLabelDepthTest(accented);

  useEffect(() => {
    if (!declutter || !text) return undefined;
    return declutter.register({
      object: boxRef.current,
      importance,
      pinned: isPinned,
      layerKey,
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
    // `plateOpacity` is in the deps on purpose even though accent changes usually
    // flip `isPinned` too: a label whose `pinned` prop is already true (a subway
    // interchange, a tree trunk item) keeps `isPinned === true` when the accent
    // lands, so without this the closure keeps writing the unaccented plate
    // opacity over the JSX-rendered accent lift.
  }, [
    declutter,
    text,
    importance,
    isPinned,
    plateOpacity,
    layerKey,
    screenWidthPx,
    screenHeightPx
  ]);

  if (!text) return null;
  return (
    <Billboard position={position}>
      <group ref={scaleRef}>
        <group ref={boxRef} position={[0, lift * size, 0]}>
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
              renderOrder={accented ? ACCENT_ITEM_LABEL_PLATE_ORDER : LABEL_PLATE_ORDER}
            >
              <planeGeometry args={[plateWidth, plateHeight]} />
              <meshBasicMaterial
                color={outlineColor}
                transparent
                opacity={plateOpacity}
                depthWrite={false}
                depthTest={!accented}
                toneMapped={false}
              />
            </mesh>
          ) : null}
          {/* The accented item's name is drawn LAST and without depth, above its
            own callout. The stem, pin and caption are all depth-test-free, so
            once the marker exists `renderOrder` is the only thing deciding
            which of the two a viewer can read — and the marker was winning
            against the very name it points at. The full argument, including why
            no camera or anchor change can substitute for a draw order, is in
            metaphorDrawOrder.js.

            Dropping depth as well is what the scene's own geometry forces:
            measured on the subway fixture, the amber route tube ENDS at its
            terminus station and rises toward the camera, so it stands in front
            of the very name it terminates at. Marking an item is a claim that
            it is the one to read, and the kinds where the claim is worth making
            — a submerged iceberg block, a gear behind a plate rim, a terminus
            under its own track — are exactly the ones that bury it. */}
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
            renderOrder={accented ? ACCENT_ITEM_LABEL_ORDER : 0}
            onSync={applyLabelDepth}
          >
            {drawn}
          </Text>
        </group>
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
  const linkSelection = useMetaphorLinkSelection();
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
    // An item and a link are one pick between them: the inspector, the marker
    // and the radial menu each answer "what did I tap", and two live answers
    // would have the ring on a tower while the menu renamed a wire.
    linkSelection?.clear();
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

/**
 * How far the tip stands off the anchor, in arrow lengths. An anchor is "the
 * top of the item", and several scenes then draw ABOVE their own anchor, so a
 * tip placed exactly on one lands inside whatever the scene stacked there.
 * Screen-relative like the arrow itself: the whole group is scaled, so a
 * fraction of its own length is the only standoff that survives a 14-unit
 * layercake and a 60-unit bridge.
 */
const ARROW_STANDOFF = 0.4;

/**
 * Draw order for the arrowhead — an annotation about the scene rather than an
 * object in it, so it ignores depth, the same call `MetaphorAccents` documents
 * at length for the accent pin. It is the same trap by the same door: a city
 * building stacks a roof, a spire and a rooftop glyph over its anchor, and the
 * first depth-tested version of this arrow was invisible on EVERY city link —
 * buried inside the spire of the tower it was pointing at. Chasing that with a
 * taller standoff only moves the problem to the next kind. Ranked below the
 * accent caption, which outranks everything.
 */
const ARROW_RENDER_ORDER = 20;

/** How much bigger the arrow's casing cone is than its core — the halo width. */
const ARROW_CASING_SCALE = 1.34;

/**
 * Which way a relation points, as a cone aimed at the `to` anchor.
 *
 * Screen-constant like every other annotation in these scenes: authored one
 * world unit long and scaled each frame, so the same arrow reads at the same
 * size on a 14-unit layercake and a 60-unit bridge. The mesh hangs at negative
 * local Y so the group's ORIGIN is where the arrow points — which is what lets
 * the caller place the group on the anchor and have the body trail back up the
 * route however the scale works out.
 */
export function LinkArrowhead({ position, direction, color, casingColor, opacity, targetPx }) {
  const ref = useRef(null);
  useScreenConstantScale(ref, 1, targetPx);
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize();
    // The cone points +Y; turn that into the route's own heading. `setFromUnitVectors`
    // degenerates on an exactly-opposite pair, which a straight-down elbow leg is.
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    if (dir.dot(up) < -0.9999) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    else q.setFromUnitVectors(up, dir);
    return q;
  }, [direction]);

  return (
    <group ref={ref} position={position} quaternion={quaternion} userData={FRAME_IGNORE_DATA}>
      {/* The arrow carries the line's casing for the line's reason, and needs it
          more: drawing over the scene means it is as often on a dark tower as on
          the sky, and a grey cone on a grey spire states nothing. */}
      {casingColor ? (
        <mesh
          position={[0, -(0.5 + ARROW_STANDOFF), 0]}
          scale={ARROW_CASING_SCALE}
          renderOrder={ARROW_RENDER_ORDER - 1}
        >
          <coneGeometry args={[0.32, 1, 14]} />
          <meshBasicMaterial
            color={casingColor}
            transparent
            opacity={LINK_CASING_OPACITY}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      <mesh position={[0, -(0.5 + ARROW_STANDOFF), 0]} renderOrder={ARROW_RENDER_ORDER}>
        <coneGeometry args={[0.32, 1, 14]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * The scene's relations: a cased line per link, an arrowhead at the end it
 * points to, a travelling pulse where the kind carries movement, and the
 * author's own caption at the midpoint.
 *
 * The casing/contrast/direction reasoning lives in `linkRoutes.js`. Two
 * renderer-side facts:
 *
 * - **Links are out of the camera fit.** They join items already in it, so they
 *   constrain nothing it does not already know, and the arrowheads are
 *   screen-constant — a fixed point of the solve rather than an input to it,
 *   the same reason scene text is pruned in `collectFramePoints`. (Line2's
 *   `attributes.position` is the unit quad template, not the polyline, so an
 *   unflagged link was contributing a phantom 2-unit box at the origin anyway.)
 * - **The casing does not write depth.** Core and casing are coplanar by
 *   construction; equal depth plus the default `LessEqualDepth` means whichever
 *   draws second wins, so the order is set explicitly rather than left to the
 *   traversal.
 */
export function MetaphorLinks({ links, anchors, theme, variant = 'elbow' }) {
  const pickable = Boolean(useMetaphorLinkSelection());
  // Subscribing here rather than in each `<Line>` keeps a link pick off React
  // state in the scene modules: only this component re-renders, and the
  // layouts, anchor maps and per-item memos above it never re-run.
  const pickedLink = usePickedLink();
  const pickedKey = pickedLink?.link ? linkPickKey(pickedLink.link.from, pickedLink.link.to) : null;
  const metrics = linkMetricsFor(links?.length ?? 0);
  if (!links?.length) return null;

  const casingColor = theme.labelOutline ?? '#ffffff';
  const coreOpacity = linkCoreOpacity(theme.linkOpacity);

  return (
    <group userData={FRAME_IGNORE_DATA}>
      {links.map((link, idx) => {
        const from = anchors.get(link.from);
        const to = anchors.get(link.to);
        if (!from || !to) return null;
        return (
          <MetaphorLinkRoute
            key={`${link.from}-${link.to}-${idx}`}
            link={link}
            route={variant === 'arc' ? arcRoute(from, to) : elbowRoute(from, to)}
            theme={theme}
            metrics={metrics}
            casingColor={casingColor}
            coreOpacity={coreOpacity}
            pickable={pickable}
            picked={pickedKey !== null && pickedKey === linkPickKey(link.from, link.to)}
          />
        );
      })}
    </group>
  );
}

/** One relation: cased line, arrowhead, optional pulse, optional caption. */
function MetaphorLinkRoute({
  link,
  route,
  theme,
  metrics,
  casingColor,
  coreOpacity,
  pickable,
  picked
}) {
  const appearance = resolveLinkAppearance(link.kind, theme);
  const ink = picked ? LINK_PICK_COLOR : linkInk(appearance.lineColor, casingColor);
  const arrow = arrowFromRoute(route.points);
  return (
    <group
      // The route is published in LOCAL coordinates beside the group that draws
      // it; `metaphorLinkPick.js` multiplies by this group's world matrix at
      // pick time, so an animated kind that moves the group (galaxy's drift,
      // machine's rotation) keeps a true hit target without this layer knowing
      // anything about the camera.
      userData={
        pickable
          ? {
              ...FRAME_IGNORE_DATA,
              [LINK_PICK_USER_DATA]: {
                link: {
                  from: link.from,
                  to: link.to,
                  label: typeof link.label === 'string' ? link.label : ''
                },
                points: route.points
              }
            }
          : FRAME_IGNORE_DATA
      }
    >
      <Line
        points={route.points}
        color={picked ? LINK_PICK_COLOR : casingColor}
        lineWidth={picked ? metrics.casingPx * LINK_PICK_WIDTH_SCALE : metrics.casingPx}
        transparent
        opacity={picked ? LINK_PICK_CASING_OPACITY : LINK_CASING_OPACITY}
        depthWrite={false}
        renderOrder={-1}
      />
      <Line
        points={route.points}
        color={ink}
        lineWidth={picked ? metrics.corePx * LINK_PICK_WIDTH_SCALE : metrics.corePx}
        transparent
        opacity={coreOpacity}
        // A picked link is an annotation about the scene for as long as it is
        // picked — the same call the accent callout and the selection ring
        // already make. Without it the answer to "which wire did I tap" is
        // hidden behind whatever the route passes through, which on a city is
        // most of it.
        depthTest={!picked}
        depthWrite={!picked}
        renderOrder={picked ? PICKED_LINK_ORDER : 0}
      />
      {arrow ? (
        <LinkArrowhead
          position={arrow.position}
          direction={arrow.direction}
          color={ink}
          casingColor={casingColor}
          opacity={coreOpacity}
          targetPx={metrics.arrowPx}
        />
      ) : null}
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
