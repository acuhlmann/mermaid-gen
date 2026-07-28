// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeskBottomActionsSlot } from '../src/features/desk/DeskBottomActionsSlot.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';
import { ButtonIcon } from '../src/components/AppIcons.jsx';

const MODES = [
  { id: 'mermaid', label: 'Diagram', shortLabel: 'Diagram', techLabel: 'Mermaid' },
  { id: 'chart', label: 'Chart', shortLabel: 'Chart', techLabel: 'Vega-Lite' }
];
const Icon = () => <span />;

function baseProps(overrides = {}) {
  return {
    hasCanvasContent: false,
    insightsOpen: false,
    showEntryDeskIntro: false,
    showEntryDeskPointers: false,
    entryTourStep: null,
    entryReveal: {
      workOrder: true,
      desk: true,
      team: true,
      notebook: true,
      drawer: true
    },
    deskDrawerTourOpen: false,
    narrowLayout: false,
    busy: false,
    loading: false,
    streamingPreview: false,
    controls: CONTROLS_EN,
    userName: 'Gavin',
    contentMode: 'mermaid',
    contentModeOptions: MODES,
    deskSlotRef: vi.fn(),
    deskPrompt: '',
    setDeskPrompt: vi.fn(),
    voiceSupported: false,
    voiceListening: false,
    speechRecognitionCtor: null,
    PromptIcon: Icon,
    MicIcon: Icon,
    MicActiveIcon: Icon,
    ButtonIcon,
    handleDeskPromptSubmit: vi.fn(),
    handleMicToggleClick: vi.fn(),
    handleMicPointerDown: vi.fn(),
    handleMicPointerUp: vi.fn(),
    stopVoiceInput: vi.fn(),
    dismissEntryDeskPointers: vi.fn(),
    advanceEntryTour: vi.fn(),
    handleEntryModePick: vi.fn(),
    runTransform: vi.fn(),
    runAnalyze: vi.fn(),
    advisor: {
      activePersona: null,
      thinkingPersona: null,
      promptNext: vi.fn(),
      isMuted: false,
      toggleMute: vi.fn()
    },
    advisorBubbleProps: null,
    stakeholderIntroProps: null,
    advisorPause: false,
    russStreak: 0,
    diagramSource: '',
    onCallMeeting: vi.fn(),
    handleSelectContentMode: vi.fn(),
    latestCritique: null,
    canFixFromCritique: false,
    handleFixFromCritique: vi.fn(),
    handleClearDiagram: vi.fn(),
    ...overrides
  };
}

describe('DeskBottomActionsSlot empty canvas', () => {
  afterEach(() => cleanup());

  it('shows desk chrome on an empty canvas without assignment tabs', () => {
    render(<DeskBottomActionsSlot {...baseProps()} />);
    expect(screen.queryByTestId('topic-starters')).toBeNull();
    expect(screen.getByLabelText(/Work order/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /desk tray/i })).toBeTruthy();
  });

  it('submits the work order without a separate format strip', async () => {
    let deskPrompt = '';
    const handleDeskPromptSubmit = vi.fn();
    const props = baseProps({ deskPrompt, handleDeskPromptSubmit });
    const setDeskPrompt = vi.fn((value) => {
      deskPrompt = value;
      view.rerender(
        <DeskBottomActionsSlot {...props} deskPrompt={deskPrompt} setDeskPrompt={setDeskPrompt} />
      );
    });
    props.setDeskPrompt = setDeskPrompt;
    const view = render(<DeskBottomActionsSlot {...props} />);

    expect(screen.queryByTestId('entry-render-as')).toBeNull();
    expect(screen.getByRole('button', { name: /desk tray/i })).toBeTruthy();

    const input = screen.getByLabelText(/Work order/i);
    fireEvent.change(input, { target: { value: 'Coffee supply chain' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Do it' }).disabled).toBe(false);
    });
    fireEvent.submit(screen.getByLabelText(/Work order/i).closest('form'));
    expect(handleDeskPromptSubmit).toHaveBeenCalledWith('Coffee supply chain');
  });

  it('keeps the desk tray closed by default on an empty canvas', () => {
    render(<DeskBottomActionsSlot {...baseProps()} />);
    expect(screen.getByRole('button', { name: /desk tray/i })).toBeTruthy();
    expect(screen.queryByRole('menu', { name: /Desk tray/i })).toBeNull();
    expect(screen.queryByTestId('entry-render-as')).toBeNull();
  });

  it('does not render concentration controls on the desk chrome row', () => {
    const onToggleThinking = vi.fn();
    render(
      <DeskBottomActionsSlot
        {...baseProps({
          hasCanvasContent: true,
          onToggleThinking
        })}
      />
    );
    expect(screen.getByTestId('desk-notebook-button')).toBeTruthy();
    expect(screen.queryByTestId('concentration-control')).toBeNull();
    expect(screen.queryByTestId('desk-concentration-chip')).toBeNull();
    fireEvent.click(screen.getByTestId('desk-notebook-button'));
    expect(onToggleThinking).toHaveBeenCalledTimes(1);
  });

  it('anchors desk tour pointers on the real chrome row', () => {
    render(
      <DeskBottomActionsSlot
        {...baseProps({
          entryTourActive: true,
          entryTourStep: 'work-order',
          entryTourProgress: { index: 0, total: 5 },
          entryPointers: CONTROLS_EN.prompt.entryPointers,
          entryTourCopy: CONTROLS_EN.prompt.entryTour
        })}
      />
    );
    expect(screen.getByTestId('entry-desk-pointers')).toBeTruthy();
    expect(screen.getByText('Work order')).toBeTruthy();
    expect(screen.getByText(/Pitch your topic here/i)).toBeTruthy();
  });
});
