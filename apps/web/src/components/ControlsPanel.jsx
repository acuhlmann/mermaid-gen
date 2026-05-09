import { useState } from 'react';

export default function ControlsPanel({
  temperature,
  onTemperatureChange,
  onApply,
  onUndo,
  onRegenerate,
  loading
}) {
  const [prompt, setPrompt] = useState('Add a data store and API gateway step.');

  return (
    <aside className="controls-panel">
      <h2>Agent Controls</h2>
      <label htmlFor="prompt">Prompt</label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={5}
      />

      <label htmlFor="temperature">Creativity ({temperature.toFixed(2)})</label>
      <input
        id="temperature"
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={temperature}
        onChange={(event) => onTemperatureChange(Number(event.target.value))}
      />

      <div className="actions">
        <button type="button" onClick={() => onApply(prompt)} disabled={loading || !prompt.trim()}>
          Apply change
        </button>
        <button type="button" onClick={onUndo} disabled={loading}>
          Undo
        </button>
        <button type="button" onClick={() => onRegenerate(prompt)} disabled={loading || !prompt.trim()}>
          Regenerate section
        </button>
      </div>
    </aside>
  );
}
