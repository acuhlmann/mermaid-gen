/**
 * Bundle Monaco from node_modules instead of the default jsDelivr loader path, and
 * register Vite-friendly workers so production CSP does not need permissive blob workers.
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
// monaco-editor 0.56 maps "./*" → "./esm/vs/*.js" — omit the esm/vs/ segment.
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

loader.config({ monaco });

if (typeof globalThis !== 'undefined') {
  globalThis.MonacoEnvironment = {
    getWorker(_workerId, label) {
      switch (label) {
        case 'json':
          return new jsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new htmlWorker();
        case 'typescript':
        case 'javascript':
          return new tsWorker();
        default:
          return new editorWorker();
      }
    }
  };
}
