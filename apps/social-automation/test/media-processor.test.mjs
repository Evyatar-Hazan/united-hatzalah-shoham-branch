import assert from 'node:assert/strict';
import test from 'node:test';
import { instagramSafeCrop } from '../src/media-processor.mjs';

test('instagram crop removes excess height from tall photos', () => {
  assert.deepEqual(instagramSafeCrop(739, 1600), { width: 739, height: 923 });
});

test('instagram crop removes excess width from panoramic photos', () => {
  assert.deepEqual(instagramSafeCrop(2000, 800), { width: 1528, height: 800 });
});

test('instagram crop preserves already supported photos', () => {
  assert.deepEqual(instagramSafeCrop(1080, 1350), { width: 1080, height: 1350 });
  assert.deepEqual(instagramSafeCrop(1080, 1080), { width: 1080, height: 1080 });
});
