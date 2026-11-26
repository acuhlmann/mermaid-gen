import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NIGHT_SHIFT_CREW, buildNightShiftManifest } from './src/utils/nightShiftLedger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function normalizeBase(value) {
  const s = (value ?? '/').trim() || '/';
  if (s === '/') return '/';
  return s.endsWith('/') ? s : `${s}/`;
}

/**
 * The Night Shift board's data (`src/features/nightShift/`): what the scheduled
 * fleet did, parsed from its ledgers once, at build time, and baked into the
 * bundle as `__ARCHISLOP_NIGHT_SHIFT__`. A missing ledger is an empty record —
 * a checkout without `docs/` still builds, and the board says so in-fiction.
 */
function readNightShiftManifest() {
  const repoRoot = path.resolve(__dirname, '../..');
  const ledgers = {};
  for (const crew of NIGHT_SHIFT_CREW) {
    try {
      ledgers[crew.id] = readFileSync(path.join(repoRoot, crew.ledger), 'utf8');
    } catch {
      ledgers[crew.id] = null;
    }
  }
  return buildNightShiftManifest(ledgers);
}

// https://vite.dev/config/
// Set VITE_BASE_PATH for subdirectory deploys (e.g. /hackathon/ behind a load balancer).
const devApiPort = process.env.PORT?.trim() || '4000';

export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE_PATH),
  plugins: [react()],
  define: {
    __ARCHISLOP_NIGHT_SHIFT__: JSON.stringify(readNightShiftManifest())
  },
  server: {
    allowedHosts: ['.monkeycode-ai.live'],
    // Same-origin /api in dev so Visitor Badge cookies work when VISITOR_BADGE_SECRETS is set.
    proxy: {
      '/api': { target: `http://127.0.0.1:${devApiPort}`, changeOrigin: true },
      '/mcp': { target: `http://127.0.0.1:${devApiPort}`, changeOrigin: true }
    }
  },
  resolve: {
    alias: {
      // PostCSS (pulled in by @antv/infographic) expects Node built-ins; Vite otherwise
      // injects empty externals that throw at runtime (see Vite troubleshooting).
      'source-map-js': require.resolve('source-map-js'),
      path: require.resolve('path-browserify'),
      url: path.join(__dirname, 'src/shims/node-url-stub.js'),
      fs: path.join(__dirname, 'src/shims/node-fs-stub.js')
    }
  },
  optimizeDeps: {
    // Mermaid lazy-loads diagram chunks; pre-bundle the core entry so Vite does not serve
    // stale split chunks (504 Outdated Optimize Dep) after dependency changes.
    include: ['source-map-js', 'path-browserify', '@antv/infographic', 'mermaid', 'vega-embed']
  },
  test: {
    // Node 25+ enables experimental Web Storage on globalThis; that empty proxy
    // blocks jsdom from installing a real window.localStorage. Disable it so
    // Vitest jsdom environments own storage (see nodejs/node#60303).
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['./test/setup/jsdom-polyfills.js']
  }
});
