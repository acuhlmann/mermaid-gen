// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildRadialActions } from '../src/components/buildRadialActions.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';
import { PROMPT_ACTION_COPY } from '../src/utils/slopitectCopy.js';
import { ADVISOR_TRANSFORM_MODES } from '../src/utils/advisorAcceptRouting.js';
import { ADVISOR_ANALYZE_KINDS } from '../src/utils/advisorAcceptRouting.js';

function actions(overrides = {}) {
  return buildRadialActions({
    controls: CONTROLS_EN,
    slopitect: { PROMPT_ACTION_COPY },
    russStreak: 0,
    contentMode: 'mermaid',
    contentModeOptions: [{ id: 'mermaid', label: 'Diagram' }],
    canFixFromCritique: false,
    ...overrides
  });
}

describe('buildRadialActions', () => {
  it('gives every advisor seat a radial entry with real persona copy', () => {
    const byId = new Map(actions().map((entry) => [entry.id, entry]));
    for (const id of [...ADVISOR_TRANSFORM_MODES, ...ADVISOR_ANALYZE_KINDS]) {
      const entry = byId.get(id);
      expect(entry, `radial entry for ${id}`).toBeTruthy();
      // A missing locale key would silently render an empty wedge rather than throw.
      expect(entry.label, `label for ${id}`).toBeTruthy();
      expect(entry.persona, `persona name for ${id}`).toBeTruthy();
      expect(entry.personaTitle, `persona title for ${id}`).toContain('·');
    }
  });

  it('seats Dinesh next to Gilfoyle as his own action, not a Gilfoyle alias', () => {
    const list = actions();
    const ids = list.map((entry) => entry.id);
    expect(ids.indexOf('dinesh')).toBe(ids.indexOf('gilfoyle') + 1);

    const dinesh = list.find((entry) => entry.id === 'dinesh');
    const gilfoyle = list.find((entry) => entry.id === 'gilfoyle');
    // Distinct variant drives a distinct CSS accent and persona face.
    expect(dinesh.variant).toBe('dinesh');
    // No locale bundle is active here, so this is the raw VARIANT_PERSONAS name;
    // at runtime ACTION_PERSONA_SHORT_NAMES shortens it to "Dinesh".
    expect(dinesh.persona).toBe('Dinesh Chugtai');
    expect(dinesh.personaTitle).toContain('Engineer, Uncredited');
    // Both seats share the Refine action label; persona fields carry the cast split.
    expect(dinesh.label).toBe('Refine');
    expect(gilfoyle.label).toBe('Refine');
    expect(dinesh.personaEmoji).not.toBe(gilfoyle.personaEmoji);
  });

  it('puts Connect and Delete first on a flowchart node selection', () => {
    const list = actions({
      graphEdit: { enabled: true, kind: 'node', busy: false }
    }).filter((entry) => !entry.hidden);
    expect(list[0].id).toBe('connect');
    expect(list[1].id).toBe('delete');
    expect(list[2].id).toBe('rename');
  });

  it('hides Connect on an edge and hides all three on a cluster', () => {
    const edge = actions({ graphEdit: { enabled: true, kind: 'edge' } });
    expect(edge.find((entry) => entry.id === 'connect').hidden).toBe(true);
    expect(edge.find((entry) => entry.id === 'delete').hidden).toBe(false);
    const cluster = actions({ graphEdit: { enabled: true, kind: 'cluster' } });
    expect(cluster.find((entry) => entry.id === 'connect').hidden).toBe(true);
    expect(cluster.find((entry) => entry.id === 'delete').hidden).toBe(true);
    expect(cluster.find((entry) => entry.id === 'rename').hidden).toBe(true);
  });

  it('disables Connect, Delete, and Rename while an agent run is streaming', () => {
    const list = actions({ graphEdit: { enabled: true, kind: 'node', busy: true } });
    expect(list.find((entry) => entry.id === 'connect').disabled).toBe(true);
    expect(list.find((entry) => entry.id === 'delete').disabled).toBe(true);
    expect(list.find((entry) => entry.id === 'rename').disabled).toBe(true);
  });
});
