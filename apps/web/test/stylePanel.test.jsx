// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DIAGRAM_STYLE } from '@mermaid-architect/shared';
import StylePanel from '../src/components/StylePanel.jsx';

const baseStyle = {
  theme: 'base',
  look: 'neo',
  themeVariables: {
    primaryColor: '#d7ffb8',
    primaryTextColor: '#3c3c3c',
    primaryBorderColor: '#58cc02'
  },
  themeCSS: '',
  flowchart: { curve: 'rounded' }
};

describe('StylePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('applies valid advanced style JSON', () => {
    const onApply = vi.fn();
    render(
      <StylePanel
        styleConfig={baseStyle}
        onApply={onApply}
        onRevert={vi.fn()}
        onStylePrompt={vi.fn()}
        loading={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Mermaid init config'), {
      target: {
        value: JSON.stringify({
          ...baseStyle,
          theme: 'dark',
          flowchart: { curve: 'rounded' }
        })
      }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply style' }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'dark',
        flowchart: { curve: 'rounded' }
      })
    );
  });

  it('shows validation errors for invalid JSON', () => {
    render(
      <StylePanel
        styleConfig={baseStyle}
        onApply={vi.fn()}
        onRevert={vi.fn()}
        onStylePrompt={vi.fn()}
        loading={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Mermaid init config'), {
      target: { value: '{"theme":' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply style' }));

    expect(screen.getByText(/Invalid JSON/)).toBeTruthy();
  });

  it('resets style config to the shared default theme', () => {
    const onApply = vi.fn();
    render(
      <StylePanel
        styleConfig={{
          ...baseStyle,
          theme: 'dark',
          themeVariables: {},
          flowchart: { curve: 'linear' }
        }}
        onApply={onApply}
        onRevert={vi.fn()}
        onStylePrompt={vi.fn()}
        loading={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));

    expect(onApply).toHaveBeenCalledWith(DEFAULT_DIAGRAM_STYLE);
    expect(screen.getByLabelText('Mermaid init config').value).toContain('"theme": "base"');
  });

  it('reverts to the last committed style', () => {
    const onRevert = vi.fn();
    render(
      <StylePanel
        styleConfig={baseStyle}
        onApply={vi.fn()}
        onRevert={onRevert}
        onStylePrompt={vi.fn()}
        loading={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Mermaid init config'), {
      target: { value: '{"theme":' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));

    expect(onRevert).toHaveBeenCalled();
    expect(screen.getByLabelText('Mermaid init config').value).toContain('"theme": "base"');
  });

  it('submits AI style prompts', () => {
    const onStylePrompt = vi.fn();
    render(
      <StylePanel
        styleConfig={baseStyle}
        onApply={vi.fn()}
        onRevert={vi.fn()}
        onStylePrompt={onStylePrompt}
        loading={false}
      />
    );

    fireEvent.change(screen.getByLabelText('AI style prompt'), {
      target: { value: 'Make it dark and rounded' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Style with agent' }));

    expect(onStylePrompt).toHaveBeenCalledWith('Make it dark and rounded');
  });
});
