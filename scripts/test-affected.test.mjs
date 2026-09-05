import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENT_TOOLING_BLAST_TESTS,
  GRAPH_EDIT_BLAST_TESTS,
  ISOMETRIC_FLOOR_BLAST_TESTS,
  METAPHOR_BLAST_TESTS,
  SERVER_SLOW_TEST_FILES,
  WIRE_TEST_FILES,
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

// The guard below checks that every listed path exists. This checks the other direction: every suite
// ON DISK in the family is listed. Only the first direction was guarded until 2026-09-02, and four
// metaphor suites plus ten officeFloor ones had accumulated unlisted — invisible to `test:affected`
// and to the pre-push hook, red only in full CI.
//
// Two things #528 corrected here, both of which are the same bug the sweep exists to catch:
//
// - **The universe was one directory.** `METAPHOR_BLAST_TESTS` lists files under `packages/shared/test`
//   and `apps/server/test` as well as `apps/web/test`, so a new metaphor suite landing in either of
//   those was exactly as invisible as the ones this sweep was written for. The directories are now
//   *derived from the bundle* rather than named, so the sweep cannot silently shrink when a bundle
//   grows; `minDirs` is the companion assertion that fails if the claimed span is pruned away.
// - **`GRAPH_EDIT_BLAST_TESTS` had no reverse sweep at all**, and it is the bundle the
//   `canvas-graph-edit` automation feeds every night, whose playbook routes each new family past
//   `diagramGraphEditNodeResolve.js` — the file whose blast rule pulls this list. Its predicate is
//   `…Edit.test.…` / `…graphEdit…`, which describes the shape a new family suite takes
//   (`mermaidGanttEdit.test.js`) and matches 18 of the 20 entries listed today. Two listed entries
//   deliberately fall outside it; a reverse sweep only needs the on-disk candidate set, so that
//   imprecision costs nothing here and the forward sweep below covers every listed path instead.
//
// `AGENT_TOOLING_BLAST_TESTS` gets no reverse sweep on purpose: measured, no name convention unifies
// its six `scripts/*.test.mjs` entries, so any pattern wide enough to describe them would flag
// unrelated scripts suites. It is covered in the forward direction, which is the one it can support.
const REVERSE_SWEEPS = [
  [
    'METAPHOR_BLAST_TESTS',
    METAPHOR_BLAST_TESTS,
    /^(metaphor|composite|fused|switchMetaphor).*\.test\.(js|jsx|ts|tsx)$/,
    3
  ],
  [
    'ISOMETRIC_FLOOR_BLAST_TESTS',
    ISOMETRIC_FLOOR_BLAST_TESTS,
    /^officeFloor.*\.test\.(js|jsx)$/,
    1
  ],
  [
    'GRAPH_EDIT_BLAST_TESTS',
    GRAPH_EDIT_BLAST_TESTS,
    /([Gg]raphEdit|[A-Za-z]Edit)\.test\.(js|jsx|ts|tsx)$/,
    1
  ]
];

for (const [label, bundle, pattern, minDirs] of REVERSE_SWEEPS) {
  test(`every suite on disk matching ${label}'s family is listed in it`, () => {
    const dirs = [...new Set(bundle.map((entry) => path.posix.dirname(entry)))];
    assert.ok(
      dirs.length >= minDirs,
      `${label}: sweep universe is ${dirs.length} dir(s) (${dirs.join(', ')}), expected >= ${minDirs} — ` +
        'deriving the universe from the bundle means pruning its entries shrinks what this checks'
    );
    const onDisk = dirs.flatMap((dir) =>
      fs
        .readdirSync(path.join(ROOT, dir))
        .filter((name) => pattern.test(name))
        .map((name) => `${dir}/${name}`)
    );
    assert.ok(onDisk.length > 0, `${label}: the sweep found nothing — it would pass vacuously`);
    const missing = onDisk.filter((file) => !bundle.includes(file));
    assert.deepEqual(missing, [], `on disk but not in ${label}: ${missing.join(', ')}`);
  });
}

test('the strict-island sensor is selected by both files that can drift it', () => {
  for (const file of [
    'packages/eslint-config/typeCheckedIsland.js',
    'apps/server/tsconfig.strict.json'
  ]) {
    const plan = resolveAffectedTests([file], { root: ROOT });
    assert.ok(
      plan.tests.includes('scripts/verify-strict-islands.test.mjs'),
      `${file} must select the sensor that watches it — the server fallback never runs scripts/*.test.mjs`
    );
  }
});

test('the negative case: an unrelated file does not pull the strict-island sensor', () => {
  const plan = resolveAffectedTests(['apps/web/src/utils/officeCast.js'], { root: ROOT });
  assert.ok(!plan.tests.includes('scripts/verify-strict-islands.test.mjs'));
});

// Every bundle, not the two that happened to be new when this was written (#528 part 2).
// `resolveAffectedTests` drops a listed path that does not exist with no noise at all, so a renamed
// suite turns a blast rule into a silent no-op — the same failure the reverse sweep above exists for,
// in the other direction. This PR grew ISOMETRIC_FLOOR_BLAST_TESTS by ten entries while its own
// existence guard skipped that very bundle.
test('every suite listed in any blast bundle exists on disk', () => {
  for (const [label, bundle] of [
    ['AGENT_TOOLING_BLAST_TESTS', AGENT_TOOLING_BLAST_TESTS],
    ['GRAPH_EDIT_BLAST_TESTS', GRAPH_EDIT_BLAST_TESTS],
    ['ISOMETRIC_FLOOR_BLAST_TESTS', ISOMETRIC_FLOOR_BLAST_TESTS],
    ['METAPHOR_BLAST_TESTS', METAPHOR_BLAST_TESTS],
    ['SERVER_SLOW_TEST_FILES', SERVER_SLOW_TEST_FILES],
    ['WIRE_TEST_FILES', WIRE_TEST_FILES]
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
