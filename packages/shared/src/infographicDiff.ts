/**
 * Structural diff between two infographic DSL sources (shared by web + server).
 */

const TOP_FIELDS = new Set(['lists', 'sequences', 'compares', 'items', 'nodes', 'root', 'values']);

type InfographicNode = {
  indexPath: string;
  label: string | null;
  desc: string | null;
  value: string | null;
  icon: string | null;
  illus: string | null;
  children: InfographicNode[];
};

function indentOf(line: string) {
  let i = 0;
  while (i < line.length && line[i] === ' ') i += 1;
  return i;
}

function parseInlineKv(line: string) {
  const m = /^(label|desc|value|icon|illus|category)\s+(.*)$/i.exec(line.trim());
  if (!m) return null;
  return { key: m[1].toLowerCase(), value: m[2].trim() };
}

function readTemplate(text: string) {
  const firstNonEmpty = text.split('\n').find((l) => l.trim());
  if (!firstNonEmpty) return null;
  const m = /^\s*infographic\s+([a-z0-9][a-z0-9-]*)\s*$/i.exec(firstNonEmpty);
  return m ? m[1].toLowerCase() : null;
}

export function parseInfographicTree(text: string) {
  if (typeof text !== 'string' || !text.trim()) {
    return { template: null, topField: null, items: [] };
  }
  const template = readTemplate(text);
  const lines = text.split('\n');

  let dataIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*data\s*$/.test(lines[i])) {
      dataIdx = i;
      break;
    }
  }
  if (dataIdx < 0) return { template, topField: null, items: [] };

  let topField = null;
  let topFieldIndent = -1;
  let firstItemIdx = -1;
  for (let i = dataIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const ind = indentOf(raw);
    if (ind === 0) break;
    const word = raw.trim().split(/\s+/)[0]?.toLowerCase();
    if (TOP_FIELDS.has(word)) {
      topField = word;
      topFieldIndent = ind;
      firstItemIdx = i + 1;
      break;
    }
  }
  if (!topField) return { template, topField: null, items: [] };

  function parseSiblings(start: number, itemIndent: number, parentPath: string) {
    const out = [];
    let i = start;
    let nextChildIdx = 0;
    while (i < lines.length) {
      const raw = lines[i];
      if (!raw.trim()) {
        i += 1;
        continue;
      }
      const ind = indentOf(raw);
      if (ind < itemIndent) break;
      if (ind === itemIndent) {
        const stripped = raw.slice(ind);
        if (!stripped.startsWith('- ')) break;
        const indexPath = parentPath === '' ? `${nextChildIdx}` : `${parentPath},${nextChildIdx}`;
        nextChildIdx += 1;
        const node: InfographicNode = {
          indexPath,
          label: null,
          desc: null,
          value: null,
          icon: null,
          illus: null,
          children: []
        };
        const firstAttr = stripped.slice(2);
        const kv = parseInlineKv(firstAttr);
        if (kv) {
          if (kv.key === 'label') node.label = kv.value;
          else if (kv.key === 'desc') node.desc = kv.value;
          else if (kv.key === 'value') node.value = kv.value;
          else if (kv.key === 'icon') node.icon = kv.value;
          else if (kv.key === 'illus') node.illus = kv.value;
        }
        i += 1;
        const attrIndent = itemIndent + 2;
        while (i < lines.length) {
          const ar = lines[i];
          if (!ar.trim()) {
            i += 1;
            continue;
          }
          const aInd = indentOf(ar);
          if (aInd <= itemIndent) break;
          const aStripped = ar.slice(aInd);
          if (/^children\s*$/i.test(aStripped)) {
            let childItemIndent = -1;
            for (let j = i + 1; j < lines.length; j++) {
              const cr = lines[j];
              if (!cr.trim()) continue;
              const cInd = indentOf(cr);
              if (cInd <= aInd) break;
              if (cr.slice(cInd).startsWith('- ')) {
                childItemIndent = cInd;
                break;
              }
            }
            if (childItemIndent > 0) {
              const { items: kids, next } = parseSiblings(i + 1, childItemIndent, indexPath);
              node.children = kids;
              i = next;
            } else {
              i += 1;
            }
            continue;
          }
          const kv2 = parseInlineKv(aStripped);
          if (kv2) {
            if (kv2.key === 'label' && node.label == null) node.label = kv2.value;
            else if (kv2.key === 'desc' && node.desc == null) node.desc = kv2.value;
            else if (kv2.key === 'value' && node.value == null) node.value = kv2.value;
            else if (kv2.key === 'icon' && node.icon == null) node.icon = kv2.value;
            else if (kv2.key === 'illus' && node.illus == null) node.illus = kv2.value;
          }
          i += 1;
          if (aInd < attrIndent) break;
        }
        out.push(node);
      } else {
        i += 1;
      }
    }
    return { items: out, next: i };
  }

  let firstItemIndent = -1;
  for (let i = firstItemIdx; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const ind = indentOf(raw);
    if (ind <= topFieldIndent) break;
    if (raw.slice(ind).startsWith('- ')) {
      firstItemIndent = ind;
      break;
    }
  }
  if (firstItemIndent < 0) return { template, topField, items: [] };

  const { items } = parseSiblings(firstItemIdx, firstItemIndent, '');
  return { template, topField, items };
}

