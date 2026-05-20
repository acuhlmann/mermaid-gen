/**
 * Node load hook: keep @antv/layout on its ESM entry so named exports (DagreLayout)
 * work when tsx wraps the CJS dist bundle as default-only interop.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const LAYOUT_PKG_SEGMENT = '/node_modules/@antv/layout/';

/** @param {string} url */
function isAntvLayoutModule(url) {
  return url.includes(LAYOUT_PKG_SEGMENT);
}

/**
 * @param {string} specifier
 * @param {import('node:module').ResolveHookContext} context
 * @param {import('node:module').ResolveHook} nextResolve
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@antv/layout' || specifier.startsWith('@antv/layout/')) {
    const parent = context.parentURL ?? import.meta.url;
    const resolved = await nextResolve(specifier, { ...context, parentURL: parent });
    if (resolved.url.includes(LAYOUT_PKG_SEGMENT) && resolved.url.includes('/dist/')) {
      const esmUrl = resolved.url.replace('/dist/index.js', '/lib/index.js');
      return { url: esmUrl, format: 'module', shortCircuit: true };
    }
    if (isAntvLayoutModule(resolved.url)) {
      return { ...resolved, format: 'module', shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

/**
 * @param {string} url
 * @param {import('node:module').LoadHookContext} context
 * @param {import('node:module').LoadHook} nextLoad
 */
export async function load(url, context, nextLoad) {
  if (!isAntvLayoutModule(url)) {
    return nextLoad(url, context);
  }
  if (url.includes('/lib/')) {
    const source = await readFile(new URL(url), 'utf8');
    return { format: 'module', source, shortCircuit: true };
  }
  const libUrl = url.replace('/dist/index.js', '/lib/index.js');
  if (libUrl !== url) {
    const source = await readFile(new URL(libUrl), 'utf8');
    return { format: 'module', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
