import test from 'node:test';
import assert from 'node:assert/strict';
import {
  A2UI_BASIC_CATALOG_ID,
  buildFormsSeedDoc,
  FORMS_A2UI_SURFACE_ID,
  FORMS_A2UI_MAX_LENGTH,
  parseFormsA2ui
} from '../src/formsA2ui.js';

function validDoc(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    archislopFormsVersion: 1,
    formTitle: 'Form 1',
    formCode: 'A-1',
    messages: [
      { createSurface: { surfaceId: 'x', catalogId: 'other' } },
      {
        updateComponents: {
          surfaceId: 'x',
          components: [
            { id: 'root', component: 'Column', children: ['t', 'b'] },
            { id: 't', component: 'TextField', label: 'Name', value: { path: '/t' } },
            { id: 'bt', component: 'Text', text: 'Submit' },
            {
              id: 'b',
              component: 'Button',
              child: 'bt',
              action: { event: { name: 'archislop_submitForm' } }
            }
          ]
        }
      },
      { updateDataModel: { surfaceId: 'x', path: '/', value: { t: '' } } }
    ],
    ...overrides
  });
}

test('parseFormsA2ui accepts the seed document', () => {
  const r = parseFormsA2ui(buildFormsSeedDoc());
  assert.ok(r.ok);
  assert.ok(r.ok && r.meta.buttonCount >= 1);
  assert.ok(r.ok && r.meta.inputCount >= 1);
});

test('parseFormsA2ui normalizes surfaceId and catalogId to the fixed values', () => {
  const r = parseFormsA2ui(validDoc());
  assert.ok(r.ok);
  if (!r.ok) return;
  const msgs = r.doc.messages as Array<Record<string, any>>;
  assert.equal(msgs[0].createSurface.surfaceId, FORMS_A2UI_SURFACE_ID);
  assert.equal(msgs[0].createSurface.catalogId, A2UI_BASIC_CATALOG_ID);
  assert.equal(msgs[1].updateComponents.surfaceId, FORMS_A2UI_SURFACE_ID);
  assert.equal(msgs[2].updateDataModel.surfaceId, FORMS_A2UI_SURFACE_ID);
});

test('parseFormsA2ui tolerates a ```json code fence', () => {
  const r = parseFormsA2ui('```json\n' + validDoc() + '\n```');
  assert.ok(r.ok);
});

test('parseFormsA2ui rejects unknown component names', () => {
  const bad = validDoc({
    messages: [
      { createSurface: {} },
      {
        updateComponents: {
          components: [
            { id: 'root', component: 'Column', children: ['x'] },
            { id: 'x', component: 'Wormhole' }
          ]
        }
      }
    ]
  });
  const r = parseFormsA2ui(bad);
  assert.ok(!r.ok);
  assert.match((r as { error: string }).error, /Wormhole/);
});

test('parseFormsA2ui rejects functionCall button actions', () => {
  const bad = validDoc({
    messages: [
      { createSurface: {} },
      {
        updateComponents: {
          components: [
            { id: 'root', component: 'Column', children: ['t', 'b'] },
            { id: 't', component: 'CheckBox', label: 'ok', value: { path: '/t' } },
            { id: 'bt', component: 'Text', text: 'go' },
            { id: 'b', component: 'Button', child: 'bt', action: { functionCall: { name: 'x' } } }
          ]
        }
      },
      { updateDataModel: { path: '/', value: { t: false } } }
    ]
  });
  const r = parseFormsA2ui(bad);
  assert.ok(!r.ok);
  assert.match((r as { error: string }).error, /functionCall/);
});

test('parseFormsA2ui requires a Button', () => {
  const r = parseFormsA2ui(
    validDoc({
      messages: [
        { createSurface: {} },
        {
          updateComponents: {
            components: [
              { id: 'root', component: 'Column', children: ['t'] },
              { id: 't', component: 'TextField', label: 'n', value: { path: '/t' } }
            ]
          }
        },
        { updateDataModel: { path: '/', value: { t: '' } } }
      ]
    })
  );
  assert.ok(!r.ok);
  assert.match((r as { error: string }).error, /Button/);
});

test('parseFormsA2ui requires an input control', () => {
  const r = parseFormsA2ui(
    validDoc({
      messages: [
        { createSurface: {} },
        {
          updateComponents: {
            components: [
              { id: 'root', component: 'Column', children: ['bt', 'b'] },
              { id: 'bt', component: 'Text', text: 'go' },
              { id: 'b', component: 'Button', child: 'bt', action: { event: { name: 'x' } } }
            ]
          }
        }
      ]
    })
  );
  assert.ok(!r.ok);
  assert.match((r as { error: string }).error, /input control/);
});

test('parseFormsA2ui requires a root component', () => {
  const r = parseFormsA2ui(
    validDoc({
      messages: [
        { createSurface: {} },
        {
          updateComponents: {
            components: [
              { id: 'top', component: 'Column', children: ['t', 'b'] },
              { id: 't', component: 'TextField', label: 'n', value: { path: '/t' } },
              { id: 'bt', component: 'Text', text: 'go' },
              { id: 'b', component: 'Button', child: 'bt', action: { event: { name: 'x' } } }
            ]
          }
        },
        { updateDataModel: { path: '/', value: { t: '' } } }
      ]
    })
  );
  assert.ok(!r.ok);
  assert.match((r as { error: string }).error, /root/);
});

test('parseFormsA2ui rejects invalid JSON and oversized documents', () => {
  assert.ok(!parseFormsA2ui('{ not json').ok);
  assert.ok(!parseFormsA2ui('x'.repeat(FORMS_A2UI_MAX_LENGTH + 1)).ok);
  assert.ok(!parseFormsA2ui(42 as unknown as string).ok);
});

test('parseFormsA2ui serializes pretty-printed A2UI for the editor/slot', () => {
  const r = parseFormsA2ui(validDoc());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.match(r.text, /\n/);
  assert.match(r.text, /"archislopFormsVersion": 1/);
  // Round-trip the pretty form.
  const again = parseFormsA2ui(r.text);
  assert.ok(again.ok);
});

test('buildFormsSeedDoc returns formatted A2UI JSON', () => {
  const seed = buildFormsSeedDoc();
  assert.match(seed, /\n {2}"formTitle"/);
  assert.ok(parseFormsA2ui(seed).ok);
});
