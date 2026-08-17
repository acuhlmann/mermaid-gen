// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FlowchartLabelField from '../src/components/FlowchartLabelField.jsx';

describe('FlowchartLabelField', () => {
  afterEach(() => {
    cleanup();
  });

  it('commits on Enter and cancels on Escape without a second finish', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <FlowchartLabelField
        session={{ kind: 'node', logicalId: 'n1', draft: 'n1', x: 10, y: 20, created: true }}
        placeholder="Label"
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
    const input = screen.getByLabelText('Label');
    fireEvent.change(input, { target: { value: 'Review' } });
    fireEvent.submit(input.closest('form'));
    expect(onCommit).toHaveBeenCalledWith('Review');
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels on Escape when the field has not already committed', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <FlowchartLabelField
        session={{ kind: 'node', logicalId: 'A', draft: 'Start', x: 0, y: 0 }}
        placeholder="Label"
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
