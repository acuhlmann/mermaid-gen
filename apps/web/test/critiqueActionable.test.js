import { describe, expect, it } from 'vitest';
import { splitCritiqueActionableSections } from '../src/utils/critiqueActionable.js';

describe('splitCritiqueActionableSections', () => {
  it('extracts bullet items under ## Actionable improvements', () => {
    const md = `## Strengths\n\n- Good.\n\n## Actionable improvements\n\n- First thing\n- Second thing\n\n## Footer\n\nTail.`;
    const r = splitCritiqueActionableSections(md);
    expect(r.hasSection).toBe(true);
    expect(r.items).toEqual(['First thing', 'Second thing']);
    expect(r.prefix.trim()).toContain('Strengths');
    expect(r.suffix.trim()).toContain('Footer');
    expect(r.headingText).toMatch(/Actionable/i);
  });

  it('matches actionable headings case-insensitively', () => {
    const md = `## ACTIONABLE FIXES\n\n- Only one\n`;
    const r = splitCritiqueActionableSections(md);
    expect(r.items).toEqual(['Only one']);
  });

  it('parses numbered lines in the actionable section', () => {
    const md = `## Actionable improvements\n\n1. Alpha\n2. Beta\n`;
    const r = splitCritiqueActionableSections(md);
    expect(r.items).toEqual(['Alpha', 'Beta']);
  });

  it('returns full markdown as prefix when no actionable heading', () => {
    const md = `## Strengths\n\n- Only.\n`;
    const r = splitCritiqueActionableSections(md);
    expect(r.hasSection).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.prefix).toBe(md);
  });
});
