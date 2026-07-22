// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
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
});
