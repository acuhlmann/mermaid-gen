import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GRAPH_EDIT_BLAST_TESTS,
  METAPHOR_BLAST_TESTS,
  SERVER_SLOW_TEST_FILES,
  basenameTestCandidates,
  isWireSourcePath,
  resolveAffectedTests,
  summarizeAffectedTestPlan,
  touchesAnythingRuntime
} from './test-affected-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('basenameTestCandidates maps server agents to test files', () => {
  assert.deepEqual(basenameTestCandidates('apps/server/src/agents/diagramAgentDispatcher.js'), [
    'apps/server/test/diagramAgentDispatcher.test.js'
  ]);
});

test('basenameTestCandidates maps shared sources to .test.ts', () => {
  assert.deepEqual(basenameTestCandidates('packages/shared/src/formsA2ui.ts'), [
    'packages/shared/test/formsA2ui.test.ts'
  ]);
});

test('basenameTestCandidates maps web components to jsx/js/ts variants', () => {
  const candidates = basenameTestCandidates('apps/web/src/components/InsightsPane.jsx');
  assert.ok(candidates.includes('apps/web/test/InsightsPane.test.jsx'));
});

test('resolveAffectedTests includes basename mirror and blast-radius tests', () => {
  const plan = resolveAffectedTests(['apps/server/src/agents/diagramAgentDispatcher.js'], {
    root: ROOT
  });
  assert.ok(plan.tests.includes('apps/server/test/diagramAgentDispatcher.test.js'));
});

test('resolveAffectedTests adds copilot blast-radius tests for diagramSchema edits', () => {
  const plan = resolveAffectedTests(['packages/shared/src/diagramSchema.ts'], { root: ROOT });
  assert.ok(plan.tests.includes('packages/shared/test/diagramSchema.test.ts'));
  assert.ok(plan.tests.includes('apps/server/test/copilotRoute.test.js'));
  assert.equal(plan.runWire, true);
});

test('resolveAffectedTests skips slow server tests unless anything changes', () => {
  const plan = resolveAffectedTests(['apps/server/src/agents/mermaidLangChainAgent.js'], {
    root: ROOT
  });
  for (const slow of SERVER_SLOW_TEST_FILES) {
    assert.equal(plan.tests.includes(slow), false);
  }
  assert.equal(plan.skipSlowServerTests, true);
});

test('resolveAffectedTests keeps slow server tests when anything paths change', () => {
  const plan = resolveAffectedTests(['apps/server/src/tools/anythingRuntimeCheck.js'], {
    root: ROOT,
    includeSlow: true
  });
  assert.ok(plan.anythingTouched);
  assert.ok(plan.tests.includes('apps/server/test/anythingRuntimeCheck.test.js'));
});

test('resolveAffectedTests marks unknown server paths for fallback', () => {
  const plan = resolveAffectedTests(['apps/server/src/utils/noMatchingTestModule.js'], {
    root: ROOT
  });
  assert.ok(plan.fallbacks.includes('server'));
});

test('isWireSourcePath treats any app src lintable path as wire (cheap suite)', () => {
  assert.equal(isWireSourcePath('apps/server/src/routes/copilot.ts'), true);
  assert.equal(isWireSourcePath('apps/web/src/state/agUiTranslator.ts'), true);
  assert.equal(isWireSourcePath('apps/server/src/utils/redactSecrets.js'), true);
  assert.equal(isWireSourcePath('apps/web/src/components/InsightsPane.jsx'), true);
  assert.equal(isWireSourcePath('docs/guide/coding-agents.md'), false);
});

test('touchesAnythingRuntime matches anything modules only', () => {
  assert.equal(touchesAnythingRuntime('apps/server/src/agents/anythingLangChainAgent.js'), true);
  assert.equal(touchesAnythingRuntime('apps/server/src/agents/mermaidLangChainAgent.js'), false);
});

test('resolveAffectedTests adds deliverable-format blast-radius tests for menu-bar edits', () => {
  const plan = resolveAffectedTests(['apps/web/src/components/DeskOsMenuBar.jsx'], { root: ROOT });
  assert.ok(plan.tests.includes('apps/web/test/App.test.jsx'));
  assert.ok(plan.tests.includes('apps/web/test/entryRenderAs.test.jsx'));
  assert.ok(plan.tests.includes('apps/web/test/renderModeAction.test.js'));
  assert.ok(plan.tests.includes('apps/web/test/deskOsMenuBar.test.jsx'));
});

test('resolveAffectedTests adds desk-chrome blast-radius tests for concentration chip edits', () => {
  const plan = resolveAffectedTests(['apps/web/src/components/DeskConcentrationChip.jsx'], {
    root: ROOT
  });
  assert.ok(plan.tests.includes('apps/web/test/App.test.jsx'));
  assert.ok(plan.tests.includes('apps/web/test/deskBottomActionsSlot.test.jsx'));
  assert.ok(plan.tests.includes('apps/web/test/deskActionsDock.test.jsx'));
  assert.ok(plan.tests.includes('apps/web/test/officeLayerDeskSlot.test.jsx'));
});

test('resolveAffectedTests adds isometric floor blast-radius tests for OfficeFloor edits', () => {
  const plan = resolveAffectedTests(['apps/web/src/components/OfficeFloor.jsx'], { root: ROOT });
  assert.ok(plan.tests.includes('apps/web/test/officeFloor.test.jsx'));
  assert.ok(plan.tests.includes('apps/web/test/officeFloorContracts.test.js'));
  assert.ok(plan.tests.includes('apps/web/test/officeLayerFloorRenderer.test.jsx'));
});

