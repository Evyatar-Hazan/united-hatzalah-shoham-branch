import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCopy } from '../src/content-generator.mjs';

test('content generator uses Codex structured output', async () => {
  const result = await generateCopy({}, 'תרגול מתנדבים בשוהם', { runModel: async () => JSON.stringify({
    facebook: 'תרגול מתנדבים בשוהם.',
    instagram: 'תרגול מתנדבים בשוהם.\n#איחודהצלה #שוהם #קהילה',
    clarification: null,
  }) });
  assert.equal(result.generator, 'codex');
  assert.match(result.facebook, /תרגול מתנדבים בשוהם/);
});

test('content generator requires verification for sensitive claims', async () => {
  const result = await generateCopy({}, 'ילד נפצע באירוע', { runModel: async () => JSON.stringify({
    facebook: 'ילד נפצע באירוע.',
    instagram: 'ילד נפצע באירוע.\n#איחודהצלה #שוהם #קהילה',
    clarification: null,
  }) });
  assert.match(result.clarification, /לאמת/);
});

test('content generator rejects an ungrounded model response', async () => {
  await assert.rejects(() => generateCopy({}, 'מתנדבי הסניף קיימו תרגול ציוד.', { runModel: async () => JSON.stringify({
    facebook: 'התרגול נועד להכין את הקהילה לדרישות החורף ולהציל חיים.',
    instagram: 'הכנה חשובה לחורף שמבטיחה ביטחון לכולם.',
    clarification: null,
  }) }), /not_grounded/);
});
