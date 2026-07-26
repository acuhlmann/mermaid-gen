/**
 * Map a git diff to the smallest useful automated test set for coding agents.
 * Used by `npm run test:affected` and `check:affected`.
 */
import fs from 'node:fs';
import path from 'node:path';

/** @typedef {'shared' | 'server' | 'web' | 'scripts'} TestWorkspace */

/**
 * Server tests that spawn jsdom child processes (~0.8–2s each).
 * Skipped by `test:fast` unless Anything paths appear in the diff.
 */
export const SERVER_SLOW_TEST_FILES = [
  'apps/server/test/anythingRuntimeCheck.test.js',
  'apps/server/test/anythingLangChainAgent.test.js',
  'apps/server/test/anythingHtmlTool.test.js'
];

export const WIRE_TEST_FILES = [
  'packages/shared/test/wireRoundTrip.test.ts',
  'apps/server/test/wireEmitterRoundTrip.test.js',
  'apps/web/test/wireAgUiTranslator.test.js'
];

/**
 * Full isometric-mode regression set. Pulled when floor source changes even if
 * basename mirror misses a sibling test file. Keep in sync with
 * `docs/agents/isometric-floor-tests.md`.
 */
export const ISOMETRIC_FLOOR_BLAST_TESTS = [
  'apps/web/test/officeFloor.test.jsx',
  'apps/web/test/officeFloorAccess.test.jsx',
  'apps/web/test/officeFloorArrival.test.jsx',
  'apps/web/test/officeFloorContracts.test.js',
  'apps/web/test/officeFloorMeeting.test.jsx',
  'apps/web/test/officeFloorMovement.test.js',
  'apps/web/test/officeFloorModuleInventory.test.js',
  'apps/web/test/officeFloorPeek.test.jsx',
  'apps/web/test/officeFloorPlan.test.js',
  'apps/web/test/officeFloorProps.test.jsx',
  'apps/web/test/officeFloorPropsTable.test.js',
  'apps/web/test/officeFloorReach.test.js',
  'apps/web/test/officeFloorRoam.test.jsx',
  'apps/web/test/officeFloorScene.test.jsx',
  'apps/web/test/officeFloorStyles.test.js',
  'apps/web/test/officeFloorTalk.test.jsx',
  'apps/web/test/officeFloorWander.test.jsx',
  'apps/web/test/officeLayerFloorRenderer.test.jsx',
  'apps/web/test/officeDeskWork.test.js',
  'apps/web/test/useWalkAnimation.test.jsx'
];

/**
 * Prefix → extra tests beyond the basename mirror rule.
 * Keep in sync with `docs/agent-blast-radius.md`.
 * @type {Array<{ match: RegExp, tests: string[] }>}
 */
