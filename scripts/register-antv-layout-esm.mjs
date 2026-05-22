/**
 * Register before `node --import tsx` (tests) so @antv/infographic can import
 * { DagreLayout } from '@antv/layout'. CLI: `--import register-antv-layout-esm.mjs --import tsx`
 */
import { register } from 'node:module';

register('./antv-layout-load-hook.mjs', import.meta.url);
