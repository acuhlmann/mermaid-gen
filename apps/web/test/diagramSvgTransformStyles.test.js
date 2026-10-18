import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression guard for Mermaid diagrams rendering as "edges only".
//
// Mermaid (and AntV) place every node with an SVG `transform="translate(x,y)"`
// attribute. A CSS `transform` on the same element — a declaration, or a keyframe
// animation, where even `transform: none` is held forever by `fill-mode: both` —
// replaces that attribute, so the node is drawn at the SVG origin. That is how
// `diagram-node-pop-in` once stacked every node in the clipped top-left corner
// while edge paths (absolute coordinates) stayed put. The individual `translate` /
// `scale` / `rotate` properties compose with the attribute and are always safe.
const srcDir = fileURLToPath(new URL('../src', import.meta.url));

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(full);
    return entry.name.endsWith('.css') ? [full] : [];
  });
}

const sheets = cssFiles(srcDir).map((file) => ({
  file: file.slice(srcDir.length + 1),
  css: readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
}));

const SETS_TRANSFORM = /(^|[\s;{])transform\s*:/;

/** Keyframe names whose frames set the `transform` property. */
function transformKeyframes() {
  const names = new Set();
  for (const { css } of sheets) {
    for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
      let depth = 1;
      let i = match.index + match[0].length;
      while (depth > 0 && i < css.length) {
        if (css[i] === '{') depth += 1;
        if (css[i] === '}') depth -= 1;
        i += 1;
      }
      if (SETS_TRANSFORM.test(css.slice(match.index + match[0].length, i))) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

// Selectors that reach inside a rendered diagram: anything below an `svg`, or the
// node groups the canvas annotates. The root `svg` itself carries no transform
// attribute, so pan/zoom on it is fine and is deliberately not matched.
const DIAGRAM_SVG_CONTENT = /\bsvg\s+[^,]|\bg\.(node|cluster|timeline-node)\b|\[data-node-fade/;

function diagramRules() {
  const rules = [];
  for (const { file, css } of sheets) {
    for (const match of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const selector = match[1].trim().replace(/\s+/g, ' ');
      if (DIAGRAM_SVG_CONTENT.test(selector)) {
        rules.push({ file, selector, body: match[2] });
      }
    }
  }
  return rules;
}

describe('CSS on diagram SVG content', () => {
  it('finds the node pop-in rule (guards the scan itself)', () => {
    expect(diagramRules().some((rule) => rule.selector.includes('[data-node-fade'))).toBe(true);
  });

  it('never sets `transform`, which would override Mermaid node placement', () => {
    const offenders = diagramRules()
      .filter((rule) => SETS_TRANSFORM.test(rule.body))
      .map((rule) => `${rule.file}: ${rule.selector}`);
    expect(offenders).toEqual([]);
  });

  it('never plays a keyframe animation that sets `transform`', () => {
    const animated = transformKeyframes();
    expect(animated.size).toBeGreaterThan(0);
    const offenders = diagramRules().flatMap((rule) => {
      const animation = rule.body.match(/animation(?:-name)?\s*:\s*([^;]+)/);
      if (!animation) return [];
      return (animation[1].match(/[\w-]+/g) ?? [])
        .filter((name) => animated.has(name))
        .map((name) => `${rule.file}: ${rule.selector} -> ${name}`);
    });
    expect(offenders).toEqual([]);
  });
});
