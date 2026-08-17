// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetDeskCommsUiForTests,
  closeDeskCommsPanel,
  getDeskCommsUi,
  openDeskCommsPanel,
  readDeskCommsAnchorRect,
  serializeAnchorRect,
  toggleDeskCommsPanel
} from '../src/state/deskCommsUiStore.js';

describe('deskCommsUiStore', () => {
  afterEach(() => {
    _resetDeskCommsUiForTests();
  });

  it('opens a panel with its anchor rect', () => {
    const rect = { left: 10, top: 20, width: 30, height: 40 };
    openDeskCommsPanel('inbox', rect);
    expect(getDeskCommsUi()).toEqual({
      activePanel: 'inbox',
      anchorRect: rect,
      inboxEmailId: null
    });
  });

  it('opens inbox targeting a specific email', () => {
    openDeskCommsPanel('inbox', null, { emailId: 'email-7' });
    expect(getDeskCommsUi()).toEqual({
      activePanel: 'inbox',
      anchorRect: null,
      inboxEmailId: 'email-7'
    });
  });

  it('toggles the same panel closed', () => {
    openDeskCommsPanel('slopChat', null);
    toggleDeskCommsPanel('slopChat');
    expect(getDeskCommsUi()).toEqual({
      activePanel: null,
      anchorRect: null,
      inboxEmailId: null
    });
  });

  it('replaces the active panel when another opens', () => {
    openDeskCommsPanel('inbox', null);
    toggleDeskCommsPanel('meeting', { left: 1, top: 2, width: 3, height: 4 });
    expect(getDeskCommsUi().activePanel).toBe('meeting');
    expect(getDeskCommsUi().anchorRect).toEqual({ left: 1, top: 2, width: 3, height: 4 });
  });

  it('closeDeskCommsPanel is a no-op when already closed', () => {
    closeDeskCommsPanel();
    expect(getDeskCommsUi()).toEqual({
      activePanel: null,
      anchorRect: null,
      inboxEmailId: null
    });
  });

  it('serializes DOMRect-like values', () => {
    expect(
      serializeAnchorRect({ left: 1, top: 2, width: 3, height: 4, right: 4, bottom: 6 })
    ).toEqual({
      left: 1,
      top: 2,
      width: 3,
      height: 4
    });
  });

  it('reads an anchor from the matching desk-comms button', () => {
    const btn = document.createElement('button');
    btn.dataset.testid = 'desk-comms-slopChat';
    Object.defineProperty(btn, 'getBoundingClientRect', {
      value: () => ({ left: 40, top: 700, width: 28, height: 28, right: 68, bottom: 728 })
    });
    document.body.appendChild(btn);
    expect(readDeskCommsAnchorRect('slopChat')).toEqual({
      left: 40,
      top: 700,
      width: 28,
      height: 28
    });
    btn.remove();
  });
});
