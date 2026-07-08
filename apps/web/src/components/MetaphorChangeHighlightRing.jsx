/**
 * Emissive ring drawn around highlighted metaphor items.
 * @param {{ category: 'added' | 'modified' }} props
 */
export function MetaphorChangeHighlightRing({ category }) {
  const color = category === 'added' ? '#16a34a' : '#ea580c';
  return (
    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.05, 1.35, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.82} toneMapped={false} />
    </mesh>
  );
}
