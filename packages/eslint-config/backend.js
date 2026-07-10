// Backend (apps/server) ESLint flat-config. Composes the base + Factory plugin.
// factoryPluginCompat.js shims context.getFilename() for ESLint 10.

import factory from './factoryPluginCompat.js';
import { baseConfig } from './index.js';

export function backendConfig({ workspaceDir = '.' } = {}) {
  return [
    ...baseConfig({ env: 'node', workspaceDir }),
    {
      files: ['src/**/*.{js,jsx,ts,tsx}'],
      plugins: { '@factory': factory },
      rules: {
        '@factory/no-log-exception-with-throw': 'warn'
      }
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      plugins: { '@factory': factory },
      rules: {
        '@factory/filename-match-export': 'warn',
        '@factory/no-exported-string-union-types': 'warn',
        '@factory/no-exported-function-expressions': 'warn'
      }
    }
  ];
}

export default backendConfig;
