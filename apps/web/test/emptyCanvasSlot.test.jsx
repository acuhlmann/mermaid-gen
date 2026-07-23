// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyCanvasSlot } from '../src/features/desk/EmptyCanvasSlot.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

describe('EmptyCanvasSlot', () => {
  afterEach(() => cleanup());

  it('renders the welcome card without a try CTA', () => {
    render(<EmptyCanvasSlot active copy={CONTROLS_EN.prompt} userName="Gavin" />);

    expect(screen.getByTestId('empty-canvas-slot')).toBeTruthy();
    expect(screen.getByTestId('entry-example')).toBeTruthy();
    expect(screen.getByText('Welcome aboard, Gavin')).toBeTruthy();
    expect(screen.queryByTestId('entry-example-try')).toBeNull();
    expect(
      screen.queryByText('Turn any topic into a deliverable. Start with whatever you care about.')
    ).toBeNull();
  });

  it('renders nothing when inactive', () => {
    render(<EmptyCanvasSlot active={false} copy={CONTROLS_EN.prompt} userName="Gavin" />);
    expect(screen.queryByTestId('empty-canvas-slot')).toBeNull();
  });
});
