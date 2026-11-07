import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyInboundMessage, parseSemanticDecision } from '../src/semantic-router.mjs';

test('semantic router parses a structured group-conversation decision', () => {
  assert.deepEqual(parseSemanticDecision('{"intent":"group_conversation","confidence":0.99,"reason":"group chat","question":null,"channels":[]}'), {
    intent: 'group_conversation', confidence: 0.99, reason: 'group chat', question: null, channels: [], copy: null,
    replaceImage: false, resend: false, controlAction: null,
  });
});

test('low-confidence mutating intent is converted to one clarification', async () => {
  const result = await classifyInboundMessage({}, { message: 'לא ברור' }, {
    runModel: async () => '{"intent":"create_post","confidence":0.55,"reason":"unclear","question":"האם להכין מזה פוסט?","channels":[]}',
  });
  assert.equal(result.intent, 'clarification');
  assert.equal(result.question, 'האם להכין מזה פוסט?');
});

test('semantic router rejects unknown intent values', () => {
  assert.throws(() => parseSemanticDecision('{"intent":"invented","confidence":1}'), /intent_invalid/);
});
