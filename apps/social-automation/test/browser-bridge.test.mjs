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
