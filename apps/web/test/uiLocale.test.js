import { describe, expect, it } from 'vitest';
import { getUiLocaleBundle } from '../src/i18n/getUiLocaleBundle.js';
import { resolveUiLocaleFromExplicitRequest } from '@archislop/shared';

describe('ui locale bundles', () => {
  it('returns English controls by default', () => {
    const bundle = getUiLocaleBundle('en');
    expect(bundle.controls.actions.refine).toBe('Refine');
    expect(bundle.slopitect.PROMPT_ACTION_COPY.label).toBe('Weigh In');
  });

  it('returns simplified Chinese controls when locale is zh-CN', () => {
    const bundle = getUiLocaleBundle('zh-CN');
    expect(bundle.controls.actions.refine).toBe('精修');
    expect(bundle.controls.radial.drillDeeper).toBe('深入挖掘');
    expect(bundle.slopitect.PROMPT_ACTION_COPY.label).toBe('发表意见');
    expect(bundle.controls.advisorThinking.goMad).toBe('正在癫狂');
    expect(bundle.controls.planBeat.agent).toBe('智能体');
    expect(bundle.controls.checklist.fixSelected).toBe('修复所选');
  });

  it('resolves explicit UI locale requests from weigh-in prompts', () => {
    expect(resolveUiLocaleFromExplicitRequest('switch UI to Chinese')).toBe('zh-CN');
    expect(resolveUiLocaleFromExplicitRequest('画一个登录流程图')).toBeNull();
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

  // Guards against the variant-mastery achievements being keyed by their `id`
  // (masterPolisher, …) instead of the variant key (refine, …). Mis-keying
  // adds extra ACHIEVEMENTS entries on merge — inflating the trophy total and
  // leaving the mastery copy in English.
  it.each(['zh-CN', 'zh-TW'])(
    'keeps ACHIEVEMENTS keys aligned with English and translates mastery entries (%s)',
    (locale) => {
      const en = getUiLocaleBundle('en').slopitect.ACHIEVEMENTS;
      const localized = getUiLocaleBundle(locale).slopitect.ACHIEVEMENTS;
      expect(Object.keys(localized).sort()).toEqual(Object.keys(en).sort());
      for (const variant of ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec']) {
        expect(localized[variant].id).toBe(en[variant].id);
        expect(localized[variant].title).not.toBe(en[variant].title);
      }
    }
  );
});
