// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import RadialActionMenu from '../src/components/RadialActionMenu.jsx';

const ANCHOR = {
  left: 200,
  top: 220,
  nodeTop: 160,
  nodeBottom: 200,
  nodeLeft: 160,
  nodeRight: 240,
  centerY: 180
};

const DESCRIPTOR = {
  id: 'flowchart-A-0',
  label: 'Alpha',
  partKind: 'node',
  partName: 'Alpha'
};

const ACTIONS = [
  { id: 'refine', label: 'Refine', icon: 'R', variant: 'refine', persona: 'THE Engineer' },
  {
    id: 'erlich',
    label: 'Erlich',
    icon: 'I',
    variant: 'erlich',
    persona: 'Erlich Bachman'
  },
  { id: 'critique', label: 'Critique', icon: 'C', variant: 'critique', persona: 'The Auditor' }
];

function renderMenu(props = {}) {
  return render(
    <RadialActionMenu
      descriptor={DESCRIPTOR}
      anchor={ANCHOR}
      actions={ACTIONS}
      onActionPick={vi.fn()}
      onBackdropPointerDown={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />
  );
}

describe('RadialActionMenu keyboard navigation', () => {
  afterEach(() => {
    cleanup();
  });

  it('first action button is tabbable by default; others are not', () => {
    renderMenu();
    const buttons = screen.getAllByRole('menuitem');
    expect(buttons.length).toBe(ACTIONS.length);
    expect(buttons[0].tabIndex).toBe(0);
    for (let i = 1; i < buttons.length; i += 1) {
      expect(buttons[i].tabIndex).toBe(-1);
    }
  });

  it('ArrowRight moves the tabbable index forward', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Diagram selection actions' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    const buttons = screen.getAllByRole('menuitem');
    expect(buttons[1].tabIndex).toBe(0);
    expect(buttons[0].tabIndex).toBe(-1);
  });

  it('ArrowDown is equivalent to ArrowRight', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Diagram selection actions' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    const buttons = screen.getAllByRole('menuitem');
    expect(buttons[1].tabIndex).toBe(0);
  });

  it('ArrowLeft from index 0 wraps to last', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Diagram selection actions' });
    fireEvent.keyDown(menu, { key: 'ArrowLeft' });
    const buttons = screen.getAllByRole('menuitem');
    expect(buttons[buttons.length - 1].tabIndex).toBe(0);
  });

  it('ArrowRight from last wraps to 0', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Diagram selection actions' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    const buttons = screen.getAllByRole('menuitem');
    expect(buttons[0].tabIndex).toBe(0);
  });

  it('Home / End jump to first / last', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Diagram selection actions' });
    fireEvent.keyDown(menu, { key: 'End' });
    let buttons = screen.getAllByRole('menuitem');
    expect(buttons[buttons.length - 1].tabIndex).toBe(0);
    fireEvent.keyDown(menu, { key: 'Home' });
    buttons = screen.getAllByRole('menuitem');
    expect(buttons[0].tabIndex).toBe(0);
  });

  it('Enter activates the focused action via onActionPick', () => {
    const onActionPick = vi.fn();
    renderMenu({ onActionPick });
    const menu = screen.getByRole('menu', { name: 'Diagram selection actions' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    const buttons = screen.getAllByRole('menuitem');
    // Native <button> Enter/Space synthesizes click — assert via direct click.
    fireEvent.click(buttons[1]);
    expect(onActionPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'erlich' }),
      DESCRIPTOR
    );
  });
});
