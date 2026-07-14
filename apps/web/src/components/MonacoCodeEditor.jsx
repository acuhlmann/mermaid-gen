import Editor from '@monaco-editor/react';
import '../setupMonaco.js';
import registerMermaidMonacoOnce from '../utils/registerMermaidMonacoOnce.js';
import registerInfographicMonacoOnce from '../utils/registerInfographicMonacoOnce.js';

/**
 * Monaco editor chunk — imported only when the diagram code panel opens.
 */
export default function MonacoCodeEditor({
  language,
  value,
  onChange,
  onMount,
  options,
  loadingLabel = 'Loading code editor…'
}) {
  const handleBeforeMount = (monaco) => {
    registerMermaidMonacoOnce(monaco);
    registerInfographicMonacoOnce(monaco);
  };

  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={value}
      beforeMount={handleBeforeMount}
      onMount={onMount}
      onChange={onChange}
      options={options}
      loading={<div className="monaco-editor-loading">{loadingLabel}</div>}
    />
  );
}
