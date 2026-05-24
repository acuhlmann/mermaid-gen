import { baseConfig } from '@archislop/eslint-config';

// packages/shared is fully TypeScript and strict; uses the tighter base
// thresholds and Node globals.
export default baseConfig({ env: 'node', tighten: true, workspaceDir: 'packages/shared' });