test('resolveAffectedTests adds office cast blast-radius tests for officeCast edits', () => {
  const plan = resolveAffectedTests(['apps/web/src/utils/officeCast.js'], { root: ROOT });
  assert.ok(plan.tests.includes('apps/web/test/castTiers.test.js'));
  assert.ok(plan.tests.includes('apps/web/test/officeComponents.test.jsx'));
});

test('resolveAffectedTests adds desk prompt blast-radius tests for SlopNextPrompt edits', () => {
  const plan = resolveAffectedTests(['apps/web/src/components/SlopNextPrompt.jsx'], {
    root: ROOT
  });
  assert.ok(plan.tests.includes('apps/web/test/SlopNextPrompt.test.jsx'));
  assert.ok(plan.tests.includes('apps/web/test/App.test.jsx'));
});

test('basenameTestCandidates maps scripts/*-lib.mjs to the runner test file', () => {
  assert.deepEqual(basenameTestCandidates('scripts/test-affected-lib.mjs'), [
    'scripts/test-affected-lib.test.mjs',
    'scripts/test-affected.test.mjs'
  ]);
  assert.deepEqual(basenameTestCandidates('scripts/check-affected-lib.mjs'), [
    'scripts/check-affected-lib.test.mjs',
    'scripts/check-affected.test.mjs'
  ]);
});

test('resolveAffectedTests pulls agent tooling blast tests for test-affected-lib edits', () => {
  const plan = resolveAffectedTests(['scripts/test-affected-lib.mjs'], { root: ROOT });
  assert.ok(plan.tests.includes('scripts/test-affected.test.mjs'));
  assert.ok(plan.tests.includes('scripts/check-affected.test.mjs'));
  assert.equal(plan.fallbacks.includes('scripts'), false);
});

test('resolveAffectedTests marks unknown scripts paths for fallback', () => {
  const plan = resolveAffectedTests(['scripts/noMatchingAgentScript.mjs'], { root: ROOT });
  assert.ok(plan.fallbacks.includes('scripts'));
});

// --- metaphor3d and canvas graph-edit --------------------------------------------------------
// Neither area had a blast-radius rule until 2026-08-30, so both relied on the basename mirror
// alone: a shared-schema edit selected one test file and missed every consumer of that schema.

test('a shared metaphor schema edit reaches its server and web consumers, not just its own test', () => {
  const plan = resolveAffectedTests(['packages/shared/src/metaphorSanitizer.ts'], { root: ROOT });
  assert.ok(
    plan.tests.includes('packages/shared/test/metaphorSanitizer.test.ts'),
    'basename mirror'
  );
  assert.ok(
    plan.tests.includes('apps/server/test/metaphorCompositeContract.test.js'),
    'the server ladder consumes the same schema and the mirror cannot see it'
  );
  assert.ok(plan.tests.includes('apps/web/test/metaphorLayouts.test.js'), 'web consumers');
  assert.ok(
    plan.tests.length > 20,
    `expected the whole metaphor set, got ${plan.tests.length} — a rule that selects almost nothing is the bug being fixed`
  );
});

test('a metaphor scene module edit pulls the metaphor set', () => {
  const plan = resolveAffectedTests(['apps/web/src/components/metaphorScenes/linkRoutes.js'], {
    root: ROOT
  });
  assert.ok(plan.tests.includes('apps/web/test/metaphorLinkRoutes.test.js'));
  assert.ok(plan.tests.includes('apps/web/test/metaphorSceneFraming.test.js'));
});

test('one graph-edit family edit pulls its sibling families', () => {
  const plan = resolveAffectedTests(['apps/web/src/utils/mermaidErEdit.js'], { root: ROOT });
  assert.ok(plan.tests.includes('apps/web/test/mermaidErEdit.test.js'), 'basename mirror');
  assert.ok(
    plan.tests.includes('apps/web/test/mermaidClassEdit.test.js'),
    'ER and class share pickParallelEdgeRef — the 2026-08-28/29 colon-less bug crossed exactly this seam'
  );
  assert.ok(plan.tests.includes('apps/web/test/canvasGraphEdit.test.js'), 'the shared dispatcher');
});

test('the negative case: an unrelated file pulls neither new set', () => {
  const plan = resolveAffectedTests(['apps/web/src/utils/officeCast.js'], { root: ROOT });
  for (const file of METAPHOR_BLAST_TESTS) {
    assert.ok(!plan.tests.includes(file), `officeCast must not pull ${file}`);
  }
  assert.ok(
    !plan.tests.includes('apps/web/test/canvasGraphEdit.test.js'),
    'a rule that fires on everything is the same as no rule'
  );
});

test('both new bundles are non-empty and every path in them exists', () => {
  for (const [label, bundle] of [
    ['METAPHOR_BLAST_TESTS', METAPHOR_BLAST_TESTS],
    ['GRAPH_EDIT_BLAST_TESTS', GRAPH_EDIT_BLAST_TESTS]
  ]) {
    assert.ok(bundle.length > 0, `${label} is empty — a sweep over nothing passes vacuously`);
    for (const file of bundle) {
      assert.ok(
        fs.existsSync(path.join(ROOT, file)),
        `${label} names ${file}, which does not exist — resolveAffectedTests drops it silently`
      );
    }
  }
});
