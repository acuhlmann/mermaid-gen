import { describe, expect, it } from 'vitest';
import {
  buildAppHomeUrl,
  buildGodWindowUrl,
  isGodWindowPath,
  readGodWindowInitialTab
} from '../src/features/god/godRoute.js';

describe('isGodWindowPath', () => {
  it('matches the owner route itself, with or without a trailing slash', () => {
    expect(isGodWindowPath({ pathname: '/god' }, '/')).toBe(true);
    expect(isGodWindowPath({ pathname: '/god/' }, '/')).toBe(true);
  });

  it('does not match the app or a nested path under the owner route', () => {
    expect(isGodWindowPath({ pathname: '/' }, '/')).toBe(false);
    expect(isGodWindowPath({ pathname: '/sessions/abc' }, '/')).toBe(false);
    // `/god/anything` is not a second view; the branch must not swallow unknown paths.
    expect(isGodWindowPath({ pathname: '/god/anything' }, '/')).toBe(false);
  });

  it('honors a subdirectory deploy base, where a bare === "/god" would silently miss', () => {
    expect(isGodWindowPath({ pathname: '/hackathon/god' }, '/hackathon/')).toBe(true);
    expect(isGodWindowPath({ pathname: '/hackathon/god' }, '/hackathon')).toBe(true);
    expect(isGodWindowPath({ pathname: '/god' }, '/hackathon/')).toBe(false);
    expect(isGodWindowPath({ pathname: '/other/god' }, '/hackathon/')).toBe(false);
  });

  it('is false without a location, so a server render never takes this branch', () => {
    expect(isGodWindowPath(null, '/')).toBe(false);
  });

  it('builds /god and home URLs respecting BASE_URL and ?tab=altar', () => {
    expect(buildGodWindowUrl({}, '/')).toBe('/god');
    expect(buildGodWindowUrl({ tab: 'altar' }, '/')).toBe('/god?tab=altar');
    expect(buildGodWindowUrl({ tab: 'altar' }, '/hackathon/')).toBe('/hackathon/god?tab=altar');
    expect(buildAppHomeUrl('/')).toBe('/');
    expect(buildAppHomeUrl('/hackathon/')).toBe('/hackathon/');
    expect(readGodWindowInitialTab({ search: '?tab=altar' })).toBe('altar');
    expect(readGodWindowInitialTab({ search: '?tab=now' })).toBeNull();
  });
});
