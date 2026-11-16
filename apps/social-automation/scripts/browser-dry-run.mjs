#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../src/config.mjs';

const config = loadConfig();
const token = readFileSync(config.browserBridgeTokenPath, 'utf8').trim();
const request = async (type, payload) => {
  const response = await fetch(`http://127.0.0.1:${config.browserBridgePort}/request/${type}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-browser-bridge-token': token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || `bridge returned ${response.status}`);
  return data.result;
};

const healthResponse = await fetch(`http://127.0.0.1:${config.browserBridgePort}/health`, {
  headers: { 'x-browser-bridge-token': token },
  signal: AbortSignal.timeout(10_000),
});
const health = await healthResponse.json();
if (!healthResponse.ok || !health.success) throw new Error(health.error || `bridge returned ${healthResponse.status}`);
const mediaName = readdirSync(config.mediaDir).find((name) => /\.(?:jpe?g|png|webp)$/i.test(name));
if (!mediaName) throw new Error('browser dry-run requires one image in the configured media directory');
const media = [{ path: join(config.mediaDir, mediaName) }];
const text = 'בדיקת מערכת בלבד, לא לפרסום. מתנדבי סניף שוהם והמושבים ממשיכים להתכונן למען הקהילה. 💚';
const facebook = await request('prepareMetaPost', { channel: 'facebook', text, media, businessId: config.metaBusinessId, pageId: config.metaPageId });
const instagram = await request('prepareMetaPost', { channel: 'instagram', text: `${text}\n\n#איחודהצלה #שוהם #קהילה`, media, businessId: config.metaBusinessId, pageId: config.metaPageId });
if (!facebook.dryRun || !instagram.dryRun) throw new Error('browser dry-run did not remain dry');
console.log(JSON.stringify({ health, facebook, instagram, published: false }, null, 2));
