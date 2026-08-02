import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  bringOverlayToFront,
  getFocusedOverlayId,
  getOpenOverlays,
  getOverlayZIndex,
  isOverlayMinimized,
  minimizeOtherOverlays,
  minimizeOverlay,
  registerOverlay,
  resetOverlayStackForTests,
  restoreOverlay
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

  it('bringOverlayToFront moves an overlay above siblings globally', () => {
    registerOverlay('office-inbox', 'officeModal');
    registerOverlay('office-messenger', 'officeModal');

    expect(getOverlayZIndex('office-messenger')).toBeGreaterThan(getOverlayZIndex('office-inbox'));

    bringOverlayToFront('office-inbox');

    expect(getOverlayZIndex('office-inbox')).toBeGreaterThan(getOverlayZIndex('office-messenger'));
    expect(getFocusedOverlayId()).toBe('office-inbox');
  });
});

/**
 * Minimize used to be a local `useState` in each window, and the taskbar pill
 * beside it could only re-focus — so the two never met. These pin the single
 * concept that replaced them (docs/office-window-manager.md §5B).
 */
describe('overlayStack minimize', () => {
  const meta = { title: 'Slop Chat', kind: 'messenger', manageable: true };

  beforeEach(() => {
    resetOverlayStackForTests();
  });

  it('keeps a minimized overlay registered so its taskbar pill survives', () => {
    registerOverlay('office-messenger', 'officeModal', meta);

    minimizeOverlay('office-messenger');

    expect(isOverlayMinimized('office-messenger')).toBe(true);
    const listed = getOpenOverlays().find((o) => o.id === 'office-messenger');
    expect(listed).toBeDefined();
    expect(listed.minimized).toBe(true);
    // Nothing on screen may hold focus, or the pill stays lit for a window that
    // is not there.
    expect(getFocusedOverlayId()).toBeNull();
  });

  it('restore un-minimizes and brings to front in one move', () => {
    registerOverlay('office-messenger', 'officeModal', meta);
    registerOverlay('office-inbox', 'officeModal', { ...meta, title: 'Inbox', kind: 'inbox' });
    minimizeOverlay('office-messenger');

    restoreOverlay('office-messenger');

    expect(isOverlayMinimized('office-messenger')).toBe(false);
    expect(getFocusedOverlayId()).toBe('office-messenger');
    expect(getOverlayZIndex('office-messenger')).toBeGreaterThan(getOverlayZIndex('office-inbox'));
  });

  it('re-opening clears a stale minimize', () => {
    registerOverlay('office-meeting', 'officeModal', { ...meta, title: 'WG sync' });
    minimizeOverlay('office-meeting');

    registerOverlay('office-meeting', 'officeModal', { ...meta, title: 'WG sync' });

    expect(isOverlayMinimized('office-meeting')).toBe(false);
  });

  it('closing forgets it was minimized', () => {
    registerOverlay('office-messenger', 'officeModal', meta);
    const unregister = registerOverlay('office-inbox', 'officeModal', meta);
    minimizeOverlay('office-inbox');

    unregister();
    registerOverlay('office-inbox', 'officeModal', meta);

    expect(isOverlayMinimized('office-inbox')).toBe(false);
  });

  it('one-window-at-a-time minimizes the other switchable windows', () => {
    registerOverlay('office-inbox', 'officeModal', { ...meta, title: 'Inbox' });
    registerOverlay('office-messenger', 'officeModal', meta);

    minimizeOtherOverlays('office-messenger');

    expect(isOverlayMinimized('office-inbox')).toBe(true);
    expect(isOverlayMinimized('office-messenger')).toBe(false);
  });

  // The phone rule is about *windows*. An IM ping and a walk-by card share the
  // officeChrome band but are notifications — swallowing them would make the
  // office go quiet exactly when somebody was trying to reach you.
  it('leaves unmanageable surfaces and app modals alone', () => {
    registerOverlay('office-messenger', 'officeModal', meta);
    registerOverlay('im-ping', 'officeChrome', { title: 'Chad', manageable: false });
    registerOverlay('clear-confirm', 'modal', { title: 'Clear?', manageable: true });

    minimizeOtherOverlays('office-messenger');

    expect(isOverlayMinimized('im-ping')).toBe(false);
    expect(isOverlayMinimized('clear-confirm')).toBe(false);
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

  it('defaultWindowPosition centers in the usable viewport', () => {
    vi.stubGlobal('window', {
      innerWidth: 400,
      innerHeight: 800,
      visualViewport: null
    });
    const pos = defaultWindowPosition(
      'center',
      { width: 200, height: 300 },
      {
        bottomReservePx: 100
      }
    );
    expect(pos.left).toBe((400 - 200) / 2);
    // Vertical center of the area above the bottom chrome reserve.
    expect(pos.top).toBe((800 - 100 - 300) / 2);
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
