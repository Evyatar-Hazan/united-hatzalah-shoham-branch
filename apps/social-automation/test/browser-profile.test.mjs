import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySession, loginBrowserArgs, socialUrls } from '../src/browser-profile.mjs';

test('session classification fails closed on known login routes', () => {
  assert.equal(classifySession('https://www.facebook.com/login', 'Log into Facebook'), 'login_required');
  assert.equal(classifySession('https://accounts.google.com/v3/signin', 'כניסה לחשבון Google'), 'login_required');
});

test('social URLs contain the configured Meta assets', () => {
  const urls = socialUrls({ metaBusinessId: 'business-1', metaPageId: 'page-1' });
  assert.match(urls.meta, /business_id=business-1/);
  assert.match(urls.meta, /asset_id=page-1/);
  assert.equal(urls.googlePhotos, 'https://photos.google.com/albums');
});

test('login browser args never enable automation or remote debugging', () => {
  const args = loginBrowserArgs({ browserProfileDir: '/tmp/shoham-browser' }, ['https://photos.google.com/albums']);
  assert.ok(args.some((arg) => arg.startsWith('--user-data-dir=')));
  assert.ok(!args.some((arg) => arg.includes('remote-debugging')));
  assert.ok(!args.some((arg) => arg.includes('automation')));
});
