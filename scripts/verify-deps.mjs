#!/usr/bin/env node
/**
 * Verify npm override pins and singleton packages that break TypeScript when duplicated.
 *
 * Catches the @a2ui/web_core split-install bug: app code imports MessageProcessor from
 * the workspace-resolved @a2ui/web_core while @a2ui/react resolves basicCatalog types
 * from a nested copy under node_modules/@a2ui/react.
 *
 * Agent fix is printed on failure — see docs/agents/sensors.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** Workspace that imports @a2ui/web_core and @a2ui/react in the same components. */
const WEB_WORKSPACE = 'apps/web';

/** Direct deps in apps/web that must match root package.json overrides. */
const WEB_OVERRIDE_PACKAGES = ['@a2ui/web_core', '@ag-ui/client'];

/**
 * @param {string} pkg
 * @param {string} expected
 * @param {string} [workspace]
 */
function fixInstallCommand(pkg, expected, workspace = WEB_WORKSPACE) {
  return `npm install ${pkg}@${expected} -w ${workspace} && npm run verify:deps && commit package-lock.json`;
}

/**
 * @param {string} root
 * @param {string} relPath
 */
export function readInstalledVersion(root, relPath) {
  const file = path.join(root, relPath);
  if (!fs.existsSync(file)) return null;
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return typeof json.version === 'string' ? json.version : null;
  } catch {
    return null;
  }
}

/**
 * npm resolution order for a workspace package: local node_modules, then root.
 * @param {string} root
 * @param {string} workspace
 * @param {string} pkg
 */
export function resolveWorkspacePackage(root, workspace, pkg) {
  return (
    readInstalledVersion(root, `${workspace}/node_modules/${pkg}/package.json`) ??
    readInstalledVersion(root, `node_modules/${pkg}/package.json`)
  );
}

/**
 * Version @a2ui/react binds for catalog types (nested copy or hoisted fallback).
 * @param {string} root
 */
export function resolveReactWebCore(root) {
  return (
    readInstalledVersion(root, 'node_modules/@a2ui/react/node_modules/@a2ui/web_core/package.json') ??
    readInstalledVersion(root, 'node_modules/@a2ui/web_core/package.json') ??
    readInstalledVersion(root, `${WEB_WORKSPACE}/node_modules/@a2ui/web_core/package.json`)
  );
}

/**
 * Walk npm ls --json tree and collect { version, invalid } for a package name.
 * @param {unknown} node
 * @param {string} pkgName
 * @returns {{ version: string, invalid?: string }[]}
 */
export function collectPackageInstances(node, pkgName) {
  /** @type {{ version: string, invalid?: string }[]} */
  const hits = [];
  if (!node || typeof node !== 'object') return hits;

  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (node);

  const deps = record.dependencies;
  if (deps && typeof deps === 'object') {
    /** @type {Record<string, { version?: string, invalid?: string }>} */
    const depMap = /** @type {Record<string, { version?: string, invalid?: string }>} */ (deps);
    const direct = depMap[pkgName];
    if (direct && typeof direct.version === 'string') {
      hits.push({
        version: direct.version,
        invalid: typeof direct.invalid === 'string' ? direct.invalid : undefined
      });
    }
    for (const child of Object.values(depMap)) {
      hits.push(...collectPackageInstances(child, pkgName));
    }
  }

  return hits;
}

/**
 * @param {string} root
 * @param {Record<string, string>} overrides
 */
export function verifyDeps(root, overrides) {
  /** @type {string[]} */
  const errors = [];

  for (const pkg of WEB_OVERRIDE_PACKAGES) {
    const expected = overrides[pkg];
    if (!expected) continue;

    const resolved = resolveWorkspacePackage(root, WEB_WORKSPACE, pkg);
    if (resolved && resolved !== expected) {
      errors.push(
        [
          `verify:deps: ${pkg} resolves to ${resolved} for ${WEB_WORKSPACE} but overrides pin ${expected}.`,
          `  Fix: ${fixInstallCommand(pkg, expected)}`
        ].join('\n')
      );
    }
  }

  const webCore = resolveWorkspacePackage(root, WEB_WORKSPACE, '@a2ui/web_core');
  const reactCore = resolveReactWebCore(root);
  const expectedCore = overrides['@a2ui/web_core'];

  if (webCore && reactCore && webCore !== reactCore) {
    errors.push(
      [
        `verify:deps: @a2ui/web_core versions used by ${WEB_WORKSPACE} imports are mismatched:`,
        `    ${WEB_WORKSPACE} import path → ${webCore}`,
        `    @a2ui/react nested import path → ${reactCore}`,
        `  TypeScript treats these as incompatible types when imported from @a2ui/web_core and @a2ui/react in the same file.`,
        `  Fix: ${fixInstallCommand('@a2ui/web_core', expectedCore ?? reactCore)}`
      ].join('\n')
    );
  }

  const ls = spawnSync('npm', ['ls', '@a2ui/web_core', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: false
  });

  if (ls.stdout) {
    try {
      const tree = JSON.parse(ls.stdout);
      for (const hit of collectPackageInstances(tree, '@a2ui/web_core')) {
        if (hit.invalid) {
          errors.push(
            [
              `verify:deps: npm ls marks @a2ui/web_core@${hit.version} as invalid (${hit.invalid}).`,
              `  Fix: ${fixInstallCommand('@a2ui/web_core', expectedCore ?? '0.10.0')}`
            ].join('\n')
          );
        }
      }
    } catch {
      // npm ls may emit partial JSON on some failures; physical path checks above are primary.
    }
  }

  return errors;
}

function main() {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const overrides = pkgJson.overrides ?? {};

  if (Object.keys(overrides).length === 0) {
    console.log('verify:deps: no overrides configured; skipping');
    return;
  }

  const errors = verifyDeps(ROOT, overrides);
  if (errors.length === 0) {
    console.log(
      `verify:deps: OK (${WEB_OVERRIDE_PACKAGES.length} workspace override(s), @a2ui/web_core singleton)`
    );
    return;
  }

  console.error(errors.join('\n\n'));
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
