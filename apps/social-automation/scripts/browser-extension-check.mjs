#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.mjs';

const config = loadConfig();
const token = readFileSync(config.browserBridgeTokenPath, 'utf8').trim();
const response = await fetch(`http://127.0.0.1:${config.browserBridgePort}/request/health`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-browser-bridge-token': token },
  body: '{}',
  signal: AbortSignal.timeout(45_000),
});
const data = await response.json().catch(() => ({}));
if (!response.ok || !data.success) throw new Error(data.error || `bridge returned ${response.status}`);
console.log(JSON.stringify(data.result, null, 2));
