import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.mjs';

test('the live default approval roster contains only Erez', () => {
  const config = loadConfig({ SOCIAL_DATA_DIR: '/tmp/shoham-social-config-test' });
  assert.deepEqual(config.approvers.map((person) => person.key), ['erez']);
});

test('a non-empty explicit approval roster remains supported for isolated tests', () => {
  const roster = [{ key: 'tester', name: 'בודק' }];
  const config = loadConfig({
    SOCIAL_DATA_DIR: '/tmp/shoham-social-config-test',
    SOCIAL_APPROVERS_JSON: JSON.stringify(roster),
  });
  assert.deepEqual(config.approvers, roster);
});
