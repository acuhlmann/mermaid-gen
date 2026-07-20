/**
 * Diff classification for check-affected.mjs.
 * Exported for unit tests so coding agents can trust the scoped verify loop.
 */

const LINTABLE_RE = /\.(js|jsx|ts|tsx|mjs|cjs)$/;

/**
 * @typedef {object} AffectedFlags
 * @property {boolean} shared
 * @property {boolean} server
 * @property {boolean} web
 * @property {boolean} wire
 * @property {boolean} docs
 * @property {boolean} root
 * @property {boolean} deps
 * @property {boolean} lintShared
 * @property {boolean} lintServer
 * @property {boolean} lintWeb
 */

/** @param {string[]} files @returns {AffectedFlags} */
export function classifyChangedFiles(files) {
  /** @type {AffectedFlags} */
  const flags = {
    shared: false,
    server: false,
    web: false,
    wire: false,
    docs: false,
    root: false,
    deps: false,
    lintShared: false,
    lintServer: false,
    lintWeb: false
  };

  for (const f of files) {
    if (f.startsWith('packages/shared/')) flags.shared = true;
    if (f.startsWith('apps/server/')) flags.server = true;
    if (f.startsWith('apps/web/')) flags.web = true;
    if (f.startsWith('packages/shared/src/') && LINTABLE_RE.test(f)) flags.lintShared = true;
    if (f.startsWith('apps/server/src/') && LINTABLE_RE.test(f)) flags.lintServer = true;
    if (f.startsWith('apps/web/src/') && LINTABLE_RE.test(f)) flags.lintWeb = true;
    if (
      f.startsWith('packages/shared/src/') &&
      /agUi|legacyStream|agentStreamEmitter|diagramSchema|wire/i.test(f)
    ) {
      flags.wire = true;
    }
    if (
      f.startsWith('apps/server/src/') &&
      /routes\/copilot|agents\/|mcp\/|state\/sessionEventBus|tools\//.test(f)
    ) {
      flags.wire = true;
    }
    if (f.startsWith('apps/web/src/state/') || f.includes('agUiTranslator')) {
      flags.wire = true;
    }
    if (f.startsWith('apps/web/src/state/sessionEventsClient')) {
      flags.wire = true;
    }
    // Any app source change can affect wire contracts indirectly — run wire tests cheaply.
    if (
      (f.startsWith('apps/server/src/') || f.startsWith('apps/web/src/')) &&
      LINTABLE_RE.test(f)
    ) {
      flags.wire = true;
    }
    if (
      f.startsWith('docs/') ||
      f === 'STRUCTURE.md' ||
      f === 'AGENTS.md' ||
      f === 'CLAUDE.md' ||
      f.startsWith('docs/recipes/')
    ) {
      flags.docs = true;
    }
    if (f === '.dependency-cruiser.cjs' || f === 'package.json' || f === 'package-lock.json') {
      flags.deps = true;
    }
    if (
      f === 'package.json' ||
      f.startsWith('scripts/') ||
      f.startsWith('.github/') ||
      f === 'tsconfig.base.json' ||
      f.includes('tsconfig.')
    ) {
      flags.root = true;
    }
  }

  return flags;
}

/**
 * Human-readable summary for agent logs / test assertions.
 * @param {AffectedFlags} flags
 */
export function summarizeAffectedFlags(flags) {
  return Object.entries(flags)
    .filter(([, on]) => on)
    .map(([key]) => key)
    .sort()
    .join(', ');
}
