// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskDrawer from '../src/components/DeskDrawer.jsx';

const MODES = [
  { id: 'mermaid', label: 'Diagram', techLabel: 'Mermaid' },
  { id: 'chart', label: 'Chart', techLabel: 'Vega-Lite' }
];

describe('DeskDrawer', () => {
  afterEach(() => cleanup());

  it('opens when forceOpen is set for the entry tour', () => {
    render(<DeskDrawer modes={MODES} currentMode="mermaid" onPickMode={vi.fn()} forceOpen />);
    expect(screen.getByRole('menu', { name: /Desk tray/i })).toBeTruthy();
    expect(screen.getByText('Deliverable format')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Chart/i })).toBeTruthy();
  });

  it('picks a mode from the open tray', () => {
    const onPickMode = vi.fn();
    render(<DeskDrawer modes={MODES} currentMode="mermaid" onPickMode={onPickMode} forceOpen />);
    fireEvent.click(screen.getByRole('menuitem', { name: /Chart/i }));
    expect(onPickMode).toHaveBeenCalledWith('chart');
  });
});
