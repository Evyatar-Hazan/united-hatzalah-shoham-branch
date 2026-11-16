#!/usr/bin/env node
import { loadConfig } from '../src/config.mjs';
import { classifySession, connectSocialBrowser, openLoginBrowser, socialUrls } from '../src/browser-profile.mjs';

const mode = process.argv[2] || 'login';
if (!['login', 'verify'].includes(mode)) throw new Error('usage: browser-session.mjs login|verify');

const config = loadConfig();
const urls = socialUrls(config);

async function inspect(context, name, url) {
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
  const connection = await connectSocialBrowser(config, { headless: false });
  const results = [];
  for (const [name, url] of Object.entries(urls)) results.push(await inspect(connection.context, name, url));
  console.log(JSON.stringify({ profile: config.browserProfileDir, results }, null, 2));
  await connection.close();
} else {
  const child = openLoginBrowser(config, Object.values(urls));
  console.log(JSON.stringify({
    ready: true,
    profile: config.browserProfileDir,
    instruction: 'Regular Chrome opened without automation. Log in to Meta and ihud.shoham@gmail.com, then close the browser window.',
  }, null, 2));
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => code === 0 || code === null ? resolve() : reject(new Error(`Chrome exited ${code}`)));
  });
}
