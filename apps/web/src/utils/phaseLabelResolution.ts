/**
 * Shared phase-id normalization for run timeline labels and stakeholder ceremony copy.
 * Slot-prefixed ids (`chart_invoke`, `anything_repair_2`, …) strip to their tail
 * (`invoke`, `repair_2`) before lookup so every content mode shares one ceremony table.
 */

export const CONTENT_SLOT_PHASE_PREFIX = /^(chart|anything|metaphor|forms|infographic)_(.+)$/;

export function basePhaseId(phaseId: string): string {
  const id = String(phaseId ?? '');
  const match = id.match(CONTENT_SLOT_PHASE_PREFIX);
  return match?.[2] ?? id;
}

/** Map open-ended repair attempts onto the nearest ceremony bucket. */
export function repairCeremonyKey(baseId: string): string | null {
  const match = String(baseId ?? '').match(/^repair_(\d+)$/);
  if (!match) return null;
  const n = parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return 'repair_1';
  return n >= 2 ? 'repair_2' : 'repair_1';
}

export function resolvePhaseCeremonyRow(
  ceremonies: Record<string, Record<string, string>> | null | undefined,
  phaseId: string
): Record<string, string> | null {
  if (!ceremonies || !phaseId) return null;
  const baseId = basePhaseId(phaseId);
  const repairKey = repairCeremonyKey(baseId);
  return (
    ceremonies[phaseId] ??
    ceremonies[baseId] ??
    (repairKey ? ceremonies[repairKey] : null) ??
    (baseId === 'style' ? (ceremonies.style ?? null) : null)
  );
}

const SLOT_PHASE_NOUN: Record<string, string> = {
  chart: 'chart',
  anything: 'page',
  metaphor: 'metaphor',
  metaphor3d: 'metaphor',
  forms: 'form',
  infographic: 'infographic'
};

/** Human label when no explicit map exists (last resort). */
export function humanizePrefixedPhaseId(id: string): string {
  const match = String(id ?? '').match(CONTENT_SLOT_PHASE_PREFIX);
  if (!match) return String(id ?? '').replaceAll('_', ' ');
  const slot = match[1] ?? '';
  const tail = match[2] ?? '';
  const noun = SLOT_PHASE_NOUN[slot] ?? slot;
  if (tail === 'invoke') return `Generate ${noun}`;
  if (tail === 'transform') return `Transform ${noun}`;
  if (tail === 'analyze') return `Analyze ${noun}`;
  if (tail.startsWith('repair')) return `Repair ${noun}`;
  if (tail === 'style') return `Style ${noun}`;
  return `${tail.replaceAll('_', ' ')} ${noun}`;
}

export function resolvePhaseIdLabel(
  labelMap: Record<string, string>,
  id: string,
  localizedPhases?: Record<string, string>
): string {
  const fromCopy = localizedPhases?.[id] ?? localizedPhases?.[basePhaseId(id)];
  if (fromCopy) return fromCopy;
  const direct = labelMap[id];
  if (direct) return direct;
  const base = basePhaseId(id);
  const repairKey = repairCeremonyKey(base);
  if (repairKey && labelMap[repairKey]) return labelMap[repairKey] ?? humanizePrefixedPhaseId(id);
  if (labelMap[base]) return labelMap[base] ?? humanizePrefixedPhaseId(id);
  return humanizePrefixedPhaseId(id);
}