function flattenByIndexPath(items: InfographicNode[], into: Map<string, InfographicNode> = new Map()) {
  for (const item of items) {
    into.set(item.indexPath, item);
    if (item.children?.length) flattenByIndexPath(item.children, into);
  }
  return into;
}

function itemFingerprint(item: InfographicNode) {
  return [item.label ?? '', item.desc ?? '', item.value ?? '', item.icon ?? '', item.illus ?? '']
    .map((s) => String(s).trim().toLowerCase())
    .join('||');
}

export function diffInfographicSources(
  previousSource: string | null | undefined,
  nextSource: string | null | undefined
) {
  const before = parseInfographicTree(previousSource ?? '');
  const after = parseInfographicTree(nextSource ?? '');
  const templateChanged = Boolean(before.template && after.template && before.template !== after.template);

  const beforeMap = flattenByIndexPath(before.items);
  const afterMap = flattenByIndexPath(after.items);

  const added = [];
  const removed = [];
  const modified = [];

  for (const [id, item] of afterMap) {
    if (!beforeMap.has(id)) {
      added.push(id);
      continue;
    }
    if (templateChanged) {
      modified.push(id);
      continue;
    }
    if (itemFingerprint(beforeMap.get(id)!) !== itemFingerprint(item)) {
      modified.push(id);
    }
  }
  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) removed.push(id);
  }

  const sort = (arr: string[]) => arr.sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    addedIds: sort(added),
    modifiedIds: sort(modified),
    removedIds: sort(removed),
    templateChanged
  };
}

export function applyInfographicHighlight(
  rootEl: Element | null | undefined,
  diff: { addedIds?: string[]; modifiedIds?: string[] } | null | undefined
) {
  if (!rootEl?.querySelectorAll) return;
  rootEl.querySelectorAll('[data-diff-state]').forEach((el: Element) => {
    el.removeAttribute('data-diff-state');
  });
  if (!diff) return;
  const added = new Set(diff.addedIds ?? []);
  const modified = new Set(diff.modifiedIds ?? []);
  if (added.size === 0 && modified.size === 0) return;
  rootEl.querySelectorAll('[data-indexes]').forEach((el: Element) => {
    const indexes = el.getAttribute('data-indexes') ?? '';
    if (added.has(indexes)) {
      el.setAttribute('data-diff-state', 'added');
    } else if (modified.has(indexes)) {
      el.setAttribute('data-diff-state', 'modified');
    }
  });
}
