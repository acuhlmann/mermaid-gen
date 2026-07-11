import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeUiLocale,
  promptHintToUiLocale,
  resolveUiLocaleFromText
} from '../src/uiLocale.js';

describe('promptHintToUiLocale', () => {
  it('maps Chinese hints to UI locales', () => {
    assert.equal(promptHintToUiLocale('Simplified Chinese (zh-CN)'), 'zh-CN');
    assert.equal(promptHintToUiLocale('Traditional Chinese (zh-TW)'), 'zh-TW');
    assert.equal(promptHintToUiLocale('Chinese (zh)'), 'zh-CN');
    assert.equal(promptHintToUiLocale(null), null);
  });
});

describe('resolveUiLocaleFromText', () => {
  it('returns zh-CN for simplified Chinese prompts', () => {
    assert.equal(resolveUiLocaleFromText('画一个用户登录流程图'), 'zh-CN');
  });

  it('returns zh-TW for traditional Chinese prompts', () => {
    assert.equal(resolveUiLocaleFromText('畫一個用戶登入流程圖並說明網路與資料庫'), 'zh-TW');
  });

  it('returns null for Latin-only prompts', () => {
    assert.equal(resolveUiLocaleFromText('draw a login flow'), null);
  });
});

describe('normalizeUiLocale', () => {
  it('passes through supported locales', () => {
    assert.equal(normalizeUiLocale('zh-TW'), 'zh-TW');
  });

  it('falls back to English', () => {
    assert.equal(normalizeUiLocale('fr'), 'en');
    assert.equal(normalizeUiLocale(undefined), 'en');
  });
});
