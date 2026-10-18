// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONTENT_MODE_AUTO_RESOLVED_STORAGE_KEY,
  CONTENT_MODE_STORAGE_KEY,
  readStoredContentMode
} from '../src/utils/appSessionLocation.js';

describe('readStoredContentMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to auto when nothing is stored', () => {
    expect(readStoredContentMode()).toBe('auto');
  });

  it('returns persisted concrete modes', () => {
    window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, 'mermaid');
    expect(readStoredContentMode()).toBe('mermaid');

    window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, 'chart');
    expect(readStoredContentMode()).toBe('chart');
  });

  it('returns persisted auto', () => {
    window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, 'auto');
    expect(readStoredContentMode()).toBe('auto');
  });

  it('falls back to auto for unknown stored values', () => {
    window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, 'not-a-mode');
    expect(readStoredContentMode()).toBe('auto');
  });

  it('ignores the v1 key, which stored whatever Auto last resolved to', () => {
    window.localStorage.setItem('archislop:content-mode', 'mermaid');
    expect(readStoredContentMode()).toBe('auto');
  });

  // One Auto run that landed on Diagram must not pin the next visit to Diagram.
  it('returns auto on a fresh session when the stored mode was resolved by Auto', () => {
    window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, 'mermaid');
    window.localStorage.setItem(CONTENT_MODE_AUTO_RESOLVED_STORAGE_KEY, '1');
    expect(readStoredContentMode({ freshSession: true })).toBe('auto');
    // Reopening that session from its URL still lands on the resolved slot.
    expect(readStoredContentMode({ freshSession: false })).toBe('mermaid');
  });

  it('keeps a format the person picked on a fresh session', () => {
    window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, 'chart');
    expect(readStoredContentMode({ freshSession: true })).toBe('chart');
  });
});
