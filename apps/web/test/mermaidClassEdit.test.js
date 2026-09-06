// @vitest-environment jsdom
// The last describe block renders a real classDiagram with the repo's own
// mermaid, which needs a DOM. Everything above this file's own pure-function
// tests is unaffected by the environment.
import { describe, expect, it } from 'vitest';
import mermaid from 'mermaid';
import { graphEditIdFromDescriptor } from '../src/utils/canvasGraphEdit.js';
import {
  addLinkedClassNode,
  connectClassNodes,
  deleteClassEdge,
  deleteClassNode,
  isClassFamilySource,
  parseClassRelation,
  renameClassNode
} from '../src/utils/mermaidClassEdit.js';

const SAMPLE = `classDiagram
  Animal <|-- Duck
  Animal : +int age
  Duck : +swim()
`;

describe('isClassFamilySource', () => {
  it('recognizes classDiagram headers', () => {
    expect(isClassFamilySource(SAMPLE)).toBe(true);
    expect(isClassFamilySource('flowchart TD\n  A --> B')).toBe(false);
  });
});

describe('parseClassRelation', () => {
  it('parses inheritance and association arrows', () => {
    expect(parseClassRelation('  Animal <|-- Duck')).toEqual({
      from: 'Animal',
      arrow: '<|--',
      to: 'Duck',
      label: ''
    });
    expect(parseClassRelation('  Service --> Repository')).toEqual({
      from: 'Service',
      arrow: '-->',
      to: 'Repository',
      label: ''
    });
    expect(parseClassRelation('  Service --> Repository : uses')).toEqual({
      from: 'Service',
      arrow: '-->',
      to: 'Repository',
      label: 'uses'
    });
  });

  it('does not treat member shorthand as a relation', () => {
    expect(parseClassRelation('  Animal : +int age')).toBeNull();
  });
});

