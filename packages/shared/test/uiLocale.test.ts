import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeUiLocale,
  promptHintToUiLocale,
  resolveUiLocaleFromExplicitRequest,
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

describe('resolveUiLocaleFromExplicitRequest', () => {
  it('returns zh-CN for explicit simplified Chinese UI requests', () => {
    assert.equal(resolveUiLocaleFromExplicitRequest('switch UI to Chinese'), 'zh-CN');
    assert.equal(resolveUiLocaleFromExplicitRequest('界面改成中文'), 'zh-CN');
    assert.equal(resolveUiLocaleFromExplicitRequest('用中文界面'), 'zh-CN');
  });

  it('returns zh-TW for explicit traditional Chinese UI requests', () => {
    assert.equal(resolveUiLocaleFromExplicitRequest('use traditional Chinese'), 'zh-TW');
    assert.equal(resolveUiLocaleFromExplicitRequest('切换到繁體中文'), 'zh-TW');
  });

  it('returns en-AU for explicit Aussie slang UI requests', () => {
    assert.equal(resolveUiLocaleFromExplicitRequest('switch UI to Aussie slang'), 'en-AU');
    assert.equal(resolveUiLocaleFromExplicitRequest('use straya mode'), 'en-AU');
    assert.equal(resolveUiLocaleFromExplicitRequest("g'day mate"), 'en-AU');
  });

  it('returns en for explicit English UI requests', () => {
    assert.equal(resolveUiLocaleFromExplicitRequest('switch to English'), 'en');
    assert.equal(resolveUiLocaleFromExplicitRequest('界面改成英文'), 'en');
  });

  it('returns null for general Chinese content without a UI switch', () => {
    assert.equal(resolveUiLocaleFromExplicitRequest('画一个用户登录流程图'), null);
    assert.equal(resolveUiLocaleFromExplicitRequest('draw a login flow'), null);
  });
});

describe('normalizeUiLocale', () => {
  it('passes through supported locales', () => {
    assert.equal(normalizeUiLocale('zh-TW'), 'zh-TW');
    assert.equal(normalizeUiLocale('en-AU'), 'en-AU');
  });

  it('falls back to English', () => {
    assert.equal(normalizeUiLocale('fr'), 'en');
    assert.equal(normalizeUiLocale(undefined), 'en');
  });
});
