// Base ESLint flat-config for archislop workspaces. Threshold rules from
// Fowler's "Sensors for Coding Agents" (warn-only, with the legacy-monolith
// allowlist providing per-file overrides). See ./guidance.js for the
// agent-facing self-correction guidance attached to each rule by formatter.cjs.

import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import { legacyOverridesForWorkspace } from './legacy-monoliths.js';

const THRESHOLDS = {
  default: {
    'max-lines': ['warn', { max: 800, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': [
      'warn',
      { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }
    ],
    'max-params': ['warn', 5],
    complexity: ['warn', 12]
  },
  shared: {
    'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': [
      'warn',
      { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }
    ],
    'max-params': ['warn', 4],
    complexity: ['warn', 10]
  }
};

// Per ADR-0007 warm-up policy: every new rule starts at 'warn'. Promote
// individual rules to 'error' after a quiet two-week window with no
// unexplained suppressions. We apply this to js.configs.recommended too so
// the sensor rollout doesn't break CI on pre-existing recommended-rule
// violations in legacy files / tests.
function softenToWarn(config) {
  const rules = {};
  for (const [id, value] of Object.entries(config.rules ?? {})) {
    if (value === 'error' || value === 2) rules[id] = 'warn';
    else if (Array.isArray(value) && (value[0] === 'error' || value[0] === 2)) {
      rules[id] = ['warn', ...value.slice(1)];
    } else {
      rules[id] = value;
    }
  }
  return { ...config, rules };
}

// Workspace-specific tunings. `env` selects browser vs node globals;
// `tighten` flips to the stricter packages/shared thresholds.
export function baseConfig({ env = 'node', tighten = false, workspaceDir = '.' } = {}) {
  const rules = tighten ? THRESHOLDS.shared : THRESHOLDS.default;
  const envGlobals = env === 'browser' ? globals.browser : globals.node;

  return [
    { ignores: ['dist', 'build', 'coverage', '**/*.d.ts'] },
    softenToWarn(js.configs.recommended),
    {
      files: ['**/*.{js,jsx,mjs,cjs}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: { ...envGlobals },
        parserOptions: { ecmaFeatures: { jsx: true } }
      },
      rules: {
        ...rules,
        'no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_'
          }
        ]
      }
    },
    {
      // TypeScript files: use @typescript-eslint/parser + the plugin's
      // `recommended` (non-type-aware) rule set, softened to warn per the
      // ADR-0007 warm-up policy. These rules fire only on .ts/.tsx, so they
      // reward the ADR-0006 ratchet: every .js→.ts conversion gains this
      // guidance on top of the Factory rules. Type-aware rules
      // (recommended-type-checked: no-floating-promises, no-unsafe-*, …) stay
      // off here — they require `parserOptions.project` and would slow lint on
      // the legacy .js corpus; enable them per-workspace alongside the
      // strict-mode flip (docs/decisions/0006-typescript-migration.md).
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: { ...envGlobals },
        parserOptions: { ecmaFeatures: { jsx: true } }
      },
      plugins: { '@typescript-eslint': tsPlugin },
      rules: {
        ...rules,
        // typescript-eslint recommended (non-type-aware), all softened to warn.
        ...softenToWarn({ rules: tsPlugin.configs.recommended.rules }).rules,
        // Built-in no-unused-vars triggers false positives on TS type
        // signatures; use the typescript-eslint variant instead. Re-stated
        // after the recommended spread so the `^_` ignore pattern wins.
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_'
          }
        ]
      }
    },
    {
      files: ['**/*.config.{js,mjs,cjs}', '**/vite.config.*', '**/eslint.config.*'],
      languageOptions: { globals: { ...globals.node, ...globals.browser } },
      rules: {
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off'
      }
    },
    {
      files: ['test/**/*.{js,jsx,ts,tsx,mjs,cjs}', '**/*.test.{js,jsx,ts,tsx,mjs,cjs}'],
      languageOptions: { globals: { ...globals.node, ...envGlobals } },
      rules: {
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off',
        'max-params': 'off'
      }
    },
    ...legacyOverridesForWorkspace(workspaceDir)
  ];
}

export default baseConfig;
