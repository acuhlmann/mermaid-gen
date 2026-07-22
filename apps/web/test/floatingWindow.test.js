import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  bringOverlayToFront,
  getFocusedOverlayId,
  getOverlayZIndex,
  OVERLAY_GROUP,
  registerOverlay,
  resetOverlayStackForTests
} from '../src/state/overlayStack.js';
import {
  clampWindowPosition,
  defaultWindowPosition,
  readViewportBounds
} from '../src/utils/viewportBounds.js';

describe('overlayStack focus', () => {
  beforeEach(() => {
    resetOverlayStackForTests();
  });

  it('bringOverlayToFront moves an overlay above siblings in its group', () => {
    registerOverlay('office-inbox', 'officeChrome');
    registerOverlay('office-messenger', 'officeChrome');

    expect(getOverlayZIndex('office-messenger')).toBeGreaterThan(getOverlayZIndex('office-inbox'));

    bringOverlayToFront('office-inbox');

    expect(getOverlayZIndex('office-inbox')).toBeGreaterThan(getOverlayZIndex('office-messenger'));
    expect(getFocusedOverlayId()).toBe('office-inbox');
  });
});

describe('viewportBounds', () => {
  it('defaultWindowPosition anchors to bottom-right with offsets', () => {
    vi.stubGlobal('window', {
      innerWidth: 400,
      innerHeight: 800,
      visualViewport: null
    });
    const pos = defaultWindowPosition(
      'bottom-right',
      { width: 200, height: 300 },
      {
        offsetX: 20,
        offsetY: 40
      }
    );
    expect(pos.left).toBe(400 - 20 - 200);
    expect(pos.top).toBe(800 - 40 - 300);
    vi.unstubAllGlobals();
  });

  it('clampWindowPosition respects bottom reserve', () => {
    const viewport = { left: 0, top: 0, right: 400, bottom: 800 };
    const clamped = clampWindowPosition(0, 700, { width: 200, height: 300 }, viewport, {
      bottomReservePx: 120,
      minVisiblePx: 48
    });
    expect(clamped.top).toBeLessThanOrEqual(800 - 120 - 48);
  });

  it('readViewportBounds falls back to window dimensions', () => {
    vi.stubGlobal('window', {
      innerWidth: 320,
      innerHeight: 640,
      visualViewport: null
    });
    const bounds = readViewportBounds();
    expect(bounds.right).toBe(320);
    expect(bounds.bottom).toBe(640);
    vi.unstubAllGlobals();
  });
});
