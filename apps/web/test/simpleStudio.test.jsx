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
  startOver: 'Start over',
  formatLabel: 'Format',
  formatHint: 'Auto picks for you',
  modeLabel: 'Screen',
  simpleLabel: 'Simple',
  officeLabel: 'Office',
  speedLabel: 'Speed or quality?',
  fastLabel: 'Fast',
  fastHint: 'Quick first version',
  qualityLabel: 'Thorough',
  qualityHint: 'Best quality, a bit slower',
  creating: 'Creating yours…',
  exitFullscreen: 'Exit fullscreen'
};

const modes = [
  { id: 'auto', label: 'Auto' },
  { id: 'mermaid', label: 'Diagram' },
  { id: 'chart', label: 'Chart' }
];

const brainCopy = {
  label: 'Speed or quality?',
  fast: 'Fast',
  fastHint: 'Quick first version',
  quality: 'Thorough',
  qualityHint: 'Best quality, a bit slower'
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
  const onSelectContentMode = vi.fn();
  const onSelectModelProfile = vi.fn();
  const onToggleFullscreen = vi.fn();
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
      modes={modes}
      contentMode="auto"
      onSelectContentMode={onSelectContentMode}
      modelProfile="fast"
      onSelectModelProfile={onSelectModelProfile}
      brainCopy={brainCopy}
      fullscreenSupported={false}
      isFullscreen={false}
      onToggleFullscreen={onToggleFullscreen}
      thinkingLines={[]}
      {...overrides}
    />
  );
  return {
    onSubmit,
    onEnterOffice,
    onStartOver,
    onSelectContentMode,
    onSelectModelProfile,
    onToggleFullscreen
  };
}

describe('SimpleStudioSlot', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a prompt and an office opt-in, with format defaulting to Auto', () => {
    const { onSubmit, onEnterOffice, onSelectContentMode, onSelectModelProfile } = renderStudio();

    expect(screen.getByText('Prompt anything into reality.')).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByTestId('simple-studio-format').value).toBe('auto');
    expect(screen.getByText('Auto picks for you')).toBeTruthy();
    expect(screen.getByTestId('simple-studio-brain-fast').getAttribute('aria-pressed')).toBe(
      'true'
    );
    // Speed reads as speed, not as a mood: labels plus one-line consequences.
    expect(screen.getByText('Speed or quality?')).toBeTruthy();
    expect(screen.getByText('Quick first version')).toBeTruthy();
    expect(screen.getByText('Best quality, a bit slower')).toBeTruthy();

    fireEvent.change(screen.getByTestId('simple-studio-format'), { target: { value: 'chart' } });
    expect(onSelectContentMode).toHaveBeenCalledWith('chart');
    fireEvent.click(screen.getByTestId('simple-studio-brain-quality'));
    expect(onSelectModelProfile).toHaveBeenCalledWith('quality');
    expect(screen.queryByTestId('studio-canvas')).toBeNull();
    expect(screen.queryByTestId('simple-studio-start-over')).toBeNull();

    fireEvent.click(screen.getByTestId('simple-studio-go'));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('simple-studio-prompt'), {
      target: { value: '  a signup form  ' }
    });
    fireEvent.click(screen.getByTestId('simple-studio-go'));
    expect(onSubmit).toHaveBeenCalledWith('a signup form');

    // The office is one half of a labelled screen switch, not a text link
    // buried under the form — and Simple shows itself as the current half.
    const officeSwitch = screen.getByTestId('view-mode-office');
    expect(officeSwitch.getAttribute('aria-pressed')).toBe('false');
    expect(officeSwitch.title).toMatch(/bad floor plan/);
    expect(screen.getByTestId('view-mode-simple').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(officeSwitch);
    expect(onEnterOffice).toHaveBeenCalledTimes(1);
  });

  it('keeps the interface language to one quiet pill, not four rows', () => {
    renderStudio();

    expect(screen.getByTestId('intro-locale-toggle')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText('Interface language')).toBeNull();
  });

  it('docks the prompt beside the result, offers fullscreen, and can start over', () => {
    const { onStartOver, onSubmit, onToggleFullscreen } = renderStudio({
      showCanvas: true,
      showStartOver: true,
      diagramSource: 'flowchart TD\n  A --> B',
      contentType: 'mermaid',
      fullscreenSupported: true
    });

    expect(screen.getByTestId('studio-canvas').textContent).toContain('A --> B');

    fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);

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

  it('shows a living peek of the thinking while a run is in flight', () => {
    renderStudio({
      busy: true,
      showCanvas: true,
      status: 'Working on your request...',
      thinkingLines: ['Sketching the main flow', 'Placing the decision points']
    });

    const peek = screen.getByTestId('simple-studio-peek');
    expect(peek.textContent).toContain('Creating yours…');
    expect(peek.textContent).toContain('Working on your request...');
    expect(peek.textContent).toContain('Sketching the main flow');
    expect(peek.textContent).toContain('Placing the decision points');
    expect(screen.getByTestId('simple-studio-go').disabled).toBe(true);
  });

  it('shows the peek skeleton before the first thinking line lands', () => {
    renderStudio({ busy: true, status: 'Thinking…', thinkingLines: [] });

    const peek = screen.getByTestId('simple-studio-peek');
    expect(peek.textContent).toContain('Thinking…');
    expect(peek.querySelector('.simple-studio-peek-skeleton')).toBeTruthy();
  });
});
