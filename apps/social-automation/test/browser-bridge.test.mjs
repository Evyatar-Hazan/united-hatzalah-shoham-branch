import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startBrowserBridge } from '../src/browser-bridge.mjs';

test('browser bridge authenticates and completes a command', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-browser-bridge-'));
  const config = { dataDir, mediaDir: join(dataDir, 'media'), browserBridgePort: 0, browserBridgeTokenPath: join(dataDir, 'token') };
  const bridge = await startBrowserBridge(config);
  const request = bridge.request('health', { value: 1 }, { timeoutMs: 2_000 });
  const next = await fetch(`http://127.0.0.1:${bridge.port}/next`, { headers: { 'x-browser-bridge-token': bridge.token } });
  const { command } = await next.json();
  assert.equal(command.type, 'health');
  await fetch(`http://127.0.0.1:${bridge.port}/complete/${command.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-browser-bridge-token': bridge.token },
    body: JSON.stringify({ success: true, result: { ok: true } }),
  });
  assert.deepEqual(await request, { ok: true });
  assert.equal(readFileSync(config.browserBridgeTokenPath, 'utf8').trim(), bridge.token);
  await bridge.close();
});

test('browser bridge rejects a wrong token', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-browser-bridge-auth-'));
  const config = { dataDir, mediaDir: join(dataDir, 'media'), browserBridgePort: 0, browserBridgeTokenPath: join(dataDir, 'token') };
  const bridge = await startBrowserBridge(config);
  const response = await fetch(`http://127.0.0.1:${bridge.port}/health`, { headers: { 'x-browser-bridge-token': 'wrong' } });
  assert.equal(response.status, 401);
  await bridge.close();
});

test('browser bridge routes Meta and Google commands only to the matching Chrome profile capability', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-browser-bridge-routing-'));
  const config = { dataDir, mediaDir: join(dataDir, 'media'), browserBridgePort: 0, browserBridgeTokenPath: join(dataDir, 'token') };
  const bridge = await startBrowserBridge(config);
  const metaRequest = bridge.request('publishMeta', { value: 'meta' }, { timeoutMs: 2_000 });
  const googleRequest = bridge.request('syncGooglePhotos', { value: 'google' }, { timeoutMs: 2_000 });
  const headers = { 'x-browser-bridge-token': bridge.token };

  const legacyNext = await fetch(`http://127.0.0.1:${bridge.port}/next`, { headers });
  assert.equal((await legacyNext.json()).command, null);

  const googleNext = await fetch(`http://127.0.0.1:${bridge.port}/next?capability=google`, { headers });
  const { command: googleCommand } = await googleNext.json();
  assert.equal(googleCommand.type, 'syncGooglePhotos');
  await fetch(`http://127.0.0.1:${bridge.port}/complete/${googleCommand.id}`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ success: true, result: { profile: 'google' } }),
  });

  const metaNext = await fetch(`http://127.0.0.1:${bridge.port}/next?capability=meta`, { headers });
  const { command: metaCommand } = await metaNext.json();
  assert.equal(metaCommand.type, 'publishMeta');
  await fetch(`http://127.0.0.1:${bridge.port}/complete/${metaCommand.id}`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ success: true, result: { profile: 'meta' } }),
  });

  assert.deepEqual(await googleRequest, { profile: 'google' });
  assert.deepEqual(await metaRequest, { profile: 'meta' });
  await bridge.close();
});

test('browser bridge allows one trusted Chrome profile to serve both Google and Meta commands', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-browser-bridge-multi-routing-'));
  const config = { dataDir, mediaDir: join(dataDir, 'media'), browserBridgePort: 0, browserBridgeTokenPath: join(dataDir, 'token') };
  const bridge = await startBrowserBridge(config);
  const headers = { 'x-browser-bridge-token': bridge.token };
  const googleRequest = bridge.request('syncGooglePhotos', {}, { timeoutMs: 5_000 });
  const metaRequest = bridge.request('publishMeta', {}, { timeoutMs: 5_000 });

  const googleNext = await fetch(`http://127.0.0.1:${bridge.port}/next?capability=google,meta`, { headers });
  const googleCommand = (await googleNext.json()).command;
  assert.equal(googleCommand.type, 'syncGooglePhotos');
  await fetch(`http://127.0.0.1:${bridge.port}/complete/${googleCommand.id}`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ success: true }),
  });

  const metaNext = await fetch(`http://127.0.0.1:${bridge.port}/next?capability=google,meta`, { headers });
  const metaCommand = (await metaNext.json()).command;
  assert.equal(metaCommand.type, 'publishMeta');
  await fetch(`http://127.0.0.1:${bridge.port}/complete/${metaCommand.id}`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ success: true }),
  });

  await Promise.all([googleRequest, metaRequest]);
  await bridge.close();
});
