import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCopy } from '../src/content-generator.mjs';

test('content generator fails closed to deterministic copy', async () => {
  const result = await generateCopy({ ollamaUrl: 'http://127.0.0.1:1', ollamaModel: 'missing' }, 'תרגול מתנדבים בשוהם', { timeoutMs: 50 });
  assert.equal(result.generator, 'fallback');
  assert.match(result.facebook, /תרגול מתנדבים בשוהם/);
});

test('content generator asks for verification on sensitive claims in fallback', async () => {
  const result = await generateCopy({ ollamaUrl: 'http://127.0.0.1:1', ollamaModel: 'missing' }, 'ילד נפצע באירוע', { timeoutMs: 50 });
  assert.match(result.clarification, /לאמת/);
});

test('content generator rejects an ungrounded model response', async () => {
  const server = (await import('node:http')).createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ response: JSON.stringify({ facebook: 'התרגול נועד להכין את הקהילה לדרישות החורף ולהציל חיים.', instagram: 'הכנה חשובה לחורף שמבטיחה ביטחון לכולם.', clarification: null }) }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const result = await generateCopy({ ollamaUrl: `http://127.0.0.1:${port}`, ollamaModel: 'test' }, 'מתנדבי הסניף קיימו תרגול ציוד.');
  assert.equal(result.generator, 'fallback');
  await new Promise((resolve) => server.close(resolve));
});
