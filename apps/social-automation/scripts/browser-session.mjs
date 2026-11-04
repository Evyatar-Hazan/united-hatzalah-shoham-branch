#!/usr/bin/env node
import { loadConfig } from '../src/config.mjs';
import { classifySession, launchSocialBrowser, socialUrls } from '../src/browser-profile.mjs';

const mode = process.argv[2] || 'login';
if (!['login', 'verify'].includes(mode)) throw new Error('usage: browser-session.mjs login|verify');

const config = loadConfig();
const urls = socialUrls(config);
const context = await launchSocialBrowser(config, { headless: false });

async function inspect(name, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  return {
    name,
    status: classifySession(page.url(), await page.title(), bodyText.slice(0, 3000)),
    origin: new URL(page.url()).origin,
  };
}

if (mode === 'verify') {
  const results = [];
  for (const [name, url] of Object.entries(urls)) results.push(await inspect(name, url));
  console.log(JSON.stringify({ profile: config.browserProfileDir, results }, null, 2));
  await context.close();
} else {
  for (const url of Object.values(urls)) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
  }
  const pages = context.pages();
  if (pages[0] && pages.length > 2) await pages[0].close().catch(() => {});
  console.log(JSON.stringify({
    ready: true,
    profile: config.browserProfileDir,
    instruction: 'Log in to Meta and ihud.shoham@gmail.com, then close the browser window.',
  }, null, 2));
  await new Promise((resolve) => context.once('close', resolve));
}
