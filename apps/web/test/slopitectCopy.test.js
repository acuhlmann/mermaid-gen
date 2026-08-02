import { describe, expect, it } from 'vitest';
import {
  PHASE_CEREMONIES,
  VARIANT_TAGLINES,
  VARIANT_BOOT_HEADLINES,
  VARIANT_QUOTES,
  VARIANT_PERSONAS,
  PROMPT_ACTION_COPY,
  PROMPT_EASTER_EGGS,
  STAKEHOLDERS_MUTE_COPY,
  KONAMI_ACHIEVEMENT,
  getVariantPersona,
  stakeholderTooltip,
  phaseCeremonyLabel,
  prestigeForTotalRuns,
  quoteForRotation,
  tipForIndex,
  IDLE_TIPS
} from '../src/utils/slopitectCopy.js';

describe('slopitectCopy', () => {
  it('has a ceremony label for every real phase id × all stakeholder variants', () => {
    const stakeholderVariants = ['gilfoyle', 'erlich', 'russ', 'jared', 'richard', 'barker'];
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
        expect(PHASE_CEREMONIES[phase]?.[variant], `${phase} × ${variant}`).toBeDefined();
      }
    }
  });

  it('returns variant-specific labels for known phases', () => {
    expect(phaseCeremonyLabel('russ', 'invoke', 'Generate')).toMatch(/Shipping it loud/);
    expect(phaseCeremonyLabel('gilfoyle', 'invoke', 'Generate')).toBe('Patching prod 🦇');
    expect(phaseCeremonyLabel('jared', 'analyze', 'Analyze')).toBe('Reading it through carefully…');
  });

  it('falls back to canonical label when no override exists', () => {
    expect(phaseCeremonyLabel('richard', 'transform', 'Transform')).toBe(
      'Still not changing it — naming it…'
    );
    expect(phaseCeremonyLabel('gilfoyle', 'totally-unknown-phase', 'Fallback')).toBe('Fallback');
    expect(phaseCeremonyLabel(undefined, 'analyze', 'Analyze')).toBe('Analyze');
  });

  it('maps slot-prefixed phase ids to base stakeholder ceremonies', () => {
    expect(phaseCeremonyLabel('barker', 'chart_invoke', 'chart_invoke')).toBe(
      'Taking the liberty 🧘'
    );
    expect(phaseCeremonyLabel('barker', 'chart_transform', 'Transform')).toBe(
      'Killing the darlings…'
    );
    expect(phaseCeremonyLabel('russ', 'anything_invoke', 'anything_invoke')).toMatch(
      /Shipping it loud/
    );
    expect(phaseCeremonyLabel('jared', 'forms_repair_3', 'forms_repair_3')).toMatch(/Still on me/);
    expect(phaseCeremonyLabel('richard', 'chart_style', 'Style')).toMatch(/hue has a history/);
  });

  it('returns a tagline for every variant', () => {
    for (const v of ['gilfoyle', 'erlich', 'russ', 'jared', 'richard', 'barker']) {
      expect(VARIANT_TAGLINES[v]).toBeTruthy();
      expect(VARIANT_BOOT_HEADLINES[v]).toBeTruthy();
    }
  });

  it('returns a fallback persona for unknown variant', () => {
    const fallback = getVariantPersona('something-else');
    expect(fallback.name).toBeTruthy();
    expect(typeof fallback.xpAward).toBe('number');
  });

  it('chooses prestige tier by total runs', () => {
    expect(prestigeForTotalRuns(0).label).toBe('Slop Trainee');
    expect(prestigeForTotalRuns(5).label).toBe('Junior Slopitect');
    expect(prestigeForTotalRuns(10).label).toBe('Senior Slopitect');
    expect(prestigeForTotalRuns(25).label).toBe('Principal Slopitect');
    expect(prestigeForTotalRuns(50).label).toMatch(/Fellow/);
    expect(prestigeForTotalRuns(9999).label).toMatch(/Fellow/);
  });

  it('rotates tips stably by index', () => {
    expect(tipForIndex(0)).toBe(IDLE_TIPS[0]);
    expect(tipForIndex(IDLE_TIPS.length)).toBe(IDLE_TIPS[0]);
    expect(typeof tipForIndex(NaN)).toBe('string');
  });

  it('has at least 3 quotes for every variant', () => {
    for (const v of ['gilfoyle', 'erlich', 'russ', 'jared', 'richard', 'barker']) {
      expect(VARIANT_QUOTES[v], `quotes for ${v}`).toBeDefined();
      expect(VARIANT_QUOTES[v].length).toBeGreaterThanOrEqual(3);
      for (const quote of VARIANT_QUOTES[v]) {
        expect(typeof quote).toBe('string');
        expect(quote.length).toBeGreaterThan(0);
      }
    }
  });

  it('rotates quotes stably by index', () => {
    expect(quoteForRotation('russ', 0)).toBe(VARIANT_QUOTES.russ[0]);
    expect(quoteForRotation('russ', VARIANT_QUOTES.russ.length)).toBe(VARIANT_QUOTES.russ[0]);
    expect(quoteForRotation('unknown', 0)).toBe('');
    expect(typeof quoteForRotation('gilfoyle', NaN)).toBe('string');
  });

  it('names the gilfoyle persona Bertram Gilfoyle with an architect-flavored title', () => {
    expect(VARIANT_PERSONAS.gilfoyle.name).toBe('Bertram Gilfoyle');
    expect(VARIANT_PERSONAS.gilfoyle.title.toLowerCase()).toMatch(/architect|system/);
    expect(stakeholderTooltip('gilfoyle')).toContain('Bertram Gilfoyle');
  });

  it('names the erlich persona Erlich Bachman', () => {
    expect(VARIANT_PERSONAS.erlich.name).toBe('Erlich Bachman');
    expect(stakeholderTooltip('erlich')).toContain('Erlich Bachman');
  });

  it('exposes avatar emoji and entry/exit lines per persona', () => {
    for (const v of ['gilfoyle', 'erlich', 'russ', 'jared', 'richard', 'barker']) {
      const persona = VARIANT_PERSONAS[v];
      expect(persona.avatarEmoji, `avatar for ${v}`).toBeTruthy();
      expect(persona.entryLine, `entry for ${v}`).toBeTruthy();
      expect(persona.exitLine, `exit for ${v}`).toBeTruthy();
    }
  });

  it('matches more enterprise jargon than before (extended easter eggs)', () => {
    const eggMatches = (text) =>
      PROMPT_EASTER_EGGS.filter((e) => e.match.test(text)).map((e) => e.toast);
    expect(eggMatches('we should leverage agile cloud-native synergy')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Story points/),
        expect.stringMatching(/Synergised|Synergy/),
        expect.stringMatching(/Born in the cloud/)
      ])
    );
    expect(eggMatches('schedule a co-design workshop for synergy')).toEqual(
      expect.arrayContaining([expect.stringMatching(/Co-Design|VP/)])
    );
    expect(eggMatches('scrum standup')).toEqual(
      expect.arrayContaining([expect.stringMatching(/STAND UP/)])
    );
  });

  it('exposes a konami achievement banner', () => {
    expect(KONAMI_ACHIEVEMENT.id).toBeTruthy();
    expect(KONAMI_ACHIEVEMENT.title).toMatch(/AWAKENED/);
    expect(KONAMI_ACHIEVEMENT.subtitle).toBeTruthy();
  });

  it('keeps prompt and mute chrome copy distinct (no duplicate role tag)', () => {
    expect(PROMPT_ACTION_COPY.label).toBe('Edit');
    expect(PROMPT_ACTION_COPY.roleTag).not.toBe(PROMPT_ACTION_COPY.label);
    expect(PROMPT_ACTION_COPY.roleTag).toBe('This part only');
    expect(STAKEHOLDERS_MUTE_COPY.stakeholdersTag).toBe('Your Team');
  });
});
