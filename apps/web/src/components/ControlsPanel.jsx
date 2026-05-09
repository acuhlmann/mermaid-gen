export default function ControlsPanel({
  settings,
  onSettingsChange,
  onUndo,
  onCoAuthorExtend,
  loading,
  prompt
}) {
  return (
    <aside className="controls-panel">
      <h2>Agent Settings</h2>
      <label htmlFor="temperature">Temperature ({settings.temperature.toFixed(2)})</label>
      <input
        id="temperature"
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={settings.temperature}
        onChange={(event) => onSettingsChange('temperature', Number(event.target.value))}
      />

      <label htmlFor="topP">Top P ({settings.topP.toFixed(2)})</label>
      <input
        id="topP"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={settings.topP}
        onChange={(event) => onSettingsChange('topP', Number(event.target.value))}
      />

      <label htmlFor="maxNodes">Max added nodes ({settings.maxNodes})</label>
      <input
        id="maxNodes"
        type="number"
        min="1"
        max="200"
        value={settings.maxNodes}
        onChange={(event) => onSettingsChange('maxNodes', Number(event.target.value))}
      />

      <label htmlFor="styleGuide">Style</label>
      <select
        id="styleGuide"
        value={settings.styleGuide}
        onChange={(event) => onSettingsChange('styleGuide', event.target.value)}
      >
        <option value="concise">Concise</option>
        <option value="balanced">Balanced</option>
        <option value="bold">Bold</option>
      </select>

      <label htmlFor="persona">Persona</label>
      <input
        id="persona"
        type="text"
        value={settings.persona}
        onChange={(event) => onSettingsChange('persona', event.target.value)}
      />

      <section className="coauthor-section" aria-label="Co-author controls">
        <h3>Co-Author Surprise Mode</h3>
        <p>Use this to let the creative co-author agent extend the current diagram on demand.</p>
        <button type="button" onClick={() => onCoAuthorExtend(prompt)} disabled={loading || !prompt.trim()}>
          Surprise me (Co-Author)
        </button>
      </section>

      <div className="actions">
        <button type="button" onClick={onUndo} disabled={loading}>
          Undo
        </button>
      </div>
    </aside>
  );
}
