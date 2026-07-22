// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyCanvasSlot } from '../src/features/desk/EmptyCanvasSlot.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

describe('EmptyCanvasSlot', () => {
  afterEach(() => cleanup());

  it('renders the sample card and forwards the CTA to onPickTopic', () => {
    const onPickTopic = vi.fn();
    render(
      <EmptyCanvasSlot
        active
        copy={CONTROLS_EN.prompt}
        userName="Gavin"
        onPickTopic={onPickTopic}
      />
    );

    expect(screen.getByTestId('empty-canvas-slot')).toBeTruthy();
    expect(screen.getByTestId('entry-example')).toBeTruthy();
    fireEvent.click(screen.getByTestId('entry-example-try'));
    expect(onPickTopic).toHaveBeenCalledWith('Break down the global coffee supply chain');
  });

  it('renders nothing when inactive', () => {
    render(<EmptyCanvasSlot active={false} copy={CONTROLS_EN.prompt} userName="Gavin" />);
    expect(screen.queryByTestId('empty-canvas-slot')).toBeNull();
  });
});
