import initMermaidMonaco from 'monaco-mermaid';

let registered = false;

/** Registers monaco-mermaid once (safe under React Strict Mode double-invoke). */
export default function registerMermaidMonacoOnce(monaco) {
  if (registered) return;
  registered = true;
  initMermaidMonaco(monaco);
}
