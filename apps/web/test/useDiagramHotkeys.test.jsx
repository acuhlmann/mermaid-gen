// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useDiagramHotkeys } from '../src/hooks/useDiagramHotkeys.js';

function Harness({ enabled, descriptor, onAction, onToggleHelp }) {
  useDiagramHotkeys({ enabled, descriptor, onAction, onToggleHelp });
  return (
    <div>
      <input data-testid="text-input" />
      <textarea data-testid="textarea" />
    </div>
  );
}

describe('useDiagramHotkeys', () => {
  afterEach(() => {
    cleanup();
  });

  it('fires the mapped action for each letter key', () => {
    const onAction = vi.fn();
    const desc = { id: 'node-1' };
    render(<Harness enabled descriptor={desc} onAction={onAction} onToggleHelp={vi.fn()} />);

    for (const [key, id] of [
      ['r', 'refine'],
      ['i', 'innovate'],
      ['m', 'goMad'],
      ['c', 'critique'],
      ['e', 'explain'],
      ['b', 'barker']
    ]) {
      fireEvent.keyDown(window, { key });
      expect(onAction).toHaveBeenCalledWith({ id }, desc);
      onAction.mockClear();
    }
  });

  it('uppercase letters work too (case-insensitive)', () => {
    const onAction = vi.fn();
    render(<Harness enabled descriptor={{ id: 'n' }} onAction={onAction} onToggleHelp={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'R' });
    expect(onAction).toHaveBeenCalledWith({ id: 'refine' }, { id: 'n' });
  });

  it('does NOT fire when enabled is false', () => {
    const onAction = vi.fn();
    render(
      <Harness
        enabled={false}
        descriptor={{ id: 'n' }}
        onAction={onAction}
        onToggleHelp={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'r' });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('does NOT fire when descriptor is null', () => {
    const onAction = vi.fn();
    render(<Harness enabled descriptor={null} onAction={onAction} onToggleHelp={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'r' });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores keys when focus is in an INPUT', () => {
    const onAction = vi.fn();
    const { getByTestId } = render(
      <Harness enabled descriptor={{ id: 'n' }} onAction={onAction} onToggleHelp={vi.fn()} />
    );
    const input = getByTestId('text-input');
    input.focus();
    fireEvent.keyDown(input, { key: 'r' });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores keys when focus is in a TEXTAREA', () => {
    const onAction = vi.fn();
    const { getByTestId } = render(
      <Harness enabled descriptor={{ id: 'n' }} onAction={onAction} onToggleHelp={vi.fn()} />
    );
    const ta = getByTestId('textarea');
    ta.focus();
    fireEvent.keyDown(ta, { key: 'r' });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores keys when Ctrl/Meta/Alt is held', () => {
    const onAction = vi.fn();
    render(<Harness enabled descriptor={{ id: 'n' }} onAction={onAction} onToggleHelp={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'r', metaKey: true });
    fireEvent.keyDown(window, { key: 'r', altKey: true });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('fires onToggleHelp on ?', () => {
    const onToggleHelp = vi.fn();
    render(
      <Harness enabled descriptor={{ id: 'n' }} onAction={vi.fn()} onToggleHelp={onToggleHelp} />
    );
    fireEvent.keyDown(window, { key: '?' });
    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });

  it('onToggleHelp fires even when disabled / no descriptor', () => {
    const onToggleHelp = vi.fn();
    render(
      <Harness enabled={false} descriptor={null} onAction={vi.fn()} onToggleHelp={onToggleHelp} />
    );
    fireEvent.keyDown(window, { key: '?' });
    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });

  it('does nothing on unmapped keys', () => {
    const onAction = vi.fn();
    const onToggleHelp = vi.fn();
    render(
      <Harness enabled descriptor={{ id: 'n' }} onAction={onAction} onToggleHelp={onToggleHelp} />
    );
    fireEvent.keyDown(window, { key: 'q' });
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(onAction).not.toHaveBeenCalled();
    expect(onToggleHelp).not.toHaveBeenCalled();
  });
});
