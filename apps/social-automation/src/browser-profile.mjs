import { chmodSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

export function prepareBrowserProfile(config) {
  mkdirSync(config.browserProfileDir, { recursive: true, mode: 0o700 });
  chmodSync(config.browserProfileDir, 0o700);
  return config.browserProfileDir;
}

export async function launchSocialBrowser(config, options = {}) {
  const userDataDir = prepareBrowserProfile(config);
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: options.headless ?? false,
    viewport: options.viewport ?? { width: 1440, height: 980 },
    locale: 'he-IL',
    timezoneId: config.timezone,
    acceptDownloads: true,
  });
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
