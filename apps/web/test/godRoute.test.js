import { describe, expect, it } from 'vitest';
import { isGodWindowPath } from '../src/features/god/godRoute.js';

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
});
