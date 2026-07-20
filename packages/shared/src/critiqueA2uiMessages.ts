import { splitCritiqueActionableSections } from './critiqueActionable.js';

/**
 * Critique checklist A2UI payloads. Wire path: `emit(createLegacyA2uiStreamEvent(messages))`
 * in the agent → `createAgentStreamEmitter` → AG-UI `CUSTOM` (`AGUI_CUSTOM_NAME_A2UI`) →
 * `createAgUiTranslator` on the client. For a second surface, add builders here (or a sibling
 * module), reuse `createLegacyA2uiStreamEvent`, and render with the same allowlisted catalog pattern.
 */
/** Must match `basicCatalog.id` from `@a2ui/react` v0.9. */
export const A2UI_BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

/** Single-surface id for critique actionable checklist (AG-UI `CUSTOM` a2ui payload). */
export const A2UI_CRITIQUE_SURFACE_ID = 'critique-actionables';

const ACTION_FIX_ALL = 'archislop_fixAll';
const ACTION_FIX_SELECTED = 'archislop_fixSelected';

export type CritiqueA2uiLabels = {
  heading?: string;
  fixSelected?: string;
  fixAll?: string;
};

const DEFAULT_LABELS: Required<CritiqueA2uiLabels> = {
  heading: 'Actionable improvements',
  fixSelected: 'Fix selected',
  fixAll: 'Fix all'
};

/**
 * Builds A2UI v0.9 messages for the "## Actionable …" checklist + Fix controls.
 * Returns [] when the critique has no actionable section (same gate as legacy UI).
 *
 * @param {string} critiqueMarkdown
 * @param {CritiqueA2uiLabels} [labels]
 * @returns {object[]}
 */
export function buildCritiqueActionableA2uiMessages(
  critiqueMarkdown: string | null | undefined,
  labels?: CritiqueA2uiLabels
) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const split = splitCritiqueActionableSections(critiqueMarkdown);
  if (!split.hasSection || split.items.length === 0) return [];

  const items = split.items;
  const n = items.length;
  const checksChildren = items.map((_, i) => `cb_${i}`);
  const heading = split.headingText?.trim() || copy.heading;

  const checksData = items.map((label) => ({ label, value: false }));

  const components: Array<Record<string, unknown>> = [
    {
      id: 'root',
      component: 'Column',
      children: ['hdr', 'checks_col', 'div1', 'btn_row']
    },
    {
      id: 'hdr',
      component: 'Text',
      text: heading,
      variant: 'h3'
    },
    {
      id: 'checks_col',
      component: 'Column',
      children: checksChildren
    },
    { id: 'div1', component: 'Divider' },
    {
      id: 'btn_row',
      component: 'Row',
      children: ['btn_fix_sel', 'btn_fix_all'],
      justify: 'spaceBetween',
      align: 'center'
    }
  ];

  for (let i = 0; i < n; i++) {
    components.push({
      id: `cb_${i}`,
      component: 'CheckBox',
      label: items[i],
      value: { path: `/checks/${i}/value` }
    });
  }

  components.push(
    { id: 'btn_fix_sel_txt', component: 'Text', text: copy.fixSelected, variant: 'body' },
    {
      id: 'btn_fix_sel',
      component: 'Button',
      child: 'btn_fix_sel_txt',
      variant: 'default',
      action: { event: { name: ACTION_FIX_SELECTED, context: {} } }
    },
    { id: 'btn_fix_all_txt', component: 'Text', text: copy.fixAll, variant: 'body' },
    {
      id: 'btn_fix_all',
      component: 'Button',
      child: 'btn_fix_all_txt',
      variant: 'primary',
      action: { event: { name: ACTION_FIX_ALL, context: {} } }
    }
  );

  return [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: A2UI_CRITIQUE_SURFACE_ID,
        catalogId: A2UI_BASIC_CATALOG_ID
      }
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: A2UI_CRITIQUE_SURFACE_ID,
        components
      }
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: A2UI_CRITIQUE_SURFACE_ID,
        path: '/',
        value: { checks: checksData }
      }
    }
  ];
}