export const BLAST_RADIUS_RULES = [
  {
    match:
      /packages\/shared\/src\/(diagramSchema|legacyStreamEvents|agUiWireConstants|agentStreamEmitter)/,
    tests: [
      'packages/shared/test/diagramSchema.test.ts',
      'packages/shared/test/wireRoundTrip.test.ts',
      'apps/server/test/copilotRoute.test.js',
      'apps/web/test/wireAgUiTranslator.test.js'
    ]
  },
  {
    match: /apps\/server\/src\/routes\/copilot/,
    tests: ['apps/server/test/copilotRoute.test.js', 'packages/shared/test/diagramSchema.test.ts']
  },
  {
    match: /apps\/server\/src\/agents\/diagramAgentDispatcher/,
    tests: ['apps/server/test/diagramAgentDispatcher.test.js']
  },
  {
    match: /apps\/server\/src\/state\/sessionEventBus/,
    tests: ['apps/server/test/sessionEventBus.test.js', 'apps/web/test/sessionEventsClient.test.js']
  },
  {
    match:
      /apps\/web\/src\/state\/(sessionEventsClient|agUiTranslator|applyAgentStreamInsightEvent)/,
    tests: [
      'apps/web/test/sessionEventsClient.test.js',
      'apps/web/test/wireAgUiTranslator.test.js',
      'apps/web/test/applyAgentStreamInsightEvent.test.js'
    ]
  },
  {
    match: /apps\/server\/src\/mcp\//,
    tests: ['apps/server/test/mcpServer.test.js']
  },
  {
    match: /packages\/shared\/src\/mermaidSanitizer/,
    tests: ['packages/shared/test/mermaidSanitizer.test.ts']
  },
  {
    match: /packages\/shared\/src\/formsA2ui/,
    tests: [
      'packages/shared/test/formsA2ui.test.ts',
      'apps/server/test/formsA2uiTool.test.js',
      'apps/server/test/formsLangChainAgent.test.js'
    ]
  },
  {
    match: /packages\/shared\/src\/chartSchema/,
    tests: [
      'packages/shared/test/chartSchema.test.ts',
      'apps/server/test/chartDslTool.test.js',
      'apps/server/test/chartLangChainAgent.test.js'
    ]
  },
  {
    match: /apps\/web\/src\/utils\/officeCast\.js|apps\/web\/src\/i18n\/locales\/office\./,
    tests: ['apps/web/test/officeLocale.test.js', 'apps/web/test/officeDirectory.test.jsx']
  },
  {
    match:
      /apps\/web\/src\/(components\/(OfficeFloor|officeFloor|OfficeLayer)|utils\/officeFloor|utils\/officeDeskWork|utils\/officeSceneCast|hooks\/useStageScale\.js|state\/officeViewModeStore)/,
    tests: ISOMETRIC_FLOOR_BLAST_TESTS
  },
  {
    match:
      /apps\/web\/src\/(components\/(DeskDrawer|EntryRenderAs)|utils\/renderModeAction)|apps\/web\/src\/i18n\/locales\/controls\.(en|en-AU)\.js/,
    tests: [
      'apps/web/test/entryRenderAs.test.jsx',
      'apps/web/test/renderModeAction.test.js',
      'apps/web/test/App.test.jsx'
    ]
  },
  {
    match:
      /apps\/web\/src\/(components\/(DeskActionsDock|DeskConcentrationChip|ConcentrationControl)|features\/desk\/(DeskBottomActionsSlot|useEntryDeskFlow|useOfficeBoot))/,
    tests: [
      'apps/web/test/App.test.jsx',
      'apps/web/test/deskActionsDock.test.jsx',
      'apps/web/test/deskBottomActionsSlot.test.jsx',
      'apps/web/test/officeLayerDeskSlot.test.jsx'
    ]
  }
];

const WIRE_SOURCE_RE =
  /packages\/shared\/src\/.*(agUi|legacyStream|agentStreamEmitter|diagramSchema|wire)/i;

/**
 * @param {string} root
 * @param {string} relPath
 */
function fileExists(root, relPath) {
  return fs.existsSync(path.join(root, relPath));
}

/**
 * @param {string} srcPath
 * @returns {string[]}
 */
export function basenameTestCandidates(srcPath) {
  const base = path.basename(srcPath).replace(/\.(js|jsx|ts|tsx)$/, '');
  if (srcPath.startsWith('apps/server/src/')) {
    return [`apps/server/test/${base}.test.js`];
  }
  if (srcPath.startsWith('packages/shared/src/')) {
    return [`packages/shared/test/${base}.test.ts`];
  }
  if (srcPath.startsWith('apps/web/src/')) {
    return [
      `apps/web/test/${base}.test.jsx`,
      `apps/web/test/${base}.test.js`,
      `apps/web/test/${base}.test.ts`,
      `apps/web/src/${srcPath.slice('apps/web/src/'.length).replace(/\.(jsx|js|ts|tsx)$/, '')}.adaptAgUi.test.js`
    ];
  }
  if (srcPath.startsWith('scripts/')) {
    const scriptBase = path.basename(srcPath).replace(/\.mjs$/, '');
    return [`scripts/${scriptBase}.test.mjs`];
  }
  return [];
}

