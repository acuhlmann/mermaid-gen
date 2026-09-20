import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MERMAID_CDN_FILE,
  MERMAID_RANGE_FILES,
  compareMermaidPins,
  majorOfCdnUrl,
  majorOfRange,
  readMermaidPins,
  verifyMermaidPins
} from './verify-mermaid-pins.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the real repo pins agree, and the sensor actually reads files (not a fixture)', () => {
  const result = verifyMermaidPins(ROOT);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('every range file exists and declares mermaid (a deleted pin must be noticed)', () => {
  const pins = readMermaidPins(ROOT);
  for (const file of MERMAID_RANGE_FILES) {
    assert.equal(
      fs.existsSync(path.join(ROOT, file)),
      true,
      `${file} disappeared — update MERMAID_RANGE_FILES`
    );
    assert.ok(pins.ranges[file], `${file} no longer declares mermaid`);
  }
});

test('packages/shared is deliberately not a pinned workspace', () => {
  // shared holds the sanitizer and the style schema but imports neither `mermaid` nor its types,
  // so it must not grow a dependency on it. This asserts the exclusion is still the right call.
  assert.ok(!MERMAID_RANGE_FILES.includes('packages/shared/package.json'));
  const shared = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/shared/package.json'), 'utf8')
  );
  assert.equal(shared.dependencies?.mermaid ?? shared.devDependencies?.mermaid, undefined);
});

test('majorOfRange reads the majors a workspace might actually declare', () => {
  for (const [range, major] of [
    ['12.0.0', '12'],
    ['^12.0.0', '12'],
    ['~12.1.3', '12'],
    ['>=12.0.0 <13', '12'],
    ['  ^12.0.0  ', '12'],
    ['v12', '12']
  ]) {
    assert.equal(majorOfRange(range), major, `expected ${JSON.stringify(range)} -> ${major}`);
  }
  assert.equal(majorOfRange('latest'), null);
  assert.equal(majorOfRange(undefined), null);
});

test('majorOfCdnUrl matches the version segment, not a lookalike path', () => {
  assert.equal(
    majorOfCdnUrl('https://cdn.jsdelivr.net/npm/mermaid@12/dist/mermaid.esm.min.mjs'),
    '12'
  );
  assert.equal(majorOfCdnUrl('https://unpkg.com/mermaid@11.17.2/dist/mermaid.esm.min.mjs'), '11');
  // A lookalike version segment and a lookalike package name must both be refused.
  assert.equal(majorOfCdnUrl('https://cdn/mermaid@12x/dist/x.mjs'), null);
  assert.equal(majorOfCdnUrl('https://cdn/chart-mermaid@12/x.mjs'), null);
  assert.equal(majorOfCdnUrl(undefined), null);
});

test('compareMermaidPins fails when the CDN major lags the npm range', () => {
  // The exact failure this sensor exists for: workspaces on 12, App HTML still fetching 11.
  const result = compareMermaidPins({
    ranges: {
      'package.json': '^12.0.0',
      'apps/web/package.json': '^12.0.0',
      'apps/server/package.json': '^12.0.0'
    },
    cdnMajor: '11'
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /mermaid@11/);
  assert.match(result.errors[0], /bump the URL's major to 12/);
  // The comment warning is load-bearing: this string lives inside a template literal.
  assert.match(result.errors[0], /template literal/);
});

test('compareMermaidPins fails when the workspaces disagree with each other', () => {
  const result = compareMermaidPins({
    ranges: {
      'package.json': '^12.0.0',
      'apps/web/package.json': '^11.17.2',
      'apps/server/package.json': '^12.0.0'
    },
    cdnMajor: '12'
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /disagrees across workspaces/);
  assert.match(result.errors.join('\n'), /apps\/web\/package\.json/);
});

test('compareMermaidPins fails on a deleted pin and on a missing CDN URL', () => {
  const missing = compareMermaidPins({
    ranges: {
      'package.json': '^12.0.0',
      'apps/web/package.json': null,
      'apps/server/package.json': '^12.0.0'
    },
    cdnMajor: '12'
  });
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join('\n'), /declares no `mermaid` dependency/);

  const noCdn = compareMermaidPins({
    ranges: {
      'package.json': '^12.0.0',
      'apps/web/package.json': '^12.0.0',
      'apps/server/package.json': '^12.0.0'
    },
    cdnMajor: null
  });
  assert.equal(noCdn.ok, false);
  assert.match(noCdn.errors.join('\n'), /has no `mermaid@<major>` CDN URL/);
});

test('readMermaidPins finds drift through the real reader, not just the comparator', () => {
  // Negative case end to end: copy the four pinned files into a temp tree, roll the CDN major back
  // one, and confirm the reader+comparator pair reports it. Proves the regex matches the file's
  // actual shape rather than a hand-written string.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-pins-'));
  try {
    for (const relative of [...MERMAID_RANGE_FILES, MERMAID_CDN_FILE]) {
      const target = path.join(dir, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(ROOT, relative), target);
    }

    assert.equal(verifyMermaidPins(dir).ok, true, 'a faithful copy must pass before we edit it');

    const cdnPath = path.join(dir, MERMAID_CDN_FILE);
    const source = fs.readFileSync(cdnPath, 'utf8');
    const lagged = source.replace(/(mermaid@)\d+/, '$19');
    assert.notEqual(lagged, source, 'fixture edit must actually change the CDN major');
    fs.writeFileSync(cdnPath, lagged);

    const result = verifyMermaidPins(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /mermaid@9/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
