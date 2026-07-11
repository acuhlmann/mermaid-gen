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

  it('maps detected Chinese prompts to zh-CN locale', () => {
    expect(resolveUiLocaleFromText('画一个用户登录流程图')).toBe('zh-CN');
  });
});
