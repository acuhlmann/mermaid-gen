import { describe, expect, it, beforeEach } from 'vitest';
import {
  OVERLAY_GROUP,
  getOverlayZIndex,
  registerOverlay,
  resetOverlayStackForTests,
  unregisterOverlay
} from '../src/state/overlayStack.js';

describe('overlayStack', () => {
  beforeEach(() => {
    resetOverlayStackForTests();
  });

  it('stacks later anchored overlays above earlier ones', () => {
    const releaseA = registerOverlay('settings', 'anchored');
    const releaseB = registerOverlay('outbox', 'anchored');

    expect(getOverlayZIndex('settings')).toBe(OVERLAY_GROUP.anchored.base);
    expect(getOverlayZIndex('outbox')).toBe(OVERLAY_GROUP.anchored.base + 1);

    releaseA();
    expect(getOverlayZIndex('outbox')).toBe(OVERLAY_GROUP.anchored.base);

    releaseB();
    expect(getOverlayZIndex('outbox')).toBeUndefined();
  });

  it('re-opening the same overlay brings it to the front of its group', () => {
    registerOverlay('settings', 'anchored');
    registerOverlay('outbox', 'anchored');
    registerOverlay('settings', 'anchored');

    expect(getOverlayZIndex('outbox')).toBe(OVERLAY_GROUP.anchored.base);
    expect(getOverlayZIndex('settings')).toBe(OVERLAY_GROUP.anchored.base + 1);
  });

  it('keeps modals above anchored overlays regardless of open order', () => {
    registerOverlay('settings', 'anchored');
    registerOverlay('invite', 'modal');

    expect(getOverlayZIndex('invite')).toBeGreaterThan(getOverlayZIndex('settings'));
  });

  it('stacks modals within the modal group', () => {
    registerOverlay('clear', 'modal');
    registerOverlay('hotkeys', 'modal');

    expect(getOverlayZIndex('hotkeys')).toBeGreaterThan(getOverlayZIndex('clear'));
  });

  it('unregisterOverlay removes an overlay from the stack', () => {
    registerOverlay('a', 'anchored');
    registerOverlay('b', 'anchored');
    unregisterOverlay('a');

    expect(getOverlayZIndex('a')).toBeUndefined();
    expect(getOverlayZIndex('b')).toBe(OVERLAY_GROUP.anchored.base);
  });
});
