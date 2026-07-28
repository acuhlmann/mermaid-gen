import { describe, expect, it } from 'vitest';
import { getUiLocaleBundle } from '../src/i18n/getUiLocaleBundle.js';
import { resolveUiLocaleFromExplicitRequest } from '@archislop/shared';

describe('ui locale bundles', () => {
  it('returns English controls by default', () => {
    const bundle = getUiLocaleBundle('en');
    expect(bundle.controls.actions.gilfoyle).toBe('Refine');
    expect(bundle.slopitect.PROMPT_ACTION_COPY.label).toBe('Weigh In');
  });

  it('returns simplified Chinese controls when locale is zh-CN', () => {
    const bundle = getUiLocaleBundle('zh-CN');
    expect(bundle.controls.actions.gilfoyle).toBe('精修');
    expect(bundle.controls.radial.drillDeeper).toBe('深入挖掘');
    expect(bundle.slopitect.PROMPT_ACTION_COPY.label).toBe('发表意见');
    expect(bundle.controls.advisorThinking.russ).toBe('在秀逗号');
    expect(bundle.controls.planBeat.agent).toBe('智能体');
    expect(bundle.controls.checklist.fixSelected).toBe('修复所选');
    expect(bundle.controls.contentModes.mermaidShort).toBe('架构图');
    expect(bundle.controls.contentModes.chartShort).toBe('数据图');
    expect(bundle.controls.prompt.exampleHeadline).toContain('{name}');
    expect(bundle.controls.prompt.exampleAria).toMatch(/欢迎/);
    expect(bundle.controls.insights.tipLabel).not.toBe('Slopitect Tip™');
    expect(bundle.controls.insights.phaseStep).toBe('阶段 {step}');
    expect(bundle.controls.insights.diffAdded).toBe('+{count} 新增');
    expect(bundle.controls.insights.nowStatus.stillWorking).toBe('仍在处理…');
    expect(bundle.controls.insights.goIntent.goDiagram).toBe('开始 — 图表');
    expect(bundle.controls.insights.streamFailures.generic).toMatch(/重试/);
    expect(bundle.controls.gamificationHud.xpLabel).toBe('经验');
    expect(bundle.slopitect.LEVEL_PANEL.damageQuips.idle).not.toMatch(/^No billable/);
  });

  it('returns Aussie slang controls when locale is en-AU', () => {
    const bundle = getUiLocaleBundle('en-AU');
    expect(bundle.controls.actions.gilfoyle).toBe('Refine');
    expect(bundle.controls.actions.russ).toBe('Russ');
    expect(bundle.controls.actions.stakeholders).toBe('The Mob');
    expect(bundle.controls.prompt.doIt).toBe('Have a go');
    expect(bundle.controls.introLocale.enAu).toBe('Aussie Slang');
    expect(bundle.controls.advisorThinking.russ).toBe('is flexing commas');
    expect(bundle.controls.appError.title).toMatch(/pear-shaped/);
    expect(bundle.slopitect.PROMPT_ACTION_COPY.label).toBe('Have a say');
    expect(bundle.slopitect.STAKEHOLDERS_MUTE_COPY.stakeholdersTag).toBe('The Mob');
    expect(bundle.slopitect.LEVEL_PANEL.damageQuips.pettyMid).toMatch(/flat white/);
  });

  it('resolves explicit UI locale requests from weigh-in prompts', () => {
    expect(resolveUiLocaleFromExplicitRequest('switch UI to Chinese')).toBe('zh-CN');
    expect(resolveUiLocaleFromExplicitRequest('switch UI to Aussie slang')).toBe('en-AU');
    expect(resolveUiLocaleFromExplicitRequest('画一个登录流程图')).toBeNull();
  });

  it('returns simplified Chinese gamification flavor when locale is zh-CN', () => {
    const bundle = getUiLocaleBundle('zh-CN');
    expect(bundle.slopitect.ACHIEVEMENTS.firstSlop.title).toMatch(/首|第一|初次/);
    expect(bundle.slopitect.IDLE_TIPS[0]).not.toBe(
      'Always over-engineer. The microservices love a good Co-Design session.'
    );
    expect(bundle.slopitect.LEVEL_PANEL.ladderTitle).toBeTruthy();
    expect(bundle.slopitect.VARIANT_QUOTES.gilfoyle[0]).not.toBe(
      'That dependency exists. It was never written down.'
    );
  });

  // Guards against the variant-mastery achievements being keyed by their `id`
  // (stackOwner, …) instead of the variant key (gilfoyle, …). Mis-keying
  // adds extra ACHIEVEMENTS entries on merge — inflating the trophy total and
  // leaving the mastery copy in English.
  it.each(['zh-CN', 'zh-TW', 'en-AU'])(
    'keeps ACHIEVEMENTS keys aligned with English and translates mastery entries (%s)',
    (locale) => {
      const en = getUiLocaleBundle('en').slopitect.ACHIEVEMENTS;
      const localized = getUiLocaleBundle(locale).slopitect.ACHIEVEMENTS;
      expect(Object.keys(localized).sort()).toEqual(Object.keys(en).sort());
      for (const variant of [
        'gilfoyle',
        'dinesh',
        'erlich',
        'russ',
        'jared',
        'richard',
        'barker'
      ]) {
        expect(localized[variant].id).toBe(en[variant].id);
        expect(localized[variant].subtitle).not.toBe(en[variant].subtitle);
      }
    }
  );

  it.each(['zh-CN', 'zh-TW'])(
    'translates phase ceremony labels for all mutation phases × stakeholders (%s)',
    (locale) => {
      const en = getUiLocaleBundle('en').slopitect.PHASE_CEREMONIES;
      const localized = getUiLocaleBundle(locale).slopitect.PHASE_CEREMONIES;
      const stakeholderVariants = [
        'gilfoyle',
        'dinesh',
        'erlich',
        'russ',
        'jared',
        'richard',
        'barker'
      ];
      const mutationPhases = [
        'analyze',
        'analyze_stream',
        'intent',
        'agent_run',
        'transform',
        'planning',
        'syntax_fixer',
        'syntax_repair',
        'style',
        'patch_retry',
        'invoke',
        'invoke_fallback',
        'repair_1',
        'repair_2'
      ];
      for (const phase of mutationPhases) {
        for (const variant of stakeholderVariants) {
          expect(localized[phase]?.[variant], `${locale} ${phase} × ${variant}`).toBeDefined();
          expect(localized[phase][variant]).not.toBe(en[phase][variant]);
        }
      }
    }
  );

  it.each(['zh-CN', 'zh-TW'])(
    'translates run timeline phase short labels for slot-prefixed ids (%s)',
    (locale) => {
      const en = getUiLocaleBundle('en').controls.runTimeline.phases;
      const localized = getUiLocaleBundle(locale).controls.runTimeline.phases;
      for (const key of [
        'chart_invoke',
        'metaphor_invoke',
        'anything_invoke',
        'forms_transform',
        'forms_analyze',
        'forms_invoke'
      ]) {
        expect(localized[key], `${locale} ${key}`).toBeDefined();
        expect(localized[key]).not.toBe(en[key]);
      }
    }
  );
});
