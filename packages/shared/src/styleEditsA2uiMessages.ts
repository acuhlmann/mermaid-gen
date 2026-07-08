import { A2UI_BASIC_CATALOG_ID } from './critiqueA2uiMessages.js';
import type { A2uiV09Message } from './legacyStreamEvents.js';
import { styleEditSummaryLine, type StyleEdit } from './styleEdits.js';

/** A2UI surface for server-built style edit cards in the Thinking pane. */
export const A2UI_STYLE_EDITS_SURFACE_ID = 'style-edits';

export const ACTION_APPLY_STYLE_EDITS = 'archislop_applyStyleEdits';

/**
 * A2UI v0.9 messages for style edit cards (read-only rows + optional Apply).
 *
 * @param edits Parsed style edit rows from critique/style prose.
 */
export function buildStyleEditsA2uiMessages(edits: StyleEdit[]): A2uiV09Message[] {
  if (!Array.isArray(edits) || edits.length === 0) return [];

  const rowIds = edits.map((_, i) => `row_${i}`);
  const components: Array<Record<string, unknown>> = [
    {
      id: 'root',
      component: 'Column',
      children: ['hdr', 'rows_col', 'div1', 'btn_apply']
    },
    { id: 'hdr', component: 'Text', text: 'Visual tweaks', variant: 'h3' },
    { id: 'rows_col', component: 'Column', children: rowIds },
    { id: 'div1', component: 'Divider' },
    { id: 'btn_apply_txt', component: 'Text', text: 'Apply style tweaks', variant: 'body' },
    {
      id: 'btn_apply',
      component: 'Button',
      child: 'btn_apply_txt',
      variant: 'primary',
      action: { event: { name: ACTION_APPLY_STYLE_EDITS, context: {} } }
    }
  ];

  for (let i = 0; i < edits.length; i++) {
    components.push({
      id: rowIds[i],
      component: 'Text',
      text: styleEditSummaryLine(edits[i]),
      variant: 'body'
    });
  }

  return [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: A2UI_STYLE_EDITS_SURFACE_ID,
        catalogId: A2UI_BASIC_CATALOG_ID
      }
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: A2UI_STYLE_EDITS_SURFACE_ID,
        components
      }
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: A2UI_STYLE_EDITS_SURFACE_ID,
        path: '/',
        value: { count: edits.length }
      }
    }
  ];
}
