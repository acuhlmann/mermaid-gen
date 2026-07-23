import { describe, expect, it, beforeEach } from 'vitest';
import {
  OVERLAY_GROUP,
  bringOverlayToFront,
  getOpenOverlays,
  getOverlayZIndex,
  registerOverlay,
  resetOverlayStackForTests,
  setOverlayMeta,
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

describe('overlayStack metadata + open-windows snapshot', () => {
  beforeEach(() => {
    resetOverlayStackForTests();
  });

  it('exposes open overlays in stable registration order with metadata', () => {
    registerOverlay('office-inbox', 'officeModal', { kind: 'inbox', manageable: true });
    registerOverlay('office-messenger', 'officeModal', { kind: 'messenger' });

    const open = getOpenOverlays();
    expect(open.map((o) => o.id)).toEqual(['office-inbox', 'office-messenger']);
    expect(open[0].kind).toBe('inbox');
    expect(open[0].manageable).toBe(true);
  });

  it('keeps registration order stable when focus changes, but raises z-index', () => {
    registerOverlay('a', 'officeModal', { kind: 'inbox' });
    registerOverlay('b', 'officeModal', { kind: 'messenger' });

    bringOverlayToFront('a');

    // Chip order stays put (registration order) so the taskbar doesn't jump...
    expect(getOpenOverlays().map((o) => o.id)).toEqual(['a', 'b']);
    // ...but the focused window is flagged and painted on top.
    expect(getOpenOverlays().find((o) => o.id === 'a').focused).toBe(true);
    expect(getOverlayZIndex('a')).toBeGreaterThan(getOverlayZIndex('b'));
  });

  it('setOverlayMeta updates metadata without changing z-order', () => {
    registerOverlay('a', 'officeChrome', { kind: 'walkby', senderId: 'intern' });
    registerOverlay('b', 'officeChrome', { kind: 'walkby' });
    const zBefore = getOverlayZIndex('a');

    setOverlayMeta('a', { senderId: 'facilities' });

    expect(getOpenOverlays().find((o) => o.id === 'a').senderId).toBe('facilities');
    expect(getOverlayZIndex('a')).toBe(zBefore);
  });

  it('treats manageable as opt-in: explicit true shows, absent/false stay out', () => {
    registerOverlay('managed', 'officeModal', { kind: 'inbox', manageable: true });
    registerOverlay('toast', 'officeChrome', { kind: 'coffee', manageable: false });
    // A raw overlay (settings, radial menu, app modal) registers with no meta —
    // it must never leak into the office window bar.
    registerOverlay('raw-modal', 'modal');

    const byId = Object.fromEntries(getOpenOverlays().map((o) => [o.id, o.manageable]));
    expect(byId.managed).toBe(true);
    expect(byId.toast).toBe(false);
    expect(byId['raw-modal']).toBe(false);
  });

  it('returns a stable snapshot reference until the stack changes', () => {
    registerOverlay('a', 'officeModal', { kind: 'inbox' });
    const snap = getOpenOverlays();
    expect(getOpenOverlays()).toBe(snap);

    registerOverlay('b', 'officeModal', { kind: 'messenger' });
    expect(getOpenOverlays()).not.toBe(snap);
  });

  it('drops an overlay from the snapshot on unregister', () => {
    registerOverlay('a', 'officeModal', { kind: 'inbox' });
    unregisterOverlay('a');
    expect(getOpenOverlays()).toEqual([]);
  });
});
