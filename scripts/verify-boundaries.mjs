#!/usr/bin/env node
/**
 * Workspace import-boundary check. Module hygiene is good today but undefended;
 * this script fails CI if a workspace reaches sideways into another workspace's
 * source instead of going through `@archislop/shared` or a published package.
 *
 * Rules:
 * - `packages/shared` MUST be a leaf. No imports from `apps/*`.
 * - `apps/web` MUST NOT import from `apps/server`.
 * - `apps/server` MUST NOT import from `apps/web`.
 *
 * Cross-app sharing is the job of `packages/shared` (Zod schemas, pure utils).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/** Workspaces with their forbidden import roots. */
const RULES = [
  {
    workspace: 'packages/shared',
    forbidPrefixes: ['../../apps/'],
    label: 'packages/shared imports from apps/* (shared must be a leaf)'
  },
  {
    workspace: 'apps/web',
    forbidPrefixes: ['../../apps/server/', '../../../apps/server/'],
    label: 'apps/web imports from apps/server (must go through @archislop/shared)'
  },
  {
    workspace: 'apps/server',
    forbidPrefixes: ['../../apps/web/', '../../../apps/web/'],
    label: 'apps/server imports from apps/web (must go through @archislop/shared)'
  }
];

const IMPORT_RE = /\b(?:import|from)\s+['"]([^'"]+)['"]/g;

function listFiles(workspace) {
  const out = spawnSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      `${workspace}/src/**/*.{js,jsx,ts,tsx,mjs,cjs}`,
      `${workspace}/src/**/*.js`,
      `${workspace}/src/**/*.jsx`,
      `${workspace}/src/**/*.ts`,
      `${workspace}/src/**/*.tsx`
    ],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  if (out.status !== 0) {
    throw new Error(`git ls-files failed for ${workspace}: ${out.stderr}`);
  }
  return Array.from(new Set(out.stdout.split('\n').filter(Boolean)));
}

async function scanFile(filePath, rule) {
  const text = await readFile(resolve(repoRoot, filePath), 'utf8');
  const violations = [];
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    const spec = match[1];
    if (!spec.startsWith('.')) continue; // package import — bare specifiers are fine
    for (const prefix of rule.forbidPrefixes) {
      if (spec.startsWith(prefix)) {
        violations.push({ file: filePath, spec });
        break;
      }
    }
  }
  return violations;
}

async function main() {
  let totalViolations = 0;
  for (const rule of RULES) {
    const files = listFiles(rule.workspace);
    for (const file of files) {
      const violations = await scanFile(file, rule);
      for (const v of violations) {
        totalViolations += 1;
        console.error(`✖ ${rule.label}`);
        console.error(`  ${relative(repoRoot, v.file)}: import '${v.spec}'`);
      }
    }
  }
  if (totalViolations > 0) {
    console.error(`\nverify-boundaries: ${totalViolations} violation(s).`);
    process.exit(1);
  }
  console.log('verify-boundaries: OK');
}

main().catch((err) => {
  console.error('verify-boundaries: unexpected error');
  console.error(err);
  process.exit(2);
});