describe('class diagram graph edit', () => {
  it('adds a linked class with a member stub', () => {
    const result = addLinkedClassNode(SAMPLE, 'Animal', 'Goose');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('Class1');
    expect(result.source).toMatch(/Animal --> Class1/);
    expect(result.source).toMatch(/Class1 : Goose/);
  });

  it('connects two existing classes', () => {
    const linked = connectClassNodes(SAMPLE, 'Animal', 'Duck');
    expect(linked.ok).toBe(true);
    expect(linked.source).toMatch(/Animal --> Duck/);
    expect(linked.source).toMatch(/Animal <\|-- Duck/);
    const extra = addLinkedClassNode(SAMPLE, 'Animal', 'Goose');
    const second = connectClassNodes(extra.source, 'Duck', 'Class1');
    expect(second.ok).toBe(true);
    expect(second.source).toMatch(/Duck --> Class1/);
  });

  it('deletes a class and its relations and members', () => {
    const result = deleteClassNode(SAMPLE, 'Duck');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Duck/);
    expect(result.source).toMatch(/Animal : \+int age/);
  });

  it('renames a class everywhere it appears', () => {
    const result = renameClassNode(SAMPLE, 'Duck', 'Mallard');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('Mallard');
    expect(result.source).toMatch(/Animal <\|-- Mallard/);
    expect(result.source).toMatch(/Mallard : \+swim\(\)/);
    expect(result.source).not.toMatch(/Duck/);
  });

  it('refuses duplicate rename targets', () => {
    expect(renameClassNode(SAMPLE, 'Duck', 'Animal')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('deletes one parallel relation when two exist', () => {
    const parallel = `classDiagram
  Service --> Repository
  Service --> Repository
`;
    const result = deleteClassEdge(parallel, 'Service', 'Repository', undefined, 1);
    expect(result.ok).toBe(true);
    expect(result.source.match(/Service --> Repository/g)?.length).toBe(1);
  });

  it('deletes and renames through labeled relations', () => {
    const labeled = `classDiagram
  class Service {
    +run()
  }
  class Repository {
    +store()
  }
  Service --> Repository : uses
`;
    const deleted = deleteClassNode(labeled, 'Service');
    expect(deleted.ok).toBe(true);
    expect(deleted.source).not.toMatch(/Service/);

    const renamed = renameClassNode(labeled, 'Repository', 'Repo');
    expect(renamed.ok).toBe(true);
    expect(renamed.source).toMatch(/Service --> Repo : uses/);
    expect(renamed.source).toMatch(/class Repo \{/);
    expect(renamed.source).not.toMatch(/\bRepository\b/);
  });
});

/**
 * The ids the canvas actually hands the mutators, taken from a rendered
 * classDiagram rather than written by hand.
 *
 * Every test above calls the mutators with a clean id (`'Duck'`), which is what
 * made the real defect invisible: mermaid's class renderer stamps each box
 * `classId-<name>-<index>` and emits **no `data-id`**, so the selection path
 * produced `classId-Duck`, `CLASS_ID_RE` rejected the hyphen, and every class
 * Add / Rename / Delete / Connect answered `bad-id` — an error toast on any
 * click, on any class diagram. The whole family has been broken since 11.16
 * moved classDiagram to the v3 unified renderer, and no test in the repo had
 * ever looked at a rendered class id (`grep classId- apps/` returned nothing).
 *
 * So this asserts the pipeline, not the helper: render, read the DOM id off the
 * live SVG, feed it through `graphEditIdFromDescriptor` exactly as a tap does,
 * and require the mutator to succeed. A future mermaid version that changes the
 * stamping fails here instead of failing in front of a user.
 */
describe('class ids as the canvas really receives them', () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', htmlLabels: false });

  // jsdom ships no SVG layout engine and mermaid's class renderer measures
  // text; a text-length stand-in is enough to reach render() intact, and ids
  // are the only thing read back.
  const elProto = window.SVGElement ? window.SVGElement.prototype : window.Element.prototype;
  if (!elProto.getBBox) {
    elProto.getBBox = function getBBox() {
      const text = this.textContent ?? '';
      return { x: 0, y: 0, width: Math.max(8, text.length * 8), height: 14 };
    };
  }
  if (!elProto.getComputedTextLength) {
    elProto.getComputedTextLength = function () {
      return (this.textContent ?? '').length * 8;
    };
  }

  /** Every rendered class node, as `{ id, dataId }`, the way the click sees it. */
  async function renderedNodes(source, tag) {
    const { svg } = await mermaid.render(`diagram-${tag}`, source);
    const host = document.createElement('div');
    host.innerHTML = svg;
    return [...host.querySelectorAll('g.node')].map((node) => ({
      id: node.id,
      dataId: node.getAttribute('data-id')
    }));
  }

  it('renders a node per class, and stamps it with no data-id', async () => {
    const nodes = await renderedNodes('classDiagram\n  Animal <|-- Duck\n', '11');
    expect(nodes.length).toBe(2);
    for (const node of nodes) {
      expect(node.id).toMatch(/^diagram-11-classId-(Animal|Duck)-\d+$/);
      // The absence is the point: the cluster/namespace path does emit one, and
      // a future mermaid that starts stamping `data-id` here changes which
      // branch resolves the id.
      expect(node.dataId).toBe(null);
    }
  });

  it('resolves a clicked class node to the clean id the mutators want', async () => {
    const nodes = await renderedNodes('classDiagram\n  Animal <|-- Duck\n', '12');
    const duck = nodes.find((node) => /Duck/.test(node.id));
    expect(duck).toBeTruthy();
    const resolved = graphEditIdFromDescriptor({
      kind: 'node',
      id: duck.id,
      dataId: duck.dataId,
      partName: 'Duck'
    });
    expect(resolved).toBe('Duck');
  });

  it('renames and deletes through the id a real tap produces', async () => {
    const source = `classDiagram
  Animal <|-- Duck
  Animal : +int age
  Duck : +swim()
`;
    const nodes = await renderedNodes(source, '13');
    for (const node of nodes) {
      const id = graphEditIdFromDescriptor({
        kind: 'node',
        id: node.id,
        dataId: node.dataId,
        partName: null
      });
      expect(['Animal', 'Duck']).toContain(id);
      const renamed = renameClassNode(source, id, 'Renamed');
      expect(renamed.ok, `rename from rendered id ${node.id} (${id})`).toBe(true);
      expect(renamed.source).toMatch(/Renamed/);
      const deleted = deleteClassNode(source, id);
      expect(deleted.ok, `delete from rendered id ${node.id} (${id})`).toBe(true);
    }
  });

  it('edits a body-less declaration, which mermaid renders as a real node', async () => {
    // The case #575 was filed for: `class Duck` with no braces and no relation
    // is valid Mermaid and renders a clickable box, but `collectClassIds` only
    // learned names from braced opens, relation ends, members and `<<stereo>>`
    // lines — so Rename/Delete answered `missing` on a node the user could see.
    const nodes = await renderedNodes('classDiagram\n  class Duck\n', '14');
    expect(nodes.length).toBe(1);
    const id = graphEditIdFromDescriptor({
      kind: 'node',
      id: nodes[0].id,
      dataId: nodes[0].dataId,
      partName: 'Duck'
    });
    expect(id).toBe('Duck');
    const renamed = renameClassNode('classDiagram\n  class Duck\n', id, 'Mallard');
    expect(renamed.ok, `rename from rendered id ${nodes[0].id} (${id})`).toBe(true);
    expect(renamed.source).toContain('class Mallard');
    expect(renamed.source).not.toMatch(/\bDuck\b/);
  });
});

describe('body-less class declarations (#575)', () => {
  const BARE = 'classDiagram\n  class Duck\n';

  it('renames one and keeps the line indented', () => {
    expect(renameClassNode(BARE, 'Duck', 'Mallard')).toMatchObject({
      ok: true,
      source: 'classDiagram\n  class Mallard\n'
    });
  });

  it('deletes one', () => {
    const result = deleteClassNode(BARE, 'Duck');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Duck/);
  });

  it('accepts one as an anchor for Connect and Add', () => {
    const connected = connectClassNodes(`${BARE}  class Goose\n`, 'Duck', 'Goose');
    expect(connected.ok).toBe(true);
    expect(connected.source).toMatch(/Duck --> Goose/);
    const added = addLinkedClassNode(BARE, 'Duck', 'Eggs');
    expect(added.ok).toBe(true);
    expect(typeof added.newId).toBe('string');
    expect(added.newId).not.toBe('Duck');
    expect(added.source).toMatch(new RegExp(`Duck --> ${added.newId}`));
  });

  it('does NOT mistake the styling form or the header for a declaration', () => {
    // `class A hot` assigns a class to existing nodes rather than declaring one,
    // and `classDiagram` is the directive. Accepting either would invent class
    // names — `hot`, `Diagram` — that no rendered box represents, and `hot` in
    // particular is a user-chosen classDef name.
    const styled = 'classDiagram\n  class Animal\n  class Animal hot\n  classDef hot fill:red';
    expect(renameClassNode(styled, 'hot', 'Warm').ok).toBe(false);
    expect(deleteClassNode(styled, 'hot').ok).toBe(false);
    // The real declaration in the same document stays editable, and the styling
    // line that refers to it is rewritten with it rather than orphaned.
    const renamed = renameClassNode(styled, 'Animal', 'Pet');
    expect(renamed.ok).toBe(true);
    expect(renamed.source).toMatch(/class Pet/);
  });
});
