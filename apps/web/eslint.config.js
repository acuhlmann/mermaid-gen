import { frontendConfig } from '@archislop/eslint-config/frontend';
import { strictIslandTypeCheckedConfig } from '@archislop/eslint-config/type-checked-island';

export default [
  ...frontendConfig({ workspaceDir: 'apps/web' }),
  strictIslandTypeCheckedConfig({
    files: ['src/**/*.{ts,tsx}'],
    tsconfigRootDir: import.meta.dirname
  })
];
