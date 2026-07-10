import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackLabelGibberish,
  getLabelExplainDumbLevel,
  LABEL_EXPLAIN_GIBBERISH_LEVEL,
  LABEL_EXPLAIN_GIVE_UP_LABEL,
  labelExplainDumbChipLabel,
  labelExplainDumbLoadingText,
  MAX_LABEL_EXPLAIN_DUMB_LEVEL
} from '../src/labelExplainDumbLevels.js';

test('dumb levels are bounded 1–6', () => {
  assert.equal(getLabelExplainDumbLevel(0), null);
  assert.equal(getLabelExplainDumbLevel(1)?.level, 1);
  assert.equal(getLabelExplainDumbLevel(MAX_LABEL_EXPLAIN_DUMB_LEVEL)?.level, 6);
  assert.equal(getLabelExplainDumbLevel(99), null);
});

test('chip label advances through toddler into give-up', () => {
  assert.match(labelExplainDumbChipLabel(0), /Dumb it Down/i);
  assert.match(labelExplainDumbChipLabel(1), /dumber|Kid/i);
  assert.match(labelExplainDumbChipLabel(MAX_LABEL_EXPLAIN_DUMB_LEVEL), /Babble/i);
  assert.equal(
    labelExplainDumbChipLabel(LABEL_EXPLAIN_GIBBERISH_LEVEL),
    LABEL_EXPLAIN_GIVE_UP_LABEL
  );
});

test('fallback gibberish is deterministic per label', () => {
  assert.equal(fallbackLabelGibberish('OAuth'), fallbackLabelGibberish('OAuth'));
  assert.notEqual(fallbackLabelGibberish('OAuth'), fallbackLabelGibberish('Queue'));
});

test('loading text differs for brief vs dumb', () => {
  assert.match(labelExplainDumbLoadingText(0), /Wise Architect/i);
  assert.match(labelExplainDumbLoadingText(6), /Bababooey/i);
});
