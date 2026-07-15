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
    const stakeholderVariants = ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec'];
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
    expect(phaseCeremonyLabel('goMad', 'invoke', 'Generate')).toMatch(/fire/);
    expect(phaseCeremonyLabel('refine', 'invoke', 'Generate')).toBe('Patching prod 🛠');
    expect(phaseCeremonyLabel('critique', 'analyze', 'Analyze')).toBe('Opening JIRA…');
  });

  it('falls back to canonical label when no override exists', () => {
    expect(phaseCeremonyLabel('explain', 'transform', 'Transform')).toBe('Tracing the reshape…');
    expect(phaseCeremonyLabel('refine', 'totally-unknown-phase', 'Fallback')).toBe('Fallback');
    expect(phaseCeremonyLabel(undefined, 'analyze', 'Analyze')).toBe('Analyze');
  });

  it('maps slot-prefixed phase ids to base stakeholder ceremonies', () => {
    expect(phaseCeremonyLabel('exec', 'chart_invoke', 'chart_invoke')).toBe('Boarding the jet 🛩️');
    expect(phaseCeremonyLabel('exec', 'chart_transform', 'Transform')).toBe(
      'Killing the darlings…'
    );
    expect(phaseCeremonyLabel('goMad', 'anything_invoke', 'anything_invoke')).toMatch(/fire/);
    expect(phaseCeremonyLabel('critique', 'forms_repair_3', 'forms_repair_3')).toMatch(
      /Second escalation/
    );
    expect(phaseCeremonyLabel('explain', 'chart_style', 'Style')).toMatch(/history of this hue/);
  });

  it('returns a tagline for every variant', () => {
    for (const v of ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec']) {
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
    for (const v of ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec']) {
      expect(VARIANT_QUOTES[v], `quotes for ${v}`).toBeDefined();
      expect(VARIANT_QUOTES[v].length).toBeGreaterThanOrEqual(3);
      for (const quote of VARIANT_QUOTES[v]) {
        expect(typeof quote).toBe('string');
        expect(quote.length).toBeGreaterThan(0);
      }
    }
  });

  it('rotates quotes stably by index', () => {
    expect(quoteForRotation('goMad', 0)).toBe(VARIANT_QUOTES.goMad[0]);
    expect(quoteForRotation('goMad', VARIANT_QUOTES.goMad.length)).toBe(VARIANT_QUOTES.goMad[0]);
    expect(quoteForRotation('unknown', 0)).toBe('');
    expect(typeof quoteForRotation('refine', NaN)).toBe('string');
  });

  it('names the refine persona THE Engineer with an engineer-flavored title', () => {
    expect(VARIANT_PERSONAS.refine.name).toBe('THE Engineer');
    expect(VARIANT_PERSONAS.refine.title.toLowerCase()).toMatch(/build|engineer|step/);
    expect(stakeholderTooltip('refine')).toContain('THE Engineer');
  });

  it('names the innovate persona Chief Innovation Officer', () => {
    expect(VARIANT_PERSONAS.innovate.name).toBe('Chief Innovation Officer');
    expect(stakeholderTooltip('innovate')).toContain('Chief Innovation Officer');
  });

  it('exposes avatar emoji and entry/exit lines per persona', () => {
    for (const v of ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec']) {
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
    expect(PROMPT_ACTION_COPY.label).toBe('Weigh In');
    expect(PROMPT_ACTION_COPY.roleTag).not.toBe(PROMPT_ACTION_COPY.label);
    expect(PROMPT_ACTION_COPY.roleTag).toBe('Just Say It');
    expect(STAKEHOLDERS_MUTE_COPY.stakeholdersTag).toBe('Stakeholders');
  });
});
