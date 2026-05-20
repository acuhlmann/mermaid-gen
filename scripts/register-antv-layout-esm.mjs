/**
 * Register before `node --test` when using tsx so @antv/infographic can import
 * { DagreLayout } from '@antv/layout'. Import this module AFTER tsx on the CLI.
 */
import { register } from 'node:module';

register('./antv-layout-load-hook.mjs', import.meta.url);
