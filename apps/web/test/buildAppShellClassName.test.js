import { describe, expect, it } from 'vitest';
import { buildAppShellClassName } from '../src/features/shell/buildAppShellClassName.js';

describe('buildAppShellClassName', () => {
  it('flags floor view so the desk veil can lift (§ 1a)', () => {
    expect(buildAppShellClassName({ officeViewMode: 'floor' })).toContain('is-floor-view');
  });

  it('stays unflagged at the desk — including when the mode is not passed', () => {
    expect(buildAppShellClassName({ officeViewMode: 'desk' })).not.toContain('is-floor-view');
    expect(buildAppShellClassName({})).not.toContain('is-floor-view');
  });
});
