#!/usr/bin/env node
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBridgeToken } from '../src/browser-bridge.mjs';
import { loadConfig } from '../src/config.mjs';

const config = loadConfig();
const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const target = join(config.dataDir, 'chrome-extension');
const loadedTarget = process.env.SOCIAL_CHROME_EXTENSION_DIR || join(homedir(), 'Desktop', 'Shoham Social Chrome Extension');
const token = ensureBridgeToken(config);
for (const extensionPath of new Set([target, loadedTarget])) {
  mkdirSync(extensionPath, { recursive: true, mode: 0o700 });
  for (const file of ['manifest.json', 'service-worker.js']) cpSync(join(source, file), join(extensionPath, file));
  writeFileSync(join(extensionPath, 'config.js'), `export const BRIDGE = ${JSON.stringify({ baseUrl: `http://127.0.0.1:${config.browserBridgePort}`, token })};\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ extensionPaths: [target, loadedTarget], chromeProfile: 'סניף שוהם והמושבים', instruction: 'Reload the already installed unpacked extension in chrome://extensions.' }, null, 2));
