import { describe, expect, it, beforeEach } from 'vitest';
import {
  FOCUS_Z_BASE,
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

  it('stacks later opens above earlier ones via global focus z', () => {
    const releaseA = registerOverlay('settings', 'anchored');
    const releaseB = registerOverlay('outbox', 'anchored');

    expect(getOverlayZIndex('settings')).toBe(FOCUS_Z_BASE + 1);
    expect(getOverlayZIndex('outbox')).toBe(FOCUS_Z_BASE + 2);
    expect(getOverlayZIndex('outbox')).toBeGreaterThan(getOverlayZIndex('settings'));

    releaseA();
    expect(getOverlayZIndex('outbox')).toBe(FOCUS_Z_BASE + 2);

    releaseB();
    expect(getOverlayZIndex('outbox')).toBeUndefined();
  });

  it('re-opening the same overlay brings it to the global front', () => {
    registerOverlay('settings', 'anchored');
    registerOverlay('outbox', 'anchored');
    registerOverlay('settings', 'anchored');

    expect(getOverlayZIndex('settings')).toBeGreaterThan(getOverlayZIndex('outbox'));
  });

  it('lets a later anchored menu stack above an earlier office window', () => {
    registerOverlay('office-inbox', 'officeModal');
    registerOverlay('desk-actions-menu', 'anchored');

    expect(getOverlayZIndex('desk-actions-menu')).toBeGreaterThan(getOverlayZIndex('office-inbox'));
  });

  it('lets focusing an office window stack above an open desk menu', () => {
    registerOverlay('desk-actions-menu', 'anchored');
    registerOverlay('office-inbox', 'officeModal');
    bringOverlayToFront('desk-actions-menu');
    expect(getOverlayZIndex('desk-actions-menu')).toBeGreaterThan(getOverlayZIndex('office-inbox'));

    bringOverlayToFront('office-inbox');
    expect(getOverlayZIndex('office-inbox')).toBeGreaterThan(getOverlayZIndex('desk-actions-menu'));
  });

  it('stacks modals within global focus order', () => {
    registerOverlay('clear', 'modal');
    registerOverlay('hotkeys', 'modal');

    expect(getOverlayZIndex('hotkeys')).toBeGreaterThan(getOverlayZIndex('clear'));
  });

  it('unregisterOverlay removes an overlay from the stack', () => {
    registerOverlay('a', 'anchored');
    registerOverlay('b', 'anchored');
    unregisterOverlay('a');

    expect(getOverlayZIndex('a')).toBeUndefined();
    expect(getOverlayZIndex('b')).toBeDefined();
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

    expect(getOpenOverlays().map((o) => o.id)).toEqual(['a', 'b']);
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
