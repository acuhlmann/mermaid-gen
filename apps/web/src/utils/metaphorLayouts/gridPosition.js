/** Grid slot for a single item within a local patch (XZ plane, Y=0). */
export function gridPosition(index, count, footprint, gap = 1.2) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const spacing = footprint + gap;
  const offset = ((cols - 1) * spacing) / 2;
  return [col * spacing - offset, 0, row * spacing - offset];
}
