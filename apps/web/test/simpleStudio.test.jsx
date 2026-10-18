// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimpleStudioSlot } from '../src/features/shell/SimpleStudioSlot.jsx';
import {
  STUDIO_RADIAL_ACTION_IDS,
  studioRadialActions
} from '../src/features/shell/studioCanvasEditProps.js';

const canvasProps = vi.hoisted(() => ({ last: null }));

vi.mock('../src/components/DiagramCanvas.jsx', () => ({
  default: function DiagramCanvasMock(props) {
    canvasProps.last = props;
    return <pre data-testid="studio-canvas">{props.diagramSource}</pre>;
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
  exitFullscreen: 'Exit fullscreen',
  examplesLabel: 'No topic yet? Try one:',
  examplesAria: 'Example prompts'
};

const starters = [
  { label: 'Coffee supply chain', prompt: 'Break down the global coffee supply chain' },
  { label: 'OAuth 2.0 flow', prompt: 'Explain how the OAuth 2.0 authorization code flow works' }
];

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
      starters={starters}
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

  it('only promises "Auto picks for you" while Auto is actually selected', () => {
    renderStudio({ contentMode: 'chart' });
    expect(screen.getByTestId('simple-studio-format').value).toBe('chart');
    expect(screen.queryByText('Auto picks for you')).toBeNull();
  });

  it('offers one-tap examples on the intro, and nowhere else', () => {
    const { onSubmit } = renderStudio();

    expect(screen.getByText('No topic yet? Try one:')).toBeTruthy();
    const chips = screen.getAllByTestId('simple-studio-starter');
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Coffee supply chain',
      'OAuth 2.0 flow'
    ]);

    fireEvent.click(chips[1]);
    expect(onSubmit).toHaveBeenCalledWith(
      'Explain how the OAuth 2.0 authorization code flow works'
    );

    cleanup();
    renderStudio({ showCanvas: true, diagramSource: 'flowchart TD\n  A --> B' });
    expect(screen.queryByTestId('simple-studio-starters')).toBeNull();
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

  it('keeps the canvas view-only when no editing wiring is passed', () => {
    renderStudio({ showCanvas: true, diagramSource: 'flowchart TD\n  A --> B' });

    expect(canvasProps.last.onSelectedNodeChange).toBeNull();
    expect(canvasProps.last.onNodeToolbarAnchor).toBeNull();
  });

  // Node editing on the studio canvas: the same radial menu the desk uses,
  // with the office cast filtered out.
  it('lets a node be edited on the canvas, without the office personas', () => {
    const descriptor = { id: 'flowchart-A-0', label: 'Alpha', partKind: 'node', partName: 'Alpha' };
    const onSelectedNodeChange = vi.fn();
    const onRadialActionPick = vi.fn();
    const handleConnectTarget = vi.fn();
    renderStudio({
      showCanvas: true,
      diagramSource: 'flowchart TD\n  A --> B',
      canvasEditing: {
        selectedNode: descriptor,
        hoverDescriptor: null,
        onSelectedNodeChange,
        onHoverTargetChange: vi.fn(),
        dismissRadialMenu: vi.fn(),
        closeRadialMenu: vi.fn(),
        cancelMenuClose: vi.fn(),
        scheduleMenuClose: vi.fn(),
        setToolbarAnchor: vi.fn(),
        toolbarAnchor: null,
        radialMenuSession: {
          descriptor,
          anchor: {
            left: 200,
            top: 220,
            nodeTop: 160,
            nodeBottom: 200,
            nodeLeft: 160,
            nodeRight: 240,
            centerY: 180
          }
        },
        radialActions: [
          { id: 'rename', label: 'Rename', group: 'primary', persona: 'Rename' },
          { id: 'delete', label: 'Delete', group: 'primary', persona: 'Delete' },
          { id: 'gilfoyle', label: 'Refine', persona: 'THE Engineer' },
          { id: 'russ', label: 'Make it pop', persona: 'Russ Hanneman' },
          { id: 'stakeholders', label: 'Stakeholders', group: 'primary' }
        ],
        onRadialActionPick,
        graphEdit: { connectSourceId: 'A', handleConnectTarget },
        graphEditCopy: { undo: 'Undo' }
      }
    });

    expect(canvasProps.last.onSelectedNodeChange).toBe(onSelectedNodeChange);
    expect(canvasProps.last.selectedNode).toBe(descriptor);
    expect(canvasProps.last.connectSourceId).toBe('A');
    expect(canvasProps.last.onConnectTarget).toBe(handleConnectTarget);

    // First selection shows the one-time precision-editing intro.
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Rename/ }));
    expect(onRadialActionPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rename' }),
      descriptor
    );
    expect(screen.getByRole('menuitem', { name: /^Delete/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Refine/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Make it pop/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Stakeholders/ })).toBeNull();
  });
});

describe('studioRadialActions', () => {
  it('keeps direct edits and the explainer, drops the office cast', () => {
    const ids = studioRadialActions([
      { id: 'connect' },
      { id: 'link' },
      { id: 'delete' },
      { id: 'rename' },
      { id: 'definition' },
      { id: 'stakeholders' },
      { id: 'prompt' },
      { id: 'renderMode' },
      { id: 'gilfoyle' },
      { id: 'dinesh' },
      { id: 'erlich' },
      { id: 'russ' },
      { id: 'barker' },
      { id: 'jared' },
      { id: 'fix' },
      { id: 'richard' },
      null
    ]).map((action) => action.id);

    expect(ids).toEqual(['connect', 'link', 'delete', 'rename', 'definition']);
    expect([...STUDIO_RADIAL_ACTION_IDS].sort()).toEqual([...ids].sort());
    expect(studioRadialActions(null)).toEqual([]);
  });
});
