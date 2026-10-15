// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimpleStudioSlot } from '../src/features/shell/SimpleStudioSlot.jsx';

vi.mock('../src/components/DiagramCanvas.jsx', () => ({
  default: function DiagramCanvasMock({ diagramSource }) {
    return <pre data-testid="studio-canvas">{diagramSource}</pre>;
  }
}));

const copy = {
  wordmark: 'archislop',
  headline: 'Prompt anything into reality.',
  placeholder: "Describe it. We'll pick the shape.",
  go: 'Go',
  officeCta: 'Unleash the coworkers',
  officeHint: 'A whole fake office. They have opinions and a bad floor plan.',
  startOver: 'Start over'
};

const localeCopy = {
  aria: 'Interface language',
  en: 'English',
  enAu: 'Aussie Slang',
  zhCn: 'Simplified Chinese',
  zhTw: 'Traditional Chinese'
};

function renderStudio(overrides = {}) {
  const onSubmit = vi.fn();
  const onEnterOffice = vi.fn();
  const onStartOver = vi.fn();
  render(
    <SimpleStudioSlot
      copy={copy}
      localeCopy={localeCopy}
      locale="en"
      onSelectLocale={vi.fn()}
      busy={false}
      status=""
      stoppable={false}
      stopLabel="Stop request"
      onStop={vi.fn()}
      onSubmit={onSubmit}
      onEnterOffice={onEnterOffice}
      onStartOver={onStartOver}
      showCanvas={false}
      showStartOver={false}
      revisionId={0}
      diagramSource=""
      contentType="mermaid"
      rendererRefreshKey={0}
      streamingPreview={false}
      onManualEdit={vi.fn()}
      onValidationChange={vi.fn()}
      onFormSubmit={vi.fn()}
      diagramSurfaceRef={{ current: null }}
      {...overrides}
    />
  );
  return { onSubmit, onEnterOffice, onStartOver };
}

describe('SimpleStudioSlot', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a prompt and an office opt-in, with no format picker', () => {
    const { onSubmit, onEnterOffice } = renderStudio();

    expect(screen.getByText('Prompt anything into reality.')).toBeTruthy();
    expect(screen.getByText(/bad floor plan/)).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.queryByTestId('studio-canvas')).toBeNull();
    expect(screen.queryByTestId('simple-studio-start-over')).toBeNull();

    fireEvent.click(screen.getByTestId('simple-studio-go'));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('simple-studio-prompt'), {
      target: { value: '  a signup form  ' }
    });
    fireEvent.click(screen.getByTestId('simple-studio-go'));
    expect(onSubmit).toHaveBeenCalledWith('a signup form');

    fireEvent.click(screen.getByTestId('simple-studio-office'));
    expect(onEnterOffice).toHaveBeenCalledTimes(1);
  });

  it('docks the prompt beside the result and can start over', () => {
    const { onStartOver, onSubmit } = renderStudio({
      showCanvas: true,
      showStartOver: true,
      diagramSource: 'flowchart TD\n  A --> B',
      contentType: 'mermaid'
    });

    expect(screen.getByTestId('studio-canvas').textContent).toContain('A --> B');
    fireEvent.click(screen.getByTestId('simple-studio-start-over'));
    expect(onStartOver).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByTestId('simple-studio-prompt'), {
      target: { value: 'make the arrows clearer' }
    });
    fireEvent.keyDown(screen.getByTestId('simple-studio-prompt'), {
      key: 'Enter',
      shiftKey: false
    });
    expect(onSubmit).toHaveBeenCalledWith('make the arrows clearer');
  });
});
