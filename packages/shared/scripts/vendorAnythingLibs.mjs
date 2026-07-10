#!/usr/bin/env node
// Regenerates src/vendor/anythingLibSources.ts from the pinned npm packages in
// this workspace's devDependencies. The generated module is the ONLY place
// Anything-mode library bytes come from — markers like <!-- @lib:d3 --> are
// expanded from it at render/runtime-check time, never fetched from a network.
//
// Usage: npm run vendor:anything-libs -w packages/shared
// Run it after bumping a library's pinned version in package.json, then commit
// the regenerated file. The manifest here must stay in lockstep with the
// registry metadata in src/anythingLibs.ts (a shared test asserts they agree).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../src/vendor/anythingLibSources.ts');

const MANIFEST = [
  {
    id: 'd3',
    npmPackage: 'd3',
    distPath: 'dist/d3.min.js'
  },
  {
    id: 'matter',
    npmPackage: 'matter-js',
    distPath: 'build/matter.min.js'
  }
];

// Sequences that would terminate or corrupt an inline <script> block when the
// library source is embedded into an HTML document. The HTML parser's script
// content model ends the block at "</script" and enters escaped states on
// "<!--" / "<script", so a source containing any of these cannot be inlined
// verbatim. All current libraries are clean; if a future one is not, teach
// this script to escape it rather than weakening the assertion.
const FORBIDDEN_SEQUENCES = ['</script', '<!--', '<script'];

// Locate an installed package's root without require.resolve — modern packages
// (d3 included) do not export ./package.json through their exports map.
function findPackageRoot(npmPackage) {
  for (let dir = __dirname; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', npmPackage);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === path.dirname(dir)) {
      throw new Error(`Could not find ${npmPackage} in node_modules — is it installed?`);
    }
  }
}

function loadLib({ id, npmPackage, distPath }) {
  const packageRoot = findPackageRoot(npmPackage);
  const version = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
  ).version;
  const source = fs.readFileSync(path.join(packageRoot, distPath), 'utf8');

  const lower = source.toLowerCase();
  for (const sequence of FORBIDDEN_SEQUENCES) {
    if (lower.includes(sequence)) {
      throw new Error(
        `${npmPackage}@${version} ${distPath} contains "${sequence}" — unsafe to inline into a <script> block.`
      );
    }
  }

  return { id, npmPackage, version, source };
}

function render(libs) {
  const entries = libs
    .map(
      (lib) =>
        `  ${JSON.stringify(lib.id)}: {\n` +
        `    version: ${JSON.stringify(lib.version)},\n` +
        `    source: ${JSON.stringify(lib.source)}\n` +
        `  }`
    )
    .join(',\n');

  return `// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run vendor:anything-libs -w packages/shared
// Sources: ${libs.map((lib) => `${lib.npmPackage}@${lib.version} (npm)`).join(', ')}
// See ../anythingLibs.ts for the registry metadata and docs/decisions/0008.

export interface AnythingLibVendoredSource {
  version: string;
  source: string;
}

export const ANYTHING_LIB_SOURCES: Readonly<Record<string, AnythingLibVendoredSource>> = {
${entries}
};
`;
}

const libs = MANIFEST.map(loadLib);
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, render(libs));
console.log(
  `Wrote ${path.relative(process.cwd(), OUT_PATH)} (${libs
    .map((lib) => `${lib.id}@${lib.version}, ${Math.round(lib.source.length / 1024)}KB`)
    .join('; ')})`
);
