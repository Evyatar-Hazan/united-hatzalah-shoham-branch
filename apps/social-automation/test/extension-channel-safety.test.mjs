import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../extension/service-worker.js', import.meta.url));
const manifestPath = fileURLToPath(new URL('../extension/manifest.json', import.meta.url));

test('Meta publishing rechecks one visible destination atomically before clicking publish', () => {
  const source = readFileSync(workerPath, 'utf8');
  assert.match(source, /async function debuggerVerifyChannelAndPublish/);
  assert.match(source, /facebookChoices\.length !== 1 \|\| instagramChoices\.length !== 1/);
  assert.match(source, /style\?\.visibility !== 'hidden'/);
  assert.match(source, /meta_atomic_channel_guard_failed/);
  assert.match(source, /await debuggerVerifyChannelAndPublish\(tab\.id, payload\.channel\)/);
  assert.doesNotMatch(source, /debuggerClickPublish/);
});

test('extension polling cannot start a second Meta command while one is active', () => {
  const source = readFileSync(workerPath, 'utf8');
  assert.match(source, /let pollInProgress = false/);
  assert.match(source, /if \(pollInProgress\) return/);
  assert.match(source, /finally \{ pollInProgress = false; \}/);
});

test('extension build is bumped after the destination safety fix', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const source = readFileSync(workerPath, 'utf8');
  assert.equal(manifest.version, '0.2.5');
  assert.match(source, /build: '2026-11-16\.15'/);
});
