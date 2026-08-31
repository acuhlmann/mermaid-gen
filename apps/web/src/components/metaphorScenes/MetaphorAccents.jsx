/**
 * Renders the `accent` marker: the callout over the item that IS the scene's
 * headline insight.
 *
 * The prompt has always told the agent to compose so its most extreme element
 * carries the thesis ("if everything is medium, the scene has no thesis"), but
 * nothing in the renderer ever *showed* which element that was — the viewer had
 * to infer it by comparing sizes. `accent` makes the claim explicit, and this
 * is what draws it.
 *
 * It rides each scene's existing `anchors` map, the same one `MetaphorLinks`
 * uses, because that map already answers the only question a marker needs: the
 * world point at the top of the thing. Fourteen scenes build it; none of them
 * needed a new concept to light one item up.
 *
 * Two things here are corrections to what shipped first, and both are about the
 * marker being *readable* rather than merely present:
 *
 * 1. A ring drawn AT the anchor is buried by whatever the scene draws on top of
 *    it. A city anchor is the building's roof line, and the roof, its fixtures
 *    and a spire all sit above that — measured on the whiteboard theme, the
 *    marker on the tallest tower was completely hidden inside its own roof. The
 *    marker is now a map pin: a stem rising from the anchor to a pin head that
 *    clears the item, so it cannot be occluded by the thing it points at.
 * 2. The item's `note` is the topic's own sentence about why this item is the
 *    thesis, and it used to be reachable only by hovering — which is to say,
 *    invisible in a screenshot, in fullscreen presentation mode, and to anybody
 *    who does not think to point at things. The accented item's note now renders
 *    as a caption on the pin, so the scene states its claim out loud.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { GlowSprite } from './MetaphorSceneChrome.jsx';
import { useLabelDeclutter } from './labelDeclutterContext.js';
import { useScreenConstantScale } from './metaphorScreenScale.js';
import { useMetaphorClock } from './metaphorClock.js';
import { isDarkBackdrop } from './sceneUtils.js';
import { captionFitsCanvas } from './accentCaptionFit.js';
import {
  ACCENT_CAPTION_TEXT_ORDER,
  ACCENT_MARKER_ORDER,
  ACCENT_PIN_ORDER
} from './metaphorDrawOrder.js';

/** Height of the light shaft above the anchor, in world units. */
const SHAFT_HEIGHT = 5.5;

/** The marker's hue, held constant across every theme. */
const ACCENT_MARKER_COLOR = '#fbbf24';

/** Caption type size and its wrap width, in world units. */
const CAPTION_SIZE = 0.38;
const CAPTION_MAX_WIDTH = 7;

/**
 * Draw order for the caption. It is an annotation about the scene, not a thing
 * inside it, so it ignores depth entirely: the marker exists precisely because
 * the accented item is often the one buried behind other geometry (a submerged
 * iceberg block, a gear behind a plate rim, a low tower in a dense skyline),
 * and a caption the subject can hide is a caption you cannot read exactly when
 * you need it. Measured on the iceberg, depth-tested text lost its middle third
 * to the berg in front of it.
 *
 * The number itself now lives in `metaphorDrawOrder.js` with the rest of the
 * ladder, because the accented item's OWN name has to sit above every rung of
 * it — see that file for why no camera or anchor change can substitute.
 */
const CAPTION_RENDER_ORDER = ACCENT_MARKER_ORDER;

/**
 * On-screen type size of the caption, in CSS pixels.
 *
 * The caption is authored in world units, and these scenes are not one size: a
 * layer cake is framed from ~14 units away and a bridge from ~60. Left at a
 * fixed world size the same caption is a banner across the cake and unreadable
 * three-point type on the bridge — measured on both. It is an annotation, so
 * what should stay constant is how big it looks, not how big it is.
 *
 * It used to approximate that from camera distance alone, which is only half the
 * answer: the same distance on a 390 px phone canvas and a 2560 px desktop one
 * is not the same number of pixels. `metaphorScreenScale.js` converts exactly,
 * and the caption sits a touch under the item labels so the thing being pointed
 * at still outranks the sentence about it.
 */
const CAPTION_TARGET_PX = 12;

/**
 * The note, as a caption plate on the pin.
 *
 * It carries its own dark backing plate rather than relying on a text outline:
 * a note is a sentence, not a one-word label, and at this type size an outline
 * alone loses against a lit facade or a bright sky. The plate is sized from a
 * glyph-count estimate for the same reason `ItemLabel` estimates its own
 * footprint — troika only publishes real bounds an async sync later, and a
 * plate that appears two frames after its text reads as a flicker.
 */
