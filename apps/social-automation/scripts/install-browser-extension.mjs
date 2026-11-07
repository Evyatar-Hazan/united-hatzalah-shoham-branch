#!/usr/bin/env node
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBridgeToken } from '../src/browser-bridge.mjs';
import { loadConfig } from '../src/config.mjs';

const config = loadConfig();
const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const target = join(config.dataDir, 'chrome-extension');
mkdirSync(target, { recursive: true, mode: 0o700 });
for (const file of ['manifest.json', 'service-worker.js']) cpSync(join(source, file), join(target, file));
const token = ensureBridgeToken(config);
writeFileSync(join(target, 'config.js'), `export const BRIDGE = ${JSON.stringify({ baseUrl: `http://127.0.0.1:${config.browserBridgePort}`, token })};\n`, { mode: 0o600 });
console.log(JSON.stringify({ extensionPath: target, chromeProfile: 'Profile 9', instruction: 'Open chrome://extensions, enable Developer mode, choose Load unpacked, and select extensionPath.' }, null, 2));
