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
      notebook: true
    },
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

    const input = screen.getByLabelText(/Work order/i);
    fireEvent.change(input, { target: { value: 'Coffee supply chain' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Do it' }).disabled).toBe(false);
    });
    fireEvent.submit(screen.getByLabelText(/Work order/i).closest('form'));
    expect(handleDeskPromptSubmit).toHaveBeenCalledWith('Coffee supply chain');
  });

  // Slice 2 dismantled the Desk tray: Deliverable format and Shredder are
  // menu-bar items now (`DeskOsMenuBar`), so the desk row carries none of it.
  it('no longer carries the desk tray or a format strip', () => {
    render(<DeskBottomActionsSlot {...baseProps()} />);
    expect(screen.queryByRole('button', { name: /desk tray/i })).toBeNull();
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

  it('keeps the notebook toggle enabled while a run is busy', () => {
    const onToggleThinking = vi.fn();
    render(
      <DeskBottomActionsSlot
        {...baseProps({
          hasCanvasContent: true,
          busy: true,
          onToggleThinking
        })}
      />
    );
    const notebookBtn = screen.getByTestId('desk-notebook-button');
    expect(notebookBtn.disabled).toBe(false);
    fireEvent.click(notebookBtn);
    expect(onToggleThinking).toHaveBeenCalledTimes(1);
  });

  it('shows a live notebook cue when a run is in flight and the pane is closed', () => {
    const onToggleThinking = vi.fn();
    render(
      <DeskBottomActionsSlot
        {...baseProps({
          hasCanvasContent: true,
          insightsOpen: false,
          busy: true,
          liveStreamingEntry: {
            status: 'running',
            variant: 'gilfoyle',
            statusText: 'Still working…'
          },
          onToggleThinking
        })}
      />
    );
    expect(screen.getByTestId('desk-notebook-live-cue')).toBeTruthy();
    fireEvent.click(screen.getByTestId('desk-notebook-live-cue'));
    expect(onToggleThinking).toHaveBeenCalledTimes(1);
  });

  it('hides the live notebook cue while the pane is open', () => {
    render(
      <DeskBottomActionsSlot
        {...baseProps({
          hasCanvasContent: true,
          insightsOpen: true,
          busy: true,
          liveStreamingEntry: {
            status: 'running',
            variant: 'gilfoyle',
            statusText: 'Still working…'
          }
        })}
      />
    );
    expect(screen.queryByTestId('desk-notebook-live-cue')).toBeNull();
  });

  it('shows the notebook toggle when the pane is open without canvas content', () => {
    const onToggleThinking = vi.fn();
    render(
      <DeskBottomActionsSlot
        {...baseProps({
          hasCanvasContent: false,
          insightsOpen: true,
          onToggleThinking
        })}
      />
    );
    expect(screen.getByTestId('desk-notebook-button')).toBeTruthy();
    expect(screen.queryByLabelText(/Work order/i)).toBeNull();
    fireEvent.click(screen.getByTestId('desk-notebook-button'));
    expect(onToggleThinking).toHaveBeenCalledTimes(1);
  });

  // The comms anchor left this row for the taskbar (docs/office-window-manager.md
  // §11) — the composer band must NOT reintroduce one, or OfficeLayer's portal
  // would have two targets and `deskSlotStore` holds exactly one element.
  it('leaves the comms anchor to the taskbar and keeps the notebook here', () => {
    render(
      <DeskBottomActionsSlot
        {...baseProps({
          hasCanvasContent: true,
          insightsOpen: true
        })}
      />
    );
    expect(document.getElementById('office-desk-bottom-slot')).toBeNull();
    expect(screen.getByTestId('desk-notebook-button')).toBeTruthy();
  });

  // Pair is aimed at one person, so it rides on that person's row — the same
  // reason Fix rides on Jared's. Mob stays in the team-actions block above.
  it('offers Pair on every teammate row, naming who is in the chair', () => {
    const onPair = vi.fn();
    // `onTalk` is what turns a row into sibling buttons, which is what row-level
    // chips hang off — see StakeholdersMascot's `extraActions`.
    render(
      <DeskBottomActionsSlot {...baseProps({ onPair, onTalk: vi.fn(), onHuddle: vi.fn() })} />
    );
    const chips = screen.getAllByTestId(/^stakeholders-extra-.*-pair$/);
    expect(chips.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByTestId('stakeholders-extra-gilfoyle-pair'));
    expect(onPair).toHaveBeenCalledWith('gilfoyle');
  });

  it('drops the Pair chip entirely when the shell cannot start one', () => {
    render(<DeskBottomActionsSlot {...baseProps({ onTalk: vi.fn(), onHuddle: vi.fn() })} />);
    expect(screen.queryAllByTestId(/^stakeholders-extra-.*-pair$/)).toHaveLength(0);
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
    expect(screen.getByText('1 · Work order')).toBeTruthy();
    expect(screen.getByText(/Type what you want built here/i)).toBeTruthy();
  });
});