function AccentCaption({ text, y, color }) {
  const billboardRef = useRef(null);
  const scaleRef = useRef(null);
  const textRef = useRef(null);
  const plateRef = useRef(null);
  const ruleRef = useRef(null);
  const declutter = useLabelDeclutter();
  const size = useThree((state) => state.size);
  useScreenConstantScale(scaleRef, CAPTION_SIZE, CAPTION_TARGET_PX);

  const { lines, width } = useMemo(() => {
    const perLine = Math.max(12, Math.floor(CAPTION_MAX_WIDTH / (CAPTION_SIZE * 0.56)));
    const words = String(text).split(/\s+/);
    const out = [];
    let current = '';
    for (const word of words) {
      if (current && current.length + 1 + word.length > perLine) {
        out.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) out.push(current);
    const longest = out.reduce((max, line) => Math.max(max, line.length), 0);
    return { lines: out, width: Math.min(CAPTION_MAX_WIDTH, longest * CAPTION_SIZE * 0.56) };
  }, [text]);

  const plateWidth = width + CAPTION_SIZE * 1.4;
  const plateHeight = lines.length * CAPTION_SIZE * 1.32 + CAPTION_SIZE * 0.8;
  const screenWidthPx = (plateWidth / CAPTION_SIZE) * CAPTION_TARGET_PX;
  const screenHeightPx = (plateHeight / CAPTION_SIZE) * CAPTION_TARGET_PX;
  const fits = captionFitsCanvas(
    { widthPx: screenWidthPx, heightPx: screenHeightPx },
    { width: size?.width ?? 0, height: size?.height ?? 0 }
  );

  // The caption claims its box in the declutter pass rather than merely being
  // drawn over everything. It is the one sentence the scene wants read, and a
  // depth-test-free plate that item labels do not know about lands on top of the
  // accented item's OWN name — measured on the city, the caption covered both
  // "API Gateway" and the tower beside it. Pinned, so no item label can push it
  // out of contested space.
  //
  // `yieldWhenUnreadable` is the other half, and it is what stops the pin from
  // becoming the panel conflict it was meant to escape. The accented item is
  // usually the tallest thing in the scene, so the caption floating above it
  // lands at the top of the frame — which on a phone or a foldable cover is
  // where the reading strip is. Measured on a 717x512 cover: the plate was
  // drawn straight through the strip's lower edge. It can afford to vanish
  // there because the strip is printing that exact sentence (see
  // accentCaptionFit.js).
  useEffect(() => {
    if (!declutter || !text || !fits) return undefined;
    return declutter.register({
      object: billboardRef.current,
      importance: 100,
      pinned: true,
      yieldWhenUnreadable: true,
      screenWidthPx,
      screenHeightPx,
      apply: (opacity) => {
        const label = textRef.current;
        if (label) {
          label.fillOpacity = opacity;
          if (label.material) label.material.transparent = true;
        }
        const plate = plateRef.current;
        if (plate?.material) {
          plate.material.opacity = opacity * 0.86;
          plate.visible = opacity > 0.05;
        }
        const rule = ruleRef.current;
        if (rule?.material) {
          rule.material.opacity = opacity * 0.95;
          rule.visible = opacity > 0.05;
        }
      }
    });
  }, [declutter, text, screenWidthPx, screenHeightPx, fits]);

  if (!fits) return null;

  return (
    <Billboard position={[0, y, 0]} ref={billboardRef}>
      <group ref={scaleRef}>
        <mesh ref={plateRef} position={[0, 0, -0.02]} renderOrder={CAPTION_RENDER_ORDER}>
          <planeGeometry args={[plateWidth, plateHeight]} />
          <meshBasicMaterial
            color="#0f172a"
            transparent
            opacity={0.86}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
        <mesh
          ref={ruleRef}
          position={[0, -plateHeight / 2 + 0.03, -0.01]}
          renderOrder={ACCENT_PIN_ORDER}
        >
          <planeGeometry args={[plateWidth, 0.055]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.95}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
        <Text
          ref={textRef}
          fontSize={CAPTION_SIZE}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          lineHeight={1.32}
          maxWidth={CAPTION_MAX_WIDTH}
          renderOrder={ACCENT_CAPTION_TEXT_ORDER}
          material-depthTest={false}
          material-depthWrite={false}
          material-toneMapped={false}
        >
          {lines.join('\n')}
        </Text>
      </group>
    </Billboard>
  );
}

function AccentBeam({ position, color, additive, note }) {
  const haloRef = useRef(null);
  const ringRef = useRef(null);
  const pinRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();

  // Without a shaft to cap, the pin sits closer to the item it marks.
  const pinHeight = additive ? SHAFT_HEIGHT + 1.35 : 2.6;

  useFrame(() => {
    const t = animated ? getTime() : 0;
    // Slow breathing rather than a blink: this marks the topic's thesis, and a
    // flashing thesis reads as an error state.
    const pulse = 0.72 + 0.28 * Math.sin(t * 1.15);
    if (haloRef.current) haloRef.current.scale.setScalar(pulse);
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.35;
      ringRef.current.scale.setScalar(0.94 + 0.06 * Math.sin(t * 1.15 + 1));
    }
    if (pinRef.current) {
      pinRef.current.position.y = pinHeight + Math.sin(t * 1.15) * 0.22;
      pinRef.current.rotation.y = t * 0.6;
    }
  });

  const shaftGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.5, 0.16, SHAFT_HEIGHT, 16, 1, true),
    []
  );

  return (
    <group position={position}>
      {/* Light shaft — dark backdrops only, and that is a real conclusion rather
          than a shortcut. Additive blending can only ADD light, so over
          whiteboard's near-white sky it is mathematically incapable of showing
          up; switching that same cone to normal blending does make it visible,
          but a pale translucent cone over a pale sky reads as a smudge sitting
          on the subject, and it dulled the very flower it was pointing at. A
          beam is a light effect and light effects need darkness. On bright
          themes the stem, ring and pin carry the marker on their own. */}
      {additive ? (
        <mesh geometry={shaftGeometry} position={[0, SHAFT_HEIGHT / 2 + 0.45, 0]}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {additive ? (
        <group ref={haloRef} position={[0, 0.35, 0]}>
          <GlowSprite size={3.2} color={color} opacity={0.3} />
        </group>
      ) : null}
      {/* Stem: a lit rod from the anchor to the pin, tying the floating pin back
          to one specific item — a pin alone hovering over a crowded skyline is
          ambiguous about what it marks.

          Stem and pin are depth-test-free for the same reason the caption is.
          An anchor is "the world point at the top of the thing", but several
          scenes keep drawing ABOVE that point: a city building stacks a roof, a
          spire and a rooftop glyph over its own anchor, and measured on the
          whiteboard city the entire marker rendered inside the spire of the
          tower it was marking. Chasing that with a taller stem only moves the
          problem to the next kind. The callout is an annotation about the scene
          rather than an object within it, so it is drawn over the scene — which
          is also what a leader line does on any annotated drawing. The ring
          below stays depth-tested: it is a decal on the item, and it should be
          hidden when the item is.

          `depthWrite={false}` is the other half of that sentence and it was
          missing. A mesh that ignores depth and still WRITES it stamps its own
          distance into the buffer, and every depth-tested thing drawn later is
          then rejected against a rod that was never supposed to be part of the
          scene's geometry. The victim is the accented item's own name: measured
          on the subway fixture at 717x512, "Pay" rendered as "P y" with no
          amber pixel anywhere near the missing glyph, because the stem deleted
          it rather than painting over it. That is why it survived a screenshot
          diff of the marker's colour — the standing theory in the ledger had
          it as the stem drawn ON the name, and the stem is `meshStandardMaterial`,
          whose `depthWrite` defaults to true. An annotation writes no depth. */}
      <mesh position={[0, pinHeight / 2, 0]} renderOrder={CAPTION_RENDER_ORDER}>
        <cylinderGeometry args={[0.055, 0.055, pinHeight, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.4}
          metalness={0.2}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.15, 1.4, 44]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
      </mesh>
      {/* An OPAQUE, lit pin at the top of the stem. The shaft and halo are
          translucent, which makes them a matter of contrast — and against the
          whiteboard theme's near-white sky there is barely any contrast to
          spend. A solid shape carries the marker on any background, and a slow
          bob keeps it reading as a pointer rather than as scene furniture. */}
      <mesh
        ref={pinRef}
        position={[0, pinHeight, 0]}
        rotation={[Math.PI, 0, 0]}
        renderOrder={ACCENT_PIN_ORDER}
      >
        <coneGeometry args={[0.42, 0.95, 5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.35}
          metalness={0.15}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {note ? <AccentCaption text={note} y={pinHeight + 1.05} color={color} /> : null}
    </group>
  );
}

/**
 * @param {object} props
 * @param {Array<Record<string, unknown>>} props.items — the scene's items
 * @param {Map<string, [number, number, number]>} props.anchors — id → world anchor
 * @param {Record<string, unknown>} props.theme
 */
export function MetaphorAccents({ items, anchors, theme }) {
  const accented = useMemo(
    () => (items ?? []).filter((item) => item?.accent === true && anchors?.has(item.id)),
    [items, anchors]
  );
  if (!accented.length) return null;
  // Fixed amber, not a theme colour. Falling back through `slabTrimColor` /
  // `starColor` looked harmless and defeated the point: those ARE encoding
  // colours, so on noir the marker came out the same slate as the cake trim and
  // stopped reading as "look here". The marker has to be one hue no palette
  // spends on meaning; a theme that genuinely needs another sets
  // `accentMarkerColor` explicitly.
  const color = theme.accentMarkerColor ?? ACCENT_MARKER_COLOR;
  const additive = isDarkBackdrop(theme);
  return (
    <group>
      {accented.map((item) => (
        <AccentBeam
          key={`accent-${item.id}`}
          position={anchors.get(item.id)}
          color={color}
          additive={additive}
          note={typeof item.note === 'string' && item.note.trim() ? item.note.trim() : null}
        />
      ))}
    </group>
  );
}
