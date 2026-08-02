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
    onOpenContractor: vi.fn(),
    onOpenHrProgression: vi.fn(),
    onOpenHotkeys: vi.fn(),
    headphones: false,
    focusTime: false,
    onToggleHeadphones: vi.fn(),
    onToggleFocusTime: vi.fn(),
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
  it('renders the three menus as a menubar', () => {
    setup();
    expect(screen.getByRole('menubar', { name: MENU.aria })).toBeTruthy();
    for (const id of ['deliverable', 'mailroom', 'admin']) {
      expect(screen.getByTestId(`desk-os-menu-trigger-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('desk-os-menu-trigger-admin').textContent).toMatch(/Settings/);
    expect(screen.queryByTestId('desk-os-menu-trigger-view')).toBeNull();
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
  // you had to know to open. Renders as a compact counter slip.
  it('opens the mailroom export panel one click deep', () => {
    setup({ contentType: 'mermaid', diagramSource: 'flowchart TD\n  A-->B' });
    openMenu('mailroom');
    const menu = screen.getByTestId('desk-os-menu-mailroom');
    expect(menu.className).toContain('desk-os-menu-dropdown--compact');
    expect(screen.getByRole('region', { name: /Mailroom/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export/i })).toBeTruthy();
    expect(menu.textContent).toMatch(/Window 3/i);
  });

  it('shows a compact empty slip when the mailroom has nothing to ship', () => {
    setup({ contentType: 'mermaid', diagramSource: '' });
    openMenu('mailroom');
    expect(screen.queryByRole('button', { name: /Export/i })).toBeNull();
    expect(screen.getByText(/Nothing queued/i)).toBeTruthy();
  });

  // These came off the desk stamp: they are once-a-session verbs and were
  // crowding out the office verbs that are not. External agents used to sit
  // here too, but it opened the settings/code panel — Onboard a contractor is
  // the real MCP invite doorway.
  it('dispatches the admin verbs that moved off the desk stamp', () => {
    const handlers = setup();
    for (const [testId, key] of [
      ['menubar-contractor', 'onOpenContractor'],
      ['menubar-hr', 'onOpenHrProgression'],
      ['menubar-hotkeys', 'onOpenHotkeys']
    ]) {
      openMenu('admin');
      fireEvent.click(screen.getByTestId(testId));
      expect(handlers[key]).toHaveBeenCalledTimes(1);
    }
    openMenu('admin');
    expect(screen.queryByTestId('menubar-external-agents')).toBeNull();
  });

  it('hides keyboard shortcuts in Admin on touch-first devices', () => {
    const orig = window.matchMedia;
    window.matchMedia = (query) => {
      if (query === '(pointer: coarse)') {
        return {
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {}
        };
      }
      return orig(query);
    };
    try {
      setup();
      openMenu('admin');
      expect(screen.queryByTestId('menubar-hotkeys')).toBeNull();
    } finally {
      window.matchMedia = orig;
    }
  });

  it('keeps the language pack reachable from Admin', () => {
    setup();
    openMenu('admin');
    expect(screen.getByTestId('menubar-language-pack')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /English/i })).toBeTruthy();
  });

  // Headphones / Focus and Approved vendors left the desk stamp for Admin.
  it('hosts office ambience postures, concentration, and Approved vendors in Admin', () => {
    const handlers = setup({
      headphones: false,
      focusTime: false,
      modelProfile: 'fast',
      onSelectModelProfile: vi.fn()
    });
    openMenu('admin');
    expect(screen.getByTestId('desk-admin-concentration')).toBeTruthy();
    const concentration = screen.getByTestId('concentration-control');
    expect(concentration.className).toContain('concentration-control--tray');
    expect(concentration.textContent).toMatch(/Rush job/);
    expect(concentration.textContent).toMatch(/Deep work/);
    const ambience = screen.getByTestId('desk-ambience-pack');
    expect(screen.getByTestId('desk-ambience-headphones').textContent).toContain('Headphones');
    expect(screen.getByTestId('desk-ambience-focus').textContent).toContain('Focus');
    expect(ambience.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('desk-ambience-headphones').querySelector('input'));
    expect(handlers.onToggleHeadphones).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('desk-ambience-focus').querySelector('input'));
    expect(handlers.onToggleFocusTime).toHaveBeenCalledWith(true);
    const strip = screen.getByTestId('desk-attribution-strip');
    expect(strip.textContent).toMatch(/Approved vendors/);
    expect(screen.getByRole('link', { name: 'ElevenLabs' }).getAttribute('href')).toBe(
      'https://elevenlabs.io'
    );
  });

  it('reflects headphones-on so the posture survives a reload', () => {
    setup({ headphones: true });
    openMenu('admin');
    expect(screen.getByTestId('desk-ambience-headphones').querySelector('input').checked).toBe(
      true
    );
  });

  it('opens one menu at a time', () => {
    setup();
    openMenu('deliverable');
    expect(screen.getByTestId('desk-os-menu-deliverable')).toBeTruthy();
    openMenu('admin');
    expect(screen.queryByTestId('desk-os-menu-deliverable')).toBeNull();
    expect(screen.getByTestId('desk-os-menu-admin')).toBeTruthy();
  });

  it('switches menus on hover only once one is already open', () => {
    setup();
    fireEvent.pointerEnter(screen.getByTestId('desk-os-menu-trigger-admin'));
    expect(screen.queryByRole('menu')).toBeNull();

    openMenu('deliverable');
    fireEvent.pointerEnter(screen.getByTestId('desk-os-menu-trigger-admin'));
    expect(screen.getByTestId('desk-os-menu-admin')).toBeTruthy();
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
