import { describe, expect, it } from 'vitest';
import {
  basePhaseId,
  humanizePrefixedPhaseId,
  repairCeremonyKey,
  resolvePhaseCeremonyRow,
  resolvePhaseIdLabel
} from '../src/utils/phaseLabelResolution.js';
import { PHASE_CEREMONIES } from '../src/utils/slopitectCopy.js';
import {
  PHASE_ID_LABELS,
  ceremonyLabelFor,
  phaseIdLabel
} from '../src/components/runTimelineModel.js';

const STAKEHOLDER_VARIANTS = ['refine', 'innovate', 'goMad', 'critique', 'explain', 'barker'];

const SLOT_PREFIXES = ['chart', 'anything', 'metaphor', 'forms'] as const;

const SLOT_PHASE_TAILS = [
  'invoke',
  'transform',
  'analyze',
  'style',
  'repair_1',
  'repair_2',
  'repair_3',
  'syntax_fixer'
] as const;

const UNPREFIXED_PHASES = [
  'run_started',
  'planning',
  'analyze',
  'transform',
  'invoke',
  'repair_1',
  'repair_2',
  'syntax_fixer',
  'syntax_repair',
  'agent_run'
];

describe('phaseLabelResolution', () => {
  it('strips slot prefixes for ceremony lookup', () => {
    expect(basePhaseId('chart_invoke')).toBe('invoke');
    expect(basePhaseId('anything_repair_2')).toBe('repair_2');
    expect(basePhaseId('forms_syntax_fixer')).toBe('syntax_fixer');
    expect(basePhaseId('invoke')).toBe('invoke');
  });

  it('buckets open-ended repair attempts', () => {
    expect(repairCeremonyKey('repair_1')).toBe('repair_1');
    expect(repairCeremonyKey('repair_2')).toBe('repair_2');
    expect(repairCeremonyKey('repair_3')).toBe('repair_2');
    expect(repairCeremonyKey('invoke')).toBeNull();
  });

  it('resolves style and repair rows for prefixed ids', () => {
    expect(resolvePhaseCeremonyRow(PHASE_CEREMONIES, 'chart_style')?.barker).toBe(
      'One brand color only.'
    );
    expect(resolvePhaseCeremonyRow(PHASE_CEREMONIES, 'anything_repair_3')?.critique).toMatch(
      /Second escalation/
    );
  });

  it('never returns raw slot-prefixed ids from humanizePrefixedPhaseId', () => {
    for (const prefix of SLOT_PREFIXES) {
      for (const tail of SLOT_PHASE_TAILS) {
        const id = `${prefix}_${tail}`;
        const label = humanizePrefixedPhaseId(id);
        expect(label).not.toBe(id);
        expect(label.toLowerCase()).not.toMatch(/^[a-z]+_[a-z0-9_]+$/);
      }
    }
  });
});

describe('runTimelineModel phase labels (all slots × stakeholders)', () => {
  it('phaseIdLabel never echoes raw slot-prefixed ids', () => {
    for (const prefix of SLOT_PREFIXES) {
      for (const tail of SLOT_PHASE_TAILS) {
        const id = `${prefix}_${tail}`;
        const label = phaseIdLabel(id);
        expect(label).not.toBe(id);
      }
    }
  });

  it('ceremonyLabelFor returns stakeholder copy for every slot invoke phase', () => {
    for (const prefix of SLOT_PREFIXES) {
      for (const variant of STAKEHOLDER_VARIANTS) {
        const id = `${prefix}_invoke`;
        const label = ceremonyLabelFor(variant, id, phaseIdLabel(id));
        expect(label).not.toBe(id);
        expect(label.length).toBeGreaterThan(2);
      }
    }
  });

  it('ceremonyLabelFor covers unprefixed mermaid/infographic phases for all stakeholders', () => {
    for (const phaseId of UNPREFIXED_PHASES) {
      for (const variant of STAKEHOLDER_VARIANTS) {
        const row = resolvePhaseCeremonyRow(PHASE_CEREMONIES, phaseId);
        if (!row?.[variant]) continue;
        const label = ceremonyLabelFor(variant, phaseId, phaseIdLabel(phaseId));
        expect(label).toBe(row[variant]);
      }
    }
  });

  it('resolvePhaseIdLabel maps repair_3+ to repair bucket labels', () => {
    expect(resolvePhaseIdLabel(PHASE_ID_LABELS, 'chart_repair_3', undefined)).toBe('Repair');
    expect(resolvePhaseIdLabel(PHASE_ID_LABELS, 'forms_repair_4', undefined)).toBe('Repair');
  });
});
