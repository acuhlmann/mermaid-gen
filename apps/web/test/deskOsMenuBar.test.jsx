// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeskOsMenuBar from '../src/components/DeskOsMenuBar.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';
import { resetOverlayStackForTests } from '../src/state/overlayStack.js';

const MODES = [
  { id: 'auto', label: 'Auto', techLabel: 'Pick for me' },
  { id: 'mermaid', label: 'Diagram', techLabel: 'Mermaid' },
  { id: 'chart', label: 'Chart', techLabel: 'Vega-Lite' }
];

const MENU = CONTROLS_EN.menuBar;

function setup(overrides = {}) {
  const handlers = {
    modes: MODES,
    currentMode: 'mermaid',
    onPickMode: vi.fn(),
    onClearDiagram: vi.fn(),
    onToggleEditor: vi.fn(),
    onToggleNotebook: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onOpenContractor: vi.fn(),
    onOpenExternalAgents: vi.fn(),
    onOpenHrProgression: vi.fn(),
    onOpenHotkeys: vi.fn(),
    ...overrides
  };
  render(<DeskOsMenuBar {...handlers} />);
  return handlers;
}

function openMenu(id) {
  fireEvent.click(screen.getByTestId(`desk-os-menu-trigger-${id}`));
}

afterEach(() => {
  cleanup();
  resetOverlayStackForTests();
});

describe('DeskOsMenuBar', () => {
  it('renders the four menus as a menubar', () => {
    setup();
    expect(screen.getByRole('menubar', { name: MENU.aria })).toBeTruthy();
    for (const id of ['deliverable', 'mailroom', 'view', 'admin']) {
      expect(screen.getByTestId(`desk-os-menu-trigger-${id}`)).toBeTruthy();
    }
  });

  // The dismantled DeskDrawer's job, one level up.
  it('lists every deliverable format and tags the current one', () => {
    setup();
    openMenu('deliverable');
    expect(screen.getByRole('menuitem', { name: /^Auto/ })).toBeTruthy();
    const current = screen.getByRole('menuitem', { name: /^Diagram/ });
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(current.disabled).toBe(true);
  });

  it('picks a format and closes the menu', () => {
    const handlers = setup();
    openMenu('deliverable');
    fireEvent.click(screen.getByRole('menuitem', { name: /^Chart/ }));
    expect(handlers.onPickMode).toHaveBeenCalledWith('chart');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables every format while a run is streaming', () => {
    setup({ modeDisabled: true });
    openMenu('deliverable');
    expect(screen.getByRole('menuitem', { name: /^Chart/ }).disabled).toBe(true);
  });

  it('runs the shredder from the Deliverable menu', () => {
    const handlers = setup();
    openMenu('deliverable');
    fireEvent.click(screen.getByTestId('menubar-shredder'));
    expect(handlers.onClearDiagram).toHaveBeenCalledTimes(1);
  });

  // Eleven export formats used to sit behind an expandable row inside a menu
  // you had to know to open.
  it('opens the mailroom export panel one click deep', () => {
    setup({ contentType: 'mermaid', diagramSource: 'flowchart TD\n  A-->B' });
    openMenu('mailroom');
    expect(screen.getByRole('region', { name: /Mailroom/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export/i })).toBeTruthy();
  });

  it('toggles the docked panes from the View menu', () => {
    const handlers = setup({ notebookOpen: true });
    openMenu('view');
    const notebook = screen.getByTestId('menubar-notebook-toggle');
    expect(notebook.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(notebook);
    expect(handlers.onToggleNotebook).toHaveBeenCalledTimes(1);

    openMenu('view');
    fireEvent.click(screen.getByTestId('menubar-editor-toggle'));
    expect(handlers.onToggleEditor).toHaveBeenCalledTimes(1);
  });

  it('hides fullscreen when the browser does not support it', () => {
    setup({ fullscreenSupported: false });
    openMenu('view');
    expect(screen.queryByTestId('menubar-fullscreen')).toBeNull();
  });

  // These four came off the desk stamp: they are once-a-session verbs and were
  // crowding out the office verbs that are not.
  it('dispatches the admin verbs that moved off the desk stamp', () => {
    const handlers = setup();
    for (const [testId, key] of [
      ['menubar-contractor', 'onOpenContractor'],
      ['menubar-external-agents', 'onOpenExternalAgents'],
      ['menubar-hr', 'onOpenHrProgression'],
      ['menubar-hotkeys', 'onOpenHotkeys']
    ]) {
      openMenu('admin');
      fireEvent.click(screen.getByTestId(testId));
      expect(handlers[key]).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps the language pack reachable from Admin', () => {
    setup();
    openMenu('admin');
    expect(screen.getByTestId('menubar-language-pack')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /English/i })).toBeTruthy();
  });

  it('opens one menu at a time', () => {
    setup();
    openMenu('deliverable');
    expect(screen.getByTestId('desk-os-menu-deliverable')).toBeTruthy();
    openMenu('view');
    expect(screen.queryByTestId('desk-os-menu-deliverable')).toBeNull();
    expect(screen.getByTestId('desk-os-menu-view')).toBeTruthy();
  });

  it('switches menus on hover only once one is already open', () => {
    setup();
    fireEvent.pointerEnter(screen.getByTestId('desk-os-menu-trigger-view'));
    expect(screen.queryByRole('menu')).toBeNull();

    openMenu('deliverable');
    fireEvent.pointerEnter(screen.getByTestId('desk-os-menu-trigger-view'));
    expect(screen.getByTestId('desk-os-menu-view')).toBeTruthy();
    expect(screen.queryByTestId('desk-os-menu-deliverable')).toBeNull();
  });

  it('closes on Escape', () => {
    setup();
    openMenu('admin');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('highlights the Deliverable menu for the entry tour beat that points at it', () => {
    setup({ tourHighlight: 'deliverable' });
    expect(screen.getByTestId('desk-os-menu-trigger-deliverable').className).toContain(
      'is-tour-highlight'
    );
  });
});
