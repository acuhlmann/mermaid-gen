// Frontend (apps/web) ESLint flat-config. Composes the base + React 19
// hooks/refresh + Factory plugin on TypeScript files.

import factory from './factoryPluginCompat.js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { baseConfig } from './index.js';

export function frontendConfig({ workspaceDir = '.' } = {}) {
  return [
    ...baseConfig({ env: 'browser', workspaceDir }),
    {
      files: ['**/*.{js,jsx}'],
      plugins: {
        'react-hooks': reactHooks,
        'react-refresh': reactRefresh
      },
      rules: {
        // React 19's strict hooks rules surface patterns predating this
        // codebase. Keep visible as warnings so agents notice them; don't
        // block CI until a deliberate hook-refactor pass.
        ...reactHooks.configs.flat.recommended.rules,
        'react-hooks/set-state-in-effect': 'warn',
        'react-hooks/purity': 'warn',
        'react-hooks/refs': 'warn',
        'react-hooks/immutability': 'warn',
        ...reactRefresh.configs.vite.rules
      }
    },
    {
      files: ['src/components/**/*.{tsx,jsx}'],
      plugins: { '@factory': factory },
      rules: {
        '@factory/filename-match-export': 'warn'
      }
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      plugins: { '@factory': factory },
      rules: {
        '@factory/no-exported-string-union-types': 'warn',
        '@factory/no-exported-function-expressions': 'warn'
      }
    }
  ];
}

export default frontendConfig;
