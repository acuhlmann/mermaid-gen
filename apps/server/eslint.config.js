import { backendConfig } from '@archislop/eslint-config/backend';
import {
  SERVER_STRICT_ISLAND_FILES,
  strictIslandTypeCheckedConfig
} from '@archislop/eslint-config/type-checked-island';

export default [
  ...backendConfig({ workspaceDir: 'apps/server' }),
  strictIslandTypeCheckedConfig({
    files: SERVER_STRICT_ISLAND_FILES,
    tsconfigRootDir: import.meta.dirname
  })
];
