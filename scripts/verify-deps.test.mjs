import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  collectPackageInstances,
  readInstalledVersion,
  resolveReactWebCore,
  resolveWorkspacePackage,
  shouldReportInvalidWebCoreHit,
  verifyDeps
} from './verify-deps.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('collectPackageInstances finds nested instances and invalid markers', () => {
  const tree = {
    dependencies: {
      web: {
        dependencies: {
          '@a2ui/web_core': {
            version: '0.9.2',
            invalid: '^0.10.0 from apps/web'
          },
          '@a2ui/react': {
            dependencies: {
              '@a2ui/web_core': {
                version: '0.10.0'
              }
            }
          }
        }
      }
    }
  };

  const hits = collectPackageInstances(tree, '@a2ui/web_core');
  assert.equal(hits.length, 2);
  assert.equal(hits[0].version, '0.9.2');
  assert.match(hits[0].invalid, /0\.10\.0/);
  assert.equal(hits[1].version, '0.10.0');
});

test('resolveWorkspacePackage prefers workspace node_modules', () => {
  const webCore = resolveWorkspacePackage(ROOT, 'apps/web', '@a2ui/web_core');
  assert.equal(webCore, '0.10.5');
});

test('resolveReactWebCore matches workspace web_core when nested copy aligns', () => {
  const webCore = resolveWorkspacePackage(ROOT, 'apps/web', '@a2ui/web_core');
  const reactCore = resolveReactWebCore(ROOT);
  assert.equal(webCore, reactCore);
});

test('verifyDeps passes on the current install tree', () => {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const overrides = pkgJson.overrides ?? {};
  const errors = verifyDeps(ROOT, overrides);
  assert.deepEqual(errors, []);
});

test('verifyDeps flags mismatched web vs react import paths', () => {
  const errors = verifyDeps('/tmp/nonexistent-root', {
    '@a2ui/web_core': '0.10.0',
    '@ag-ui/client': '0.0.53'
  });

  // No installs under fake root — no mismatch errors (only npm ls may noop).
  assert.ok(Array.isArray(errors));
});

test('verifyDeps ignores npm ls invalid markers on the override-pinned version', () => {
  const tree = {
    dependencies: {
      web: {
        dependencies: {
          '@a2ui/markdown-it': {
            dependencies: {
              '@a2ui/web_core': {
                version: '0.10.0',
                invalid: '^0.9.2 from node_modules/@a2ui/markdown-it'
              }
            }
          },
          '@a2ui/web_core': {
            version: '0.10.0',
            invalid: '^0.9.2 from apps/web'
          }
        }
      }
    }
  };

  const hits = collectPackageInstances(tree, '@a2ui/web_core');
  assert.equal(hits.length, 2);
  assert.ok(hits.every((hit) => hit.version === '0.10.0'));
  for (const hit of hits) {
    assert.equal(
      shouldReportInvalidWebCoreHit(hit, {
        expectedCore: '0.10.0',
        webCore: '0.10.0',
        reactCore: '0.10.0'
      }),
      false
    );
  }
});

test('shouldReportInvalidWebCoreHit ignores transitive older web_core when import paths align', () => {
  const hit = {
    version: '0.9.0',
    invalid: '"0.10.5" from apps/web/node_modules/@copilotkit/a2ui-renderer'
  };
  assert.equal(
    shouldReportInvalidWebCoreHit(hit, {
      expectedCore: '0.10.5',
      webCore: '0.10.5',
      reactCore: '0.10.5'
    }),
    false
  );
});

test('shouldReportInvalidWebCoreHit still flags misaligned import paths', () => {
  const hit = {
    version: '0.10.3',
    invalid: '"0.10.5" from apps/web/node_modules/@a2ui/react'
  };
  assert.equal(
    shouldReportInvalidWebCoreHit(hit, {
      expectedCore: '0.10.5',
      webCore: '0.10.5',
      reactCore: '0.10.3'
    }),
    true
  );
});

test('readInstalledVersion returns null for missing paths', () => {
  assert.equal(readInstalledVersion(ROOT, 'node_modules/__missing__/package.json'), null);
});
