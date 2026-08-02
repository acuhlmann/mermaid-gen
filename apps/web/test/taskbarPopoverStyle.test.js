// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { computeTaskbarPopoverStyle } from '../src/utils/taskbarPopoverStyle.js';

describe('computeTaskbarPopoverStyle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('anchors from the button left edge and clears the top shell', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const topShell = document.createElement('div');
    topShell.className = 'top-shell';
    Object.defineProperty(topShell, 'getBoundingClientRect', {
      value: () => ({ bottom: 64, top: 0, left: 0, right: 1280, width: 1280, height: 64 })
    });
    document.body.appendChild(topShell);

    const style = computeTaskbarPopoverStyle(
      { left: 120, top: 760, width: 32, height: 28 },
      { maxWidthPx: 440, fillHeight: true }
    );

    expect(style.left).toBe(120);
    expect(style.bottom).toBeGreaterThan(0);
    expect(style.height).toBe(style.maxHeight);
    expect(style.maxHeight).toBe(760 - 8 - 64 - 4);
    expect(style.transformOrigin).toBe('bottom left');
  });

  it('slides left when the panel would overflow the right edge', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });

    const style = computeTaskbarPopoverStyle(
      { left: 300, top: 650, width: 32, height: 28 },
      { maxWidthPx: 360, safeInsetPx: 8 }
    );

    expect(style.left + style.width).toBeLessThanOrEqual(400 - 8);
    expect(style.left).toBeGreaterThanOrEqual(8);
  });
});
