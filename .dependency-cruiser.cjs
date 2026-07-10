// dependency-cruiser config for archislop. Replaces the regex-based
// scripts/verify-boundaries.mjs with a real graph analyzer: cycles,
// transitive depth, and intra-workspace layer rules from CLAUDE.md.
//
// Each rule's `comment` (also surfaced as `errorMessage`) is the agent-facing
// self-correction guidance. When you add a rule, write the fix into the
// comment — that's what the agent reads when the rule fires.
// See docs/recipes/add-dep-cruiser-layer.md.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cycles',
      severity: 'error',
      comment:
        'Cycle detected. Break it by inverting a dependency or by hoisting the shared piece into packages/shared. Do not extend the cycle.',
      from: {},
      to: { circular: true }
    },
    {
      name: 'shared-must-be-leaf',
      severity: 'error',
      comment:
        'packages/shared is a leaf (ADR-0003). Move the helper into apps/<x>, or extract a pure utility into packages/shared rather than reaching back into app code.',
      from: { path: '^packages/shared/' },
      to: { path: '^apps/' }
    },
    {
      name: 'web-not-server',
      severity: 'error',
      comment:
        'apps/web must not import from apps/server. Cross-app sharing goes through @archislop/shared; talk to the server via HTTP / SSE / MCP.',
      from: { path: '^apps/web/' },
      to: { path: '^apps/server/' }
    },
    {
      name: 'server-not-web',
      severity: 'error',
      comment:
        'apps/server must not import from apps/web. Define the contract in packages/shared (Zod or event type) and let both apps depend on it.',
      from: { path: '^apps/server/' },
      to: { path: '^apps/web/' }
    },
    {
      name: 'server-prompts-leaf',
      severity: 'error',
      comment:
        'Prompt modules are pure data. They must not import agents/tools/routes — agents/tools/routes depend on prompts, not the other way.',
      from: { path: '^apps/server/src/prompts/' },
      to: { path: '^apps/server/src/(agents|tools|routes)/' }
    },
    {
      name: 'server-tools-no-agents-routes',
      // WARN (not error) during the warm-up window — ADR-0007 policy. Today
      // mermaidDiffTool.js imports validateMermaidStrict from
      // agents/mermaidReliabilitySkill.js; the right fix is to move the
      // validator into tools/ or packages/shared. Promote to error once that
      // refactor lands.
      severity: 'warn',
      comment:
        'Tools are leaves below agents and routes (CLAUDE.md). If you need agent state, accept a `ctx` arg instead of importing from agents/routes. To fix the current mermaidReliabilitySkill -> tools dep, move the validator into tools/ or packages/shared.',
      from: { path: '^apps/server/src/tools/' },
      to: { path: '^apps/server/src/(agents|routes)/' }
    },
    {
      name: 'server-mcp-no-routes',
      severity: 'error',
      comment:
        'MCP server and /api/copilotkit routes share apps/server/src/state — not each other. If they need to coordinate, do it via the shared state module.',
      from: { path: '^apps/server/src/mcp/' },
      to: { path: '^apps/server/src/routes/' }
    },
    {
      name: 'web-non-component-no-components',
      severity: 'error',
      comment:
        'state/utils/hooks must not import React components. Invert the dependency: components import the hook/state/util, not the other way.',
      from: { path: '^apps/web/src/(state|utils|hooks)/' },
      to: { path: '^apps/web/src/components/' }
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Orphaned module — nothing imports it. Either wire it in or delete it. (Suppress in this rule if it is intentionally a CLI entry or test fixture.)',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          'vite\\.config\\.',
          'eslint\\.config\\.',
          'tsconfig',
          '(^|/)test/',
          '\\.test\\.',
          '/scripts/',
          'index\\.(js|ts)$',
          // Vite-resolved shims registered via vite.config.js aliases —
          // dep-cruiser doesn't parse Vite's resolve.alias.
          '/shims/',
          // packages/eslint-config inlines guidance into formatter.cjs by
          // design (CJS / ESM split), so guidance.js looks like an orphan.
          '^packages/eslint-config/'
        ]
      },
      to: {}
    }
  ],
  allowed: [],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    exclude: {
      path: [
        '\\.test\\.',
        '(^|/)test/',
        '(^|/)dist/',
        '(^|/)build/',
        '(^|/)coverage/',
        '(^|/)\\.agents/',
        '(^|/)\\.cursor/',
        '(^|/)\\.claude/',
        '(^|/)bench-results/'
      ]
    },
    tsPreCompilationDeps: true,
    // No tsConfig pointer: this monorepo uses moduleResolution: "bundler" with
    // four+ tsconfigs across workspaces. Dep-cruiser's default resolver
    // handles ESM, package exports, and .js/.ts extensions without it.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
    },
    reporterOptions: {
      text: { highlightFocused: true }
    }
  }
};
