/**
 * Co-change / producer-only wire risk detection for coding agents.
 * When a high-blast-radius producer changes without an expected consumer or
 * test in the same diff, return agent-readable guidance (ADR-0007 sensors).
 */

/**
 * @typedef {object} BlastRadiusRisk
 * @property {string} id
 * @property {string} trigger
 * @property {string} guidance
 * @property {string[]} missing
 */

/**
 * @param {string[]} files — repo-relative paths from the current diff
 * @returns {BlastRadiusRisk[]}
 */
export function detectWireCoChangeRisks(files) {
  const set = new Set(files);
  /** @param {string | RegExp} pattern */
  const has = (pattern) => {
    if (typeof pattern === 'string') return set.has(pattern);
    for (const f of set) {
      if (pattern.test(f)) return true;
    }
    return false;
  };

  /** @type {BlastRadiusRisk[]} */
  const risks = [];

  if (has('packages/shared/src/diagramSchema.ts')) {
    const hasServer = has(/^apps\/server\/src\//) || has(/^apps\/server\/test\//);
    const hasWeb = has(/^apps\/web\/src\//) || has(/^apps\/web\/test\//);
    const hasSharedTest = has(/^packages\/shared\/test\//);
    /** @type {string[]} */
    const missing = [];
    if (!hasServer) missing.push('apps/server src or test');
    if (!hasWeb) missing.push('apps/web src or test');
    if (!hasSharedTest) missing.push('packages/shared/test');
    // Require at least server+web when schema changes; shared test strongly preferred.
    if (!hasServer || !hasWeb) {
      risks.push({
        id: 'diagram-schema-producer-only',
        trigger: 'packages/shared/src/diagramSchema.ts',
        missing,
        guidance:
          'diagramSchema.ts changed without both server and web co-changes. Update producer AND consumer (server route/store + web store/UI), add/adjust schema tests, and follow docs/recipes/change-diagram-schema.md + docs/agent-blast-radius.md. Run: npm run check:wire'
      });
    } else if (!hasSharedTest) {
      risks.push({
        id: 'diagram-schema-missing-shared-test',
        trigger: 'packages/shared/src/diagramSchema.ts',
        missing: ['packages/shared/test'],
        guidance:
          'diagramSchema.ts changed without a packages/shared/test update. Add or adjust a schema/round-trip test. Run: npm run check:fast'
      });
    }
  }

  if (
    has('packages/shared/src/legacyStreamEvents.ts') ||
    has('packages/shared/src/agUiWireConstants.ts') ||
    has('packages/shared/src/agentStreamEmitter.ts')
  ) {
    const hasTranslator =
      has('apps/web/src/state/agUiTranslator.ts') ||
      has('apps/web/src/state/agUiTranslator.js') ||
      has(/^apps\/web\/src\/state\/applyAgentStream/);
    const hasWireTest =
      has('packages/shared/test/wireRoundTrip.test.ts') || has(/^apps\/web\/test\/wire/);
    if (!hasTranslator || !hasWireTest) {
      /** @type {string[]} */
      const missing = [];
      if (!hasTranslator) {
        missing.push('apps/web/src/state/agUiTranslator.ts (or insight reducer)');
      }
      if (!hasWireTest) {
        missing.push('packages/shared/test/wireRoundTrip.test.ts or apps/web/test/wire*');
      }
      risks.push({
        id: 'ag-ui-stream-producer-only',
        trigger: 'AG-UI shared stream types/emitter',
        missing,
        guidance:
          'AG-UI wire types changed without the web translator and/or wire tests. Follow docs/recipes/add-agent-stream-event.md and docs/agent-blast-radius.md § AG-UI. Run: npm run check:wire'
      });
    }
  }

  if (has('apps/server/src/mcp/mcpServer.js') || has(/^apps\/server\/src\/mcp\/tools\//)) {
    const hasMcpTest = has('apps/server/test/mcpServer.test.js');
    // README-only edits under tools/ are docs, not tool registration.
    const onlyReadme =
      files
        .filter((f) => f.startsWith('apps/server/src/mcp/tools/'))
        .every((f) => f.endsWith('README.md')) && !has('apps/server/src/mcp/mcpServer.js');
    if (!hasMcpTest && !onlyReadme) {
      risks.push({
        id: 'mcp-tool-without-test',
        trigger: 'apps/server/src/mcp/mcpServer.js or mcp/tools/*',
        missing: ['apps/server/test/mcpServer.test.js'],
        guidance:
          'MCP tool registration changed without mcpServer.test.js in the same diff. Add or extend a regression in apps/server/test/mcpServer.test.js (see docs/recipes/add-mcp-tool.md). Run: npm run test -w apps/server'
      });
    }
  }

  if (has('apps/server/src/state/sessionEventBus.ts')) {
    const hasClient =
      has('apps/web/src/state/sessionEventsClient.js') ||
      has('apps/web/src/state/sessionEventsClient.ts');
    const hasTest = has(/^apps\/server\/test\/sessionEventBus/);
    if (!hasClient || !hasTest) {
      /** @type {string[]} */
      const missing = [];
      if (!hasClient) missing.push('apps/web/src/state/sessionEventsClient.js');
      if (!hasTest) missing.push('apps/server/test/sessionEventBus.test.js');
      risks.push({
        id: 'session-events-producer-only',
        trigger: 'apps/server/src/state/sessionEventBus.ts',
        missing,
        guidance:
          'sessionEventBus changed without the web client and/or bus test. Follow docs/recipes/add-session-event.md and docs/agent-blast-radius.md § Session-events.'
      });
    }
  }

  return risks;
}

/**
 * @param {BlastRadiusRisk[]} risks
 * @returns {string}
 */
export function formatWireCoChangeRisks(risks) {
  if (risks.length === 0) return '';
  const lines = [
    'check-affected: wire co-change risks (producer-only smell)',
    '',
    'Agent guidance — update the missing consumers/tests in this diff, or explain why not in the PR:',
    ''
  ];
  for (const risk of risks) {
    lines.push(`[${risk.id}] trigger: ${risk.trigger}`);
    if (risk.missing.length) lines.push(`  missing: ${risk.missing.join('; ')}`);
    lines.push(`  fix: ${risk.guidance}`);
    lines.push('');
  }
  return lines.join('\n');
}
