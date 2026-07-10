import { describe, expect, it } from 'vitest';
import {
  buildRenderSelectionPrompt,
  contentModeLabel,
  isContentMode,
  selectableRenderModes
} from '../src/utils/renderModeAction.js';

describe('renderModeAction helpers', () => {
  it('marks only the active mode as disabled', () => {
    const options = selectableRenderModes('mermaid');
    expect(options.find((option) => option.id === 'mermaid')?.disabled).toBe(true);
    expect(options.find((option) => option.id === 'chart')?.disabled).toBe(false);
  });

  it('keeps concise implementation subtitles for picker rows', () => {
    const options = selectableRenderModes('mermaid');
    expect(options.map((option) => option.subtitle)).toEqual([
      'Mermaid architecture graph',
      'AntV narrative layout',
      'Three.js spatial scene',
      'Vega-Lite data view',
      'HTML/CSS/JS sandbox'
    ]);
  });

  it('validates supported content modes', () => {
    expect(isContentMode('anything')).toBe(true);
    expect(isContentMode('slides')).toBe(false);
  });

  it('builds a focused prompt for the clicked descriptor', () => {
    const prompt = buildRenderSelectionPrompt({
      descriptor: { clickedLabel: 'Billing API', partKind: 'node' },
      sourceMode: 'mermaid',
      targetMode: 'chart'
    });
    expect(prompt).toContain('Render "Billing API" as Chart.');
    expect(prompt).toContain('clicked a node');
    expect(prompt).toContain('current Diagram canvas');
  });

  it('falls back to a generic mode label for unknown values', () => {
    expect(contentModeLabel('unknown')).toBe('another mode');
  });
});
