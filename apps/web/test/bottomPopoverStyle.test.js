// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { computeBottomLeftPopoverStyle } from '../src/utils/bottomPopoverStyle.js';

describe('computeBottomLeftPopoverStyle', () => {
  it('pins left to the trigger x when align is left', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const style = computeBottomLeftPopoverStyle(
      { left: 420, top: 700, width: 48, height: 36, right: 468, bottom: 736 },
      { align: 'left', maxWidthPx: 340, minWidthPx: 260 }
    );
    expect(style.left).toBe(420);
  });

  it('still pins to the trigger on a tablet-width viewport (not viewport-center)', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
    const style = computeBottomLeftPopoverStyle(
      { left: 310, top: 620, width: 48, height: 36, right: 358, bottom: 656 },
      { align: 'left', maxWidthPx: 340, minWidthPx: 260 }
    );
    expect(style.left).toBe(310);
    // Center would be ~(900 - width) / 2 — far from the Teams button.
    expect(style.left).not.toBe((900 - style.width) / 2);
  });
});
