// Type-aware @typescript-eslint rules for ADR-0006 strict islands (warn-only).
// Mirrors packages/shared/eslint.config.js; scoped to curated .ts paths so the
// legacy .js corpus is not type-checked at lint time.

import path from 'node:path';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const typeCheckedOnly = tsPlugin.configs['recommended-type-checked-only']?.rules ?? {};

/** @type {Record<string, import('eslint').Linter.RuleEntry>} */
export const typeCheckedWarnRules = Object.fromEntries(
  Object.entries(typeCheckedOnly).map(([id, value]) => {
    if (value === 'error' || value === 2) return [id, 'warn'];
    if (Array.isArray(value) && (value[0] === 'error' || value[0] === 2)) {
      return [id, ['warn', ...value.slice(1)]];
    }
    return [id, value];
  })
);

/**
 * Flat-config slice: type-aware lint for strict-island TypeScript files.
 * @param {{ files: string[], tsconfigRootDir: string }} opts
 */
export function strictIslandTypeCheckedConfig({ files, tsconfigRootDir }) {
  return {
    files,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: path.resolve(tsconfigRootDir)
      }
    },
    rules: typeCheckedWarnRules
  };
}

/** Keep in sync with `apps/server/tsconfig.strict.json` `include`. */
export const SERVER_STRICT_ISLAND_FILES = [
  'src/routes/copilotRouteTypes.ts',
  'src/routes/copilot.ts',
  'src/state/diagramStateStore.ts',
  'src/state/sessionEventBus.ts',
  'src/agents/partialJsonString.ts',
  'src/agents/streamPatchToolTelemetry.ts',
  'src/agents/planBeatMessages.ts',
  'src/agents/agentStreamAnalyzeFinalize.ts',
  'src/agents/critiqueA2uiStream.ts',
  'src/agents/explainSectionsStream.ts',
  'src/agents/styleEditsStream.ts',
  'src/mcp/diagramDiffSummary.ts',
  'src/agents/inferDiagramType.ts',
  'src/utils/redactSecrets.ts',
  'src/utils/publicBaseUrl.ts',
  'src/mcp/mcpInviteLinks.ts',
  'src/middleware/apiRateLimit.ts',
  'src/utils/inviteToken.ts',
  'src/mcp/mcpCollaborationActions.ts',
  'src/mcp/mcpSlotRevisions.ts',
  'src/state/sessionServices.ts',
  'src/state/pairingCodeStore.ts'
];
