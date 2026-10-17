#!/usr/bin/env node
/**
 * Verify the Mermaid version pins agree.
 *
 * Mermaid's version is declared in four places, and only three of them are a dependency:
 *
 *   - `package.json`, `apps/web/package.json`, `apps/server/package.json` (the npm range)
 *   - `apps/server/src/mcp/apps/mcpAppDiagramPreview.js` -> `MERMAID_CDN` (a *second copy of the
 *     library*, fetched from a CDN by external MCP Apps agents at render time)
 *
 * The CDN one is the hazard. It is invisible to `npm`, so a major bump that moves the three
 * package.jsons and misses the URL leaves the server gate accepting grammar the App cannot parse —
 * and nothing fails loudly, because the two are never compared. The 11 -> 12 upgrade is exactly
 * that edit, which is why this check exists: the coupling should not depend on whoever did the
 * bump having noticed it.
 *
 * Exposed as pure functions so the drift is enforced as a test too (`test:scripts`), which is what
 * selects it under `test:affected`.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** package.jsons that must declare mermaid with the *same* range. */
export const MERMAID_RANGE_FILES = [
  'package.json',
  'apps/web/package.json',
  'apps/server/package.json'
];

export const MERMAID_CDN_FILE = 'apps/server/src/mcp/apps/mcpAppDiagramPreview.js';

/**
 * A version range's major, or null when the string is not a range we can read.
 * Accepts `12.0.0`, `^12.0.0`, `~12.1`, `>=12.0.0 <13`, `v12`.
 */
export function majorOfRange(range) {
  if (typeof range !== 'string') return null;
  const match = range.trim().match(/^[~^>=<\sv]*\s*(\d+)/);
  return match ? match[1] : null;
}

/** The major in a `.../mermaid@12/...` style CDN URL, or null when there is none. */
export function majorOfCdnUrl(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/[/@]mermaid@(\d+)(?:[/.]|$)/);
  return match ? match[1] : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** @returns {{ ranges: Record<string, string|null>, cdnMajor: string|null, cdnUrl: string|null }} */
export function readMermaidPins(root) {
  const ranges = {};
  for (const relative of MERMAID_RANGE_FILES) {
    const filePath = path.join(root, relative);
    if (!fs.existsSync(filePath)) {
      ranges[relative] = null;
      continue;
    }
    const pkg = readJson(filePath);
    const declared =
      (pkg.dependencies && pkg.dependencies.mermaid) ||
      (pkg.devDependencies && pkg.devDependencies.mermaid) ||
      (pkg.peerDependencies && pkg.peerDependencies.mermaid) ||
      null;
    ranges[relative] = declared;
  }

  const cdnPath = path.join(root, MERMAID_CDN_FILE);
  if (!fs.existsSync(cdnPath)) {
    return { ranges, cdnMajor: null, cdnUrl: null };
  }
  const source = fs.readFileSync(cdnPath, 'utf8');
  const urlMatch = source.match(/mermaid@(\d+)[^"'`\s]*/);
  return {
    ranges,
    cdnMajor: urlMatch ? urlMatch[1] : null,
    cdnUrl: urlMatch ? urlMatch[0] : null
  };
}

/**
 * @param {{ranges: Record<string, string|null>, cdnMajor: string|null}} pins
 * @returns {{ok: boolean, errors: string[]}}
 */
export function compareMermaidPins(pins) {
  const errors = [];
  const { ranges, cdnMajor } = pins;

  /** @type {Array<{file: string, major: string}>} */
  const readables = [];
  for (const [file, range] of Object.entries(ranges)) {
    if (range === null || range === undefined) {
      errors.push(
        `${file} declares no \`mermaid\` dependency. Either restore it, or drop it from ` +
          'MERMAID_RANGE_FILES in scripts/verify-mermaid-pins.mjs with a comment saying why.'
      );
      continue;
    }
    const major = majorOfRange(range);
    if (major === null) {
      errors.push(`${file} declares mermaid: "${range}" — not a version range this can read.`);
      continue;
    }
    readables.push({ file, major, range });
  }

  const distinctRanges = new Set(readables.map((entry) => entry.range));
  if (distinctRanges.size > 1) {
    errors.push(
      `The mermaid npm range disagrees across workspaces: ` +
        readables.map((e) => `${e.file} = "${e.range}"`).join(', ') +
        `. Every workspace must request the same range, or npm installs several copies of the ` +
        'library and the renderers diverge. Set them all to one value.'
    );
  }

  const majors = new Set(readables.map((entry) => entry.major));
  if (majors.size > 1) {
    errors.push(
      `The mermaid major differs across workspaces (${[...majors].join(', ')}) even after the ` +
        'range check — one of the ranges is a different major. Align them.'
    );
  }

  if (cdnMajor === null) {
    errors.push(
      `${MERMAID_CDN_FILE} has no \`mermaid@<major>\` CDN URL, and this file is expected to carry ` +
        'one. If the App stopped loading Mermaid from a CDN, delete MERMAID_CDN_FILE from this ' +
        'sensor and say why here.'
    );
  } else if (majors.size === 1) {
    const [expected] = [...majors];
    if (cdnMajor !== expected) {
      errors.push(
        `${MERMAID_CDN_FILE} fetches mermaid@${cdnMajor} from the CDN while the workspaces depend ` +
          `on ${expected}.x. External MCP Apps agents would render ${cdnMajor} grammar that the ` +
          `server gate validates against ${expected} — bump the URL's major to ${expected}. This ` +
          'string lives inside a template literal, so write the digit only: no backticks in the ' +
          'comment above it, or the HTML string breaks.'
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export function verifyMermaidPins(root) {
  return compareMermaidPins(readMermaidPins(root));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { ok, errors } = verifyMermaidPins(root);
  if (!ok) {
    console.error('verify:mermaid-pins: the Mermaid version pins disagree\n');
    for (const error of errors) console.error(`  ${error}\n`);
    process.exitCode = 1;
  } else {
    const pins = readMermaidPins(root);
    console.log(
      `verify:mermaid-pins: OK (${MERMAID_RANGE_FILES.length} ranges at ` +
        `${pins.ranges['package.json']}, MCP App CDN at mermaid@${pins.cdnMajor})`
    );
  }
}
