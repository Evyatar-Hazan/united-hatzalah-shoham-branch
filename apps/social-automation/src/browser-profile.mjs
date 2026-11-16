import { accessSync, chmodSync, constants, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

export function prepareBrowserProfile(config) {
  mkdirSync(config.browserProfileDir, { recursive: true, mode: 0o700 });
  chmodSync(config.browserProfileDir, 0o700);
  return config.browserProfileDir;
}

function chromePath(config) {
  accessSync(config.chromeExecutable, constants.X_OK);
  return config.chromeExecutable;
}

export function loginBrowserArgs(config, urls) {
  return [
    `--user-data-dir=${prepareBrowserProfile(config)}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...urls,
  ];
}

export function openLoginBrowser(config, urls) {
  return spawn(chromePath(config), loginBrowserArgs(config, urls), {
    stdio: 'ignore',
  });
}

async function waitForDebugEndpoint(port, child, timeoutMs = 30_000) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Chrome exited before remote debugging was ready (${child.exitCode})`);
    try {
      const response = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return endpoint;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Chrome remote debugging endpoint did not become ready');
}

export async function connectSocialBrowser(config, options = {}) {
  const args = [
    `--user-data-dir=${prepareBrowserProfile(config)}`,
    `--remote-debugging-port=${config.chromeDebugPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    options.headless ? '--headless=new' : '',
    'about:blank',
  ].filter(Boolean);
  const child = spawn(chromePath(config), args, { stdio: 'ignore' });
  const endpoint = await waitForDebugEndpoint(config.chromeDebugPort, child);
  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  if (!context) throw new Error('Chrome did not expose a browser context');
  return {
    context,
    async close() {
      await browser.close().catch(() => {});
      if (child.exitCode === null) child.kill('SIGTERM');
    },
  };
}

export function socialUrls(config) {
  const metaParams = new URLSearchParams();
  if (config.metaBusinessId) metaParams.set('business_id', config.metaBusinessId);
  if (config.metaPageId) metaParams.set('asset_id', config.metaPageId);
  const metaSuffix = metaParams.size ? `?${metaParams}` : '';
  return {
    meta: `https://business.facebook.com/latest/home${metaSuffix}`,
    googlePhotos: 'https://photos.google.com/albums',
  };
}

export function classifySession(url, title, bodyText = '') {
  const value = `${url}\n${title}\n${bodyText}`.toLowerCase();
  const loginSignals = [
    'accounts.google.com',
    'facebook.com/login',
    'business.facebook.com/login',
    'log into facebook',
    'התחברות לפייסבוק',
    'כניסה לחשבון google',
  ];
  return loginSignals.some((signal) => value.includes(signal)) ? 'login_required' : 'session_present';
}
