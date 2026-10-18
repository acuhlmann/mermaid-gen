import { describe, expect, it } from 'vitest';
import { isMediaViewerPath } from '../src/features/mediaViewer/mediaViewerRoute.js';

describe('isMediaViewerPath', () => {
  it('matches /media-viewer at site root', () => {
    expect(isMediaViewerPath({ pathname: '/media-viewer' }, '')).toBe(true);
  });

  it('honors BASE_URL prefix', () => {
    expect(isMediaViewerPath({ pathname: '/app/media-viewer' }, '/app')).toBe(true);
    expect(isMediaViewerPath({ pathname: '/app/sessions/x' }, '/app')).toBe(false);
  });

  it('rejects nested paths', () => {
    expect(isMediaViewerPath({ pathname: '/media-viewer/extra' }, '')).toBe(false);
  });
});
