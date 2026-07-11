import { describe, expect, it } from 'vitest';
import { getUiLocaleBundle } from '../src/i18n/getUiLocaleBundle.js';
import { resolveUiLocaleFromText } from '@archislop/shared';

describe('ui locale bundles', () => {
  it('returns English controls by default', () => {
    const bundle = getUiLocaleBundle('en');
    expect(bundle.controls.actions.refine).toBe('Refine');
    expect(bundle.slopitect.PROMPT_ACTION_COPY.label).toBe('Weigh In');
  });

  it('returns simplified Chinese controls when locale is zh-CN', () => {
    const bundle = getUiLocaleBundle('zh-CN');
    expect(bundle.controls.actions.refine).toBe('精修');
    expect(bundle.slopitect.PROMPT_ACTION_COPY.label).toBe('发表意见');
  });

  it('returns simplified Chinese gamification flavor when locale is zh-CN', () => {
    const bundle = getUiLocaleBundle('zh-CN');
    expect(bundle.slopitect.ACHIEVEMENTS.firstSlop.title).toMatch(/首|第一|初次/);
    expect(bundle.slopitect.IDLE_TIPS[0]).not.toBe(
      'Always over-engineer. The microservices love a good Co-Design session.'
    );
    expect(bundle.slopitect.LEVEL_PANEL.ladderTitle).toBeTruthy();
    expect(bundle.slopitect.VARIANT_QUOTES.refine[0]).not.toBe('One useful next step at a time.');
  });
});