/**
 * @param {string} srcPath
 */
export function isWireSourcePath(srcPath) {
  if (WIRE_SOURCE_RE.test(srcPath)) return true;
  if (
    /apps\/server\/src\/(routes\/copilot|agents\/|mcp\/|state\/sessionEventBus|tools\/)/.test(
      srcPath
    )
  ) {
    return true;
  }
  if (/apps\/web\/src\/state\//.test(srcPath) || srcPath.includes('agUiTranslator')) {
    return true;
  }
  return false;
}

/**
 * @param {string} srcPath
 */
export function touchesAnythingRuntime(srcPath) {
  return /anything/i.test(srcPath);
}

/**
 * @param {string[]} changedFiles
 * @param {{ root: string, includeSlow?: boolean }} [options]
 */
export function resolveAffectedTests(changedFiles, { root, includeSlow = false } = {}) {
  /** @type {Set<string>} */
  const tests = new Set();
  /** @type {Set<TestWorkspace>} */
  const fallbacks = new Set();
  let runWire = false;
  let anythingTouched = false;

  for (const file of changedFiles) {
    if (/\.test\.(js|jsx|ts|mjs)$/.test(file)) {
      if (fileExists(root, file)) tests.add(file);
      continue;
    }

    if (file.startsWith('docs/') || file.endsWith('.md')) continue;

    if (touchesAnythingRuntime(file)) anythingTouched = true;

    if (isWireSourcePath(file)) runWire = true;

    let matched = false;
    for (const candidate of basenameTestCandidates(file)) {
      if (fileExists(root, candidate)) {
        tests.add(candidate);
        matched = true;
      }
    }

    for (const rule of BLAST_RADIUS_RULES) {
      if (rule.match.test(file)) {
        for (const testPath of rule.tests) {
          if (fileExists(root, testPath)) tests.add(testPath);
        }
      }
    }

    if (!matched) {
      if (file.startsWith('packages/shared/')) fallbacks.add('shared');
      else if (file.startsWith('apps/server/')) fallbacks.add('server');
      else if (file.startsWith('apps/web/')) fallbacks.add('web');
      else if (file.startsWith('scripts/')) fallbacks.add('scripts');
    }
  }

  let resolved = [...tests].sort();
  const skipSlow = !includeSlow && !anythingTouched;
  if (skipSlow) {
    const slow = new Set(SERVER_SLOW_TEST_FILES);
    resolved = resolved.filter((t) => !slow.has(t));
  }

  return {
    tests: resolved,
    runWire,
    fallbacks: [...fallbacks].sort(),
    skipSlowServerTests: skipSlow,
    anythingTouched
  };
}

/**
 * @param {ReturnType<typeof resolveAffectedTests>} plan
 */
export function summarizeAffectedTestPlan(plan) {
  const parts = [];
  if (plan.tests.length > 0) parts.push(`${plan.tests.length} targeted test file(s)`);
  if (plan.runWire) parts.push('wire');
  if (plan.fallbacks.length > 0) parts.push(`fallback: ${plan.fallbacks.join(', ')}`);
  if (plan.skipSlowServerTests) parts.push('skip slow server integration');
  return parts.join('; ') || 'no tests';
}

/**
 * @param {string} root
 * @param {boolean} includeSlow
 * @returns {string[]}
 */
export function listAllServerTestFiles(root, includeSlow = true) {
  const dir = path.join(root, 'apps/server/test');
  const slow = new Set(SERVER_SLOW_TEST_FILES.map((p) => path.basename(p)));
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.test.js'))
    .filter((name) => includeSlow || !slow.has(name))
    .map((name) => `apps/server/test/${name}`)
    .sort();
}
