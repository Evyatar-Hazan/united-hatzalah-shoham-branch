#!/usr/bin/env node
import { readFileSync } from 'node:fs';
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

const health = await request('health', {});
const text = 'בדיקת מערכת בלבד — לא לפרסום. מתנדבי סניף שוהם והמושבים ממשיכים להתכונן למען הקהילה. 💚';
const facebook = await request('prepareMetaPost', { channel: 'facebook', text, media: [], businessId: config.metaBusinessId, pageId: config.metaPageId });
const instagram = await request('prepareMetaPost', { channel: 'instagram', text: `${text}\n\n#איחודהצלה #שוהם #קהילה`, media: [], businessId: config.metaBusinessId, pageId: config.metaPageId });
if (!facebook.dryRun || !instagram.dryRun) throw new Error('browser dry-run did not remain dry');
console.log(JSON.stringify({ health, facebook, instagram, published: false }, null, 2));
