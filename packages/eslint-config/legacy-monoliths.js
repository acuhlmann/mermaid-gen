// Files known to exceed max-lines / max-lines-per-function thresholds and
// slated for splits per ADR-0005. Listed here so the threshold rules don't
// shout on every lint run while the splits are in flight. New files outside
// this list get the warning loud and clear.
//
// When a file is split, remove it from this list. When you add a new file
// over the threshold, fix the file rather than adding it here.

export const LEGACY_MONOLITHS = [
  'apps/web/src/App.jsx',
  'apps/web/src/components/InsightsPane.jsx',
  'apps/web/src/components/DiagramCanvas.jsx',
  'apps/web/src/components/RadialActionMenu.jsx',
  'apps/web/src/state/diagramStore.js',
  'apps/server/src/mcp/mcpServer.js',
  'apps/server/src/agents/mermaidLangChainAgent.js',
  'apps/server/src/agents/infographicLangChainAgent.js',
  'apps/server/src/routes/copilot.ts',
];

// Build the eslint flat-config override block that disables the threshold
// rules on the monolith files. Paths above are repo-relative; ESLint matches
// them against the file path passed in via `files` glob.
export function legacyOverridesForWorkspace(workspaceDir) {
  const prefix = `${workspaceDir.replace(/\/$/, '')}/`;
  const files = LEGACY_MONOLITHS
    .filter((p) => p.startsWith(prefix))
    .map((p) => p.slice(prefix.length));
  if (files.length === 0) return [];
  return [
    {
      files,
      rules: {
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off',
      },
    },
  ];
}
