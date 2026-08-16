/**
 * Pack portfolio items into named garden beds.
 *
 * Two spacings matter and both used to be constants. Plants sat 1.55 apart while
 * a high-impact bloom is ~1.4 across and its label 3–4 wide, so a full bed read
 * as one bouquet with its names stacked on top of each other; and beds were
 * placed on a 4.7 grid regardless of how many plants they held, so a six-plant
 * bed overlapped its neighbour. Both now derive from what they separate.
 *
 * The maturity/impact encodings still do not affect placement, so a lifecycle
 * change animates vertically without reshuffling the composition.
 */

/** Centre-to-centre spacing between plants — a wide bloom plus room for a name. */
const PLANT_SPACING = 2.65;
/** Clear ground between neighbouring beds. */
const BED_GAP = 1.9;

/** Local grid slot, in units of `PLANT_SPACING`, centred on the bed. */
function plantSlot(index, cols, rows) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [
    col * PLANT_SPACING - ((cols - 1) * PLANT_SPACING) / 2,
    0,
    row * PLANT_SPACING - ((rows - 1) * PLANT_SPACING) / 2
  ];
}

/**
 * @param {Array<Record<string, unknown>>} items
 */
export function gardenBedLayout(items) {
  const groups = new Map();
  for (const item of items) {
    const name =
      typeof item.bed === 'string' && item.bed.trim() ? item.bed.trim() : 'Shared garden';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }

  const entries = [...groups.entries()];
  const positions = new Map();
  const beds = [];

  // Size every bed first: bed placement has to know how much ground each needs.
  const shapes = entries.map(([name, group]) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(group.length)));
    const rows = Math.ceil(group.length / cols);
    return {
      name,
      group,
      cols,
      rows,
      size: [
        Math.max(3.1, (cols - 1) * PLANT_SPACING + 2.4),
        Math.max(3.1, (rows - 1) * PLANT_SPACING + 2.4)
      ]
    };
  });

  // Row-major arrangement of beds, each column/row sized to its widest member so
  // a big bed pushes its neighbours out instead of growing into them.
  const bedCols = Math.max(1, Math.ceil(Math.sqrt(shapes.length)));
  const bedRows = Math.ceil(shapes.length / bedCols);
  const colWidths = new Array(bedCols).fill(0);
  const rowDepths = new Array(bedRows).fill(0);
  shapes.forEach((shape, index) => {
    const col = index % bedCols;
    const row = Math.floor(index / bedCols);
    colWidths[col] = Math.max(colWidths[col], shape.size[0]);
    rowDepths[row] = Math.max(rowDepths[row], shape.size[1]);
  });

  const colOffsets = [];
  let xCursor = 0;
  for (let col = 0; col < bedCols; col += 1) {
    colOffsets.push(xCursor + colWidths[col] / 2);
    xCursor += colWidths[col] + BED_GAP;
  }
  const rowOffsets = [];
  let zCursor = 0;
  for (let row = 0; row < bedRows; row += 1) {
    rowOffsets.push(zCursor + rowDepths[row] / 2);
    zCursor += rowDepths[row] + BED_GAP;
  }
  const spanX = Math.max(0, xCursor - BED_GAP);
  const spanZ = Math.max(0, zCursor - BED_GAP);

  shapes.forEach((shape, index) => {
    const col = index % bedCols;
    const row = Math.floor(index / bedCols);
    const center = [colOffsets[col] - spanX / 2, 0, rowOffsets[row] - spanZ / 2];
    shape.group.forEach((item, itemIndex) => {
      if (Array.isArray(item.position) && item.position.length === 3) {
        positions.set(item.id, [...item.position]);
        return;
      }
      const local = plantSlot(itemIndex, shape.cols, shape.rows);
      positions.set(item.id, [center[0] + local[0], 0, center[2] + local[2]]);
    });
    beds.push({ name: shape.name, center, size: shape.size });
  });

  let radius = 0;
  for (const bed of beds) {
    radius = Math.max(
      radius,
      Math.hypot(
        Math.abs(bed.center[0]) + bed.size[0] / 2,
        Math.abs(bed.center[2]) + bed.size[1] / 2
      )
    );
  }
  for (const [x, , z] of positions.values()) radius = Math.max(radius, Math.hypot(x, z) + 1.2);

  return {
    positions,
    beds,
    bounds: { width: radius * 2, depth: radius * 2, radius }
  };
}
