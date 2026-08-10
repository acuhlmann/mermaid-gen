import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = path.join(ROOT, 'test');
const SELF = fileURLToPath(import.meta.url);

/**
 * A `vi.mock` whose specifier resolves nowhere is a **silent** no-op: vitest
 * does not raise, the real module runs, and the suite keeps passing — for the
 * wrong reason. `useOfficeRunReactions.test.js` shipped three of them written
 * as `../utils/…` instead of `../src/utils/…`, and nothing noticed because its
 * assertion at the time was "does not throw".
 *
 * This is the sensor for that class (docs/agents/sensors.md): every relative
 * mock specifier under `apps/web/test/` must point at a file that exists.
 *
 * Only relative specifiers are checked. A bare specifier is a package mock
 * (`vi.mock('react-dom')`) and resolves through node_modules, which is not a
 * path this check can meaningfully second-guess.
 */

/** Extensions vitest/Vite will try for an extensionless or directory specifier. */
const CANDIDATE_SUFFIXES = [
  '',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '/index.js',
  '/index.jsx',
  '/index.ts',
  '/index.tsx'
];

/**
 * TypeScript's ESM convention is to import `./x.js` and mean `./x.ts`, and Vite
 * resolves exactly that. So a `.js` specifier landing on a real `.ts` file is a
 * LIVE mock, not a dead one — without this mapping every leaf converted by
 * docs/recipes/convert-js-leaf-to-ts.md would report as broken.
 *
 * @param {string} base absolute path built from the specifier
 * @returns {string[]}
 */
function resolutionCandidates(base) {
  const bases = [base];
  const ext = path.extname(base);
  if (ext === '.js') bases.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
  if (ext === '.jsx') bases.push(`${base.slice(0, -4)}.tsx`);
  return bases.flatMap((b) => CANDIDATE_SUFFIXES.map((suffix) => b + suffix));
}

/** @param {string} dir @returns {string[]} */
function testFilesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...testFilesUnder(full));
    } else if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(entry.name) && full !== SELF) {
      out.push(full);
    }
  }
  return out;
}

describe('vi.mock specifiers resolve', () => {
  it('every relative vi.mock path in apps/web/test points at a real file', () => {
    const files = testFilesUnder(TEST_DIR);
    // Guards the guard: a walk that silently matches nothing would pass forever.
    expect(files.length).toBeGreaterThan(50);

    /** @type {string[]} */
    const dead = [];
    let checked = 0;

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const pattern = /vi\.(?:mock|doMock)\(\s*(['"])([^'"]+)\1/g;
      let match;
      while ((match = pattern.exec(src))) {
        const specifier = match[2];
        if (!specifier.startsWith('.')) continue;
        checked += 1;
        const base = path.resolve(path.dirname(file), specifier);
        const resolved = resolutionCandidates(base).some(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        );
        if (!resolved) {
          const line = src.slice(0, match.index).split('\n').length;
          dead.push(`${path.relative(ROOT, file)}:${line} -> ${specifier}`);
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(
      dead,
      `vi.mock specifiers that resolve nowhere (they silently no-op):\n${dead.join('\n')}`
    ).toEqual([]);
  });
});
