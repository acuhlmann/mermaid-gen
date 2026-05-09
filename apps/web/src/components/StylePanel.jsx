import { useState } from 'react';
import { DEFAULT_DIAGRAM_STYLE, DiagramStyleSchema } from '@mermaid-architect/shared';

function formatStyleConfig(styleConfig) {
  return JSON.stringify(styleConfig, null, 2);
}

function formatZodError(error) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'styleConfig'}: ${issue.message}`).join('; ');
}

export default function StylePanel({ styleConfig, onApply, onRevert, onStylePrompt, loading }) {
  const [draft, setDraft] = useState(formatStyleConfig(styleConfig));
  const [stylePrompt, setStylePrompt] = useState('');
  const [error, setError] = useState('');

  function handleApply() {
    let parsed;
    try {
      parsed = JSON.parse(draft);
    } catch (parseError) {
      setError(`Invalid JSON: ${parseError.message}`);
      return;
    }

    const result = DiagramStyleSchema.safeParse(parsed);
    if (!result.success) {
      setError(`Invalid style config: ${formatZodError(result.error)}`);
      return;
    }

    setError('');
    onApply(result.data);
  }

  function handleRevert() {
    setDraft(formatStyleConfig(styleConfig));
    setError('');
    onRevert();
  }

  function handleResetDefault() {
    const defaultDraft = formatStyleConfig(DEFAULT_DIAGRAM_STYLE);
    setDraft(defaultDraft);
    setError('');
    onApply(DEFAULT_DIAGRAM_STYLE);
  }

  function handlePromptSubmit(event) {
    event.preventDefault();
    const nextPrompt = stylePrompt.trim();
    if (!nextPrompt) return;
    onStylePrompt(nextPrompt);
  }

  return (
    <aside className="style-panel">
      <h2>Diagram Style</h2>
      <label htmlFor="styleConfig">Mermaid init config</label>
      <textarea
        id="styleConfig"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck="false"
        rows={12}
      />
      {error ? <p className="style-error">{error}</p> : null}
      <div className="actions style-actions">
        <button type="button" onClick={handleApply} disabled={loading}>
          Apply style
        </button>
        <button type="button" onClick={handleResetDefault} disabled={loading}>
          Reset to default
        </button>
        <button type="button" onClick={handleRevert} disabled={loading}>
          Revert
        </button>
      </div>
      <form className="style-prompt" onSubmit={handlePromptSubmit}>
        <label htmlFor="stylePrompt">AI style prompt</label>
        <input
          id="stylePrompt"
          type="text"
          value={stylePrompt}
          onChange={(event) => setStylePrompt(event.target.value)}
          placeholder="Make it dark, rounded, and high contrast"
        />
        <button type="submit" disabled={loading || !stylePrompt.trim()}>
          Style with agent
        </button>
      </form>
    </aside>
  );
}
