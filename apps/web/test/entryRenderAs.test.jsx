// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntryRenderAs from '../src/components/EntryRenderAs.jsx';

const MODES = [
  { id: 'mermaid', shortLabel: 'Diagram', subtitle: 'Mermaid graph' },
  { id: 'chart', shortLabel: 'Chart', subtitle: 'Vega-Lite data view' },
  { id: 'metaphor3d', shortLabel: '3D', subtitle: 'Three.js scene' }
];

describe('EntryRenderAs', () => {
  afterEach(() => cleanup());

  it('renders label and mode chips', () => {
    render(
      <EntryRenderAs
        label="Render as"
        modes={MODES}
        currentMode="mermaid"
        onPickMode={vi.fn()}
      />
    );
    expect(screen.getByTestId('entry-render-as')).toBeTruthy();
    expect(screen.getByText('Render as')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chart' })).toBeTruthy();
  });

  it('marks the current mode and fires onPickMode', () => {
    const onPickMode = vi.fn();
    render(
      <EntryRenderAs
        label="Render as"
        modes={MODES}
        currentMode="mermaid"
        onPickMode={onPickMode}
      />
    );
    expect(screen.getByRole('button', { name: 'Diagram' }).className).toContain('is-current');
    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    expect(onPickMode).toHaveBeenCalledWith('metaphor3d');
  });

  it('renders nothing without usable modes', () => {
    const { container } = render(<EntryRenderAs modes={[]} label="Render as" />);
    expect(container.querySelector('[data-testid="entry-render-as"]')).toBeNull();
  });
});
