/**
 * The measurement guard (ADR-0019). ArchiSlop God improves what the usage signals measure, so the
 * cheapest way for it to "improve" a number would be to stop measuring it. This file lives under
 * the frozen `scripts/god/**`, out of every routine's reach, and fails if any funnel stops calling
 * the signal it feeds. Moving a call is fine — update the table in a human PR; deleting one is not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** file → the calls it must keep making. */
const FUNNELS = {
  // Browser (apps/web)
  'apps/web/src/main.jsx': ['installUxSignals('],
  'apps/web/src/components/AppErrorBoundary.jsx': ["recordClientError('boundary'"],
  'apps/web/src/features/insights/useRetryFailedInsight.js': ["kind: 'retry'"],
  'apps/web/src/features/insights/useDiagramChangeHighlight.js': ["kind: 'restore'"],
  'apps/web/src/features/canvas/useDiagramAutoFix.js': ["kind: 'autofix'"],
  'apps/web/src/features/insights/useFixFromCritique.js': ["kind: 'critique_fix'"],
  'apps/web/src/features/session/useContentModeSwitch.js': ["kind: 'mode_switch'"],
  'apps/web/src/features/streaming/useAgentRunPipeline.js': ["kind: 'run_stop'"],
  'apps/web/src/features/streaming/useRunStreamingAgent.js': [
    'trackRunOutcome(',
    'runOutcome.finish()'
  ],
  'apps/web/src/state/applyAgentStreamInsightEvent.ts': [
    "onRunOutcome?.('failed'",
    'onRunOutcome?.('
  ],
  'apps/web/src/features/canvas/useDiagramManualSync.js': ['noteManualEdit('],
  // Server (apps/server)
  'apps/server/src/agents/_lib/invokePatchAgentWithRepair.js': ['recordAgentTurn('],
  'apps/server/src/agents/mermaidLangChainAgent.js': ['recordAgentTurn('],
  'apps/server/src/agents/infographicLangChainAgent.js': ['recordAgentTurn('],
  'apps/server/src/routes/diagramRepair.js': [
    "kind: 'render_repair'",
    'recordSignal = recordUxSignal'
  ],
  'apps/server/src/routes/copilotUserEdit.ts': [
    "kind: 'graph_edit'",
    'recordSignal = recordUxSignal'
  ],
  'apps/server/src/routes/signals.ts': ['UxClientSignalBatchSchema.safeParse(']
};

for (const [file, calls] of Object.entries(FUNNELS)) {
  test(`${file} still feeds its usage signal`, () => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const call of calls) {
      assert.ok(source.includes(call), `${file} no longer contains \`${call}\``);
    }
  });
}

test('the browser wires the client from the entry point, not from a component', () => {
  const app = fs.readFileSync(path.join(ROOT, 'apps/web/src/App.jsx'), 'utf8');
  assert.equal(app.includes('installUxSignals('), false);
});
