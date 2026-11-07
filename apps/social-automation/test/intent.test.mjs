import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySocialIntent } from '../src/intent.mjs';

test('conversation addressed to another group participant remains silent', () => {
  assert.deepEqual(
    classifySocialIntent({ text: '@86513543032967 מאשר להעלות הזה?' }),
    { action: 'silence', reason: 'participant_conversation' },
  );
});

test('ordinary group conversation remains silent', () => {
  assert.equal(classifySocialIntent({ text: 'מי מגיע היום?' }).action, 'silence');
});

test('a direct reply to the bot is handled', () => {
  assert.equal(classifySocialIntent({ text: 'תתקן את הלב', replyToIsOwn: true }).action, 'handle');
});

test('an explicit post request is handled', () => {
  assert.equal(classifySocialIntent({ text: 'תכין פוסט על הפעילות של היום' }).action, 'handle');
});

test('an image submission is handled', () => {
  assert.equal(classifySocialIntent({ text: '', media: [{ path: '/tmp/photo.jpg' }] }).action, 'handle');
});

test('approval without a reply to a bot draft stays silent', () => {
  assert.equal(classifySocialIntent({ text: 'מאשר' }).action, 'silence');
});

test('asking for the latest draft is handled as a status request', () => {
  assert.deepEqual(
    classifySocialIntent({ text: 'מהי הסקיצה האחרונה שיש לנו?' }),
    { action: 'handle', reason: 'latest_draft_query' },
  );
});
