import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySession, socialUrls } from '../src/browser-profile.mjs';

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
