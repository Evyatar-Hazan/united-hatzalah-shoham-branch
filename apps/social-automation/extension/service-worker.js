import { BRIDGE } from './config.js';

const headers = () => ({ 'x-browser-bridge-token': BRIDGE.token });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

async function waitForTab(tabId, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return tab;
    await sleep(300);
  }
  throw new Error('tab_load_timeout');
}

async function openOrReuse(url) {
  const matches = await chrome.tabs.query({ url: `${new URL(url).origin}/*` });
  const tab = matches[0] || await chrome.tabs.create({ url, active: true });
  if (tab.url !== url) await chrome.tabs.update(tab.id, { url, active: true });
  return waitForTab(tab.id);
}

async function run(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func, args, world: 'MAIN' });
  const meaningful = results.find(({ result }) => {
    if (result === true || (typeof result === 'string' && result)) return true;
    if (Array.isArray(result)) return result.length > 0;
    if (result && typeof result === 'object') return result.hasCreatePost || result.hasPublish || result.src || result.prepared || result.published;
    return false;
  });
  return meaningful?.result ?? results.find(({ result }) => result !== undefined && result !== null)?.result;
}

async function collectAlbums(tabId) {
  return run(tabId, async () => {
    const found = new Map();
    for (let step = 0; step < 12; step += 1) {
      for (const link of document.querySelectorAll('a[href]')) {
        const rawText = (link.innerText || link.getAttribute('aria-label') || '').trim();
        const text = (rawText.split('\n')[0] || '').trim();
        const href = link.href || '';
        if (text && /photos\.google\.com\/(album|share)\//.test(href)) found.set(text, href);
      }
      window.scrollBy(0, Math.max(700, window.innerHeight * 0.8));
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    return [...found].map(([name, url]) => ({ name, url }));
  });
}

async function pickAlbumPhotoUrl(tabId) {
  return run(tabId, async () => {
    for (let step = 0; step < 8; step += 1) {
      const links = [...document.querySelectorAll('a[href*="/photo/"]')];
      const imageLinks = links.filter((candidate) => {
        const label = `${candidate.getAttribute('aria-label') || ''} ${candidate.innerText || ''}`;
        return !/סרטון|video/i.test(label);
      });
      const candidates = imageLinks.length ? imageLinks : links;
      const link = candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 40 && rect.height > 40;
      }) || candidates[0];
      if (link) return link.href;
      window.scrollBy(0, Math.max(700, window.innerHeight * 0.8));
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return null;
  });
}

async function pickViewerAsset(tabId) {
  return run(tabId, async () => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const images = [...document.querySelectorAll('img[src]')]
        .map((image) => {
          const rect = image.getBoundingClientRect();
          return {
            src: image.currentSrc || image.src,
            alt: image.alt || '',
            width: rect.width,
            height: rect.height,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
          };
        })
        .filter((image) => image.src.includes('googleusercontent.com')
          && !image.src.includes('/ogw/')
          && image.width > 300
          && image.height > 200
          && image.naturalWidth >= 600
          && image.naturalHeight >= 400)
        .sort((left, right) => (right.width * right.height) - (left.width * left.height));
      if (images.length) return { src: images[0].src, alt: images[0].alt };
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return null;
  });
}

async function uploadAsset(asset, album) {
  const response = await fetch(asset.src);
  if (!response.ok) throw new Error(`photo_fetch_${response.status}`);
  const blob = await response.blob();
  const key = `gphotos-${crypto.randomUUID()}`;
  const upload = await fetch(`${BRIDGE.baseUrl}/media`, {
    method: 'POST',
    headers: {
      ...headers(),
      'content-type': blob.type || 'image/jpeg',
      'x-media-key': key,
      'x-media-source': 'google-photos',
      'x-file-name': `${key}.jpg`,
    },
    body: blob,
  });
  const data = await upload.json();
  if (!upload.ok || !data.success) throw new Error(data.error || 'media_upload_failed');
  return { ...data.media, album, alt: asset.alt || '' };
}

async function syncGooglePhotos(payload) {
  const approved = new Set(payload.approvedAlbums || []);
  const excluded = new Set(payload.excludedAlbums || []);
  const tab = await openOrReuse('https://photos.google.com/albums');
  await sleep(2500);
  const albums = await collectAlbums(tab.id);
  const selected = albums.filter(({ name }) => approved.has(name) && !excluded.has(name));
  const imported = [];
  for (const album of selected) {
    await chrome.tabs.update(tab.id, { url: album.url, active: true });
    await waitForTab(tab.id);
    await sleep(1800);
    const photoUrl = await pickAlbumPhotoUrl(tab.id);
    if (!photoUrl) continue;
    await chrome.tabs.update(tab.id, { url: photoUrl, active: true });
    await waitForTab(tab.id);
    await sleep(900);
    const asset = await pickViewerAsset(tab.id);
    if (asset) imported.push(await uploadAsset(asset, album.name));
  }
  return { albums, imported };
}

function composerSnapshot() {
  const text = document.body.innerText || '';
  return {
    url: location.href,
    hasCreatePost: /Create post|יצירת פוסט|צור פוסט/i.test(text),
    hasPublish: /Publish|פרסום|פרסם/i.test(text),
    title: document.title,
  };
}

async function prepareMetaPost(payload) {
  const query = new URLSearchParams({ business_id: payload.businessId, asset_id: payload.pageId });
  const tab = await openOrReuse(`https://business.facebook.com/latest/composer/?${query}`);
  const configured = await run(tab.id, async (channel) => {
    const accessibleText = (element) => {
      const labelledBy = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent || '').join(' ');
      return [element.getAttribute('aria-label') || '', labelledBy, element.innerText || ''].join(' ');
    };
    const findDestinationCombo = () => [...document.querySelectorAll('[aria-label],[aria-haspopup],[aria-expanded],button,[role="button"],[role="combobox"]')]
      .find((element) => /Post to|פרסום ב/i.test(accessibleText(element)));
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const combo = findDestinationCombo();
      if (combo) {
        if (combo.getAttribute('aria-expanded') !== 'true') combo.click();
        return channel;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
  }, [payload.channel]);
  if (!configured) throw new Error('meta_destination_selector_missing');
  await sleep(600);
  const destinationReady = await run(tab.id, async (channel) => {
    const deadline = Date.now() + 10_000;
    let facebook;
    let instagram;
    while (Date.now() < deadline && (!facebook || !instagram)) {
      const choices = [...document.querySelectorAll('[aria-selected],[aria-checked],[aria-label],[tabindex],[role],button')];
      facebook = choices.find((element) => /איחוד הצלה סניף שוהם והמושבים/i.test(element.innerText || '') && !/group|קבוצה/i.test(element.innerText || ''));
      instagram = choices.find((element) => /ihud\.shoham/i.test(element.innerText || ''));
      if (!facebook || !instagram) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const selected = (element) => element?.getAttribute('aria-selected') === 'true' || element?.getAttribute('aria-checked') === 'true';
    if (channel === 'facebook' && instagram && selected(instagram)) instagram.click();
    if (channel === 'instagram' && facebook && selected(facebook)) facebook.click();
    const combo = [...document.querySelectorAll('[aria-label],[aria-haspopup],[aria-expanded],button,[role="button"],[role="combobox"]')]
      .find((element) => {
        const labelledBy = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent || '').join(' ');
        return /Post to|פרסום ב/i.test([element.getAttribute('aria-label') || '', labelledBy, element.innerText || ''].join(' '));
      });
    if (combo?.getAttribute('aria-expanded') === 'true') combo.click();
    return Boolean(channel === 'facebook' ? facebook : instagram);
  }, [payload.channel]);
  if (!destinationReady) throw new Error('meta_channel_option_missing');
  await sleep(500);
  const filled = await run(tab.id, (text) => {
    const editors = [...document.querySelectorAll('[contenteditable="true"],textarea,[role="combobox"]')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const label = element.getAttribute('aria-label') || '';
      return rect.width > 100 && rect.height > 10 && (/include text|write|טקסט|כתוב/i.test(label) || element.isContentEditable || element instanceof HTMLTextAreaElement);
    });
    const editor = editors.at(-1);
    if (!editor) return false;
    editor.focus();
    if (editor instanceof HTMLTextAreaElement) {
      editor.value = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    return true;
  }, [payload.text]);
  if (!filled) throw new Error('meta_composer_missing');
  if ((payload.media || []).length) {
    const response = await fetch(`${BRIDGE.baseUrl}/command-media/${payload.commandId}/0`, { headers: headers() });
    if (!response.ok) throw new Error('meta_media_fetch_failed');
    const blob = await response.blob();
    const uploaded = await run(tab.id, async (encoded, type, name) => {
      const input = document.querySelector('input[type="file"]');
      if (!input) return false;
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, [toBase64(await blob.arrayBuffer()), blob.type || 'image/jpeg', 'shoham-social.jpg']);
    if (!uploaded) throw new Error('meta_media_input_missing');
    await sleep(1800);
  }
  const snapshot = await run(tab.id, composerSnapshot);
  if (!payload.live) {
    await run(tab.id, () => {
      const target = [...document.querySelectorAll('button,[role="button"]')].find((element) => /^(Cancel|ביטול|בטל)$/i.test((element.innerText || element.getAttribute('aria-label') || '').trim()));
      target?.click();
      return Boolean(target);
    });
    return { prepared: true, dryRun: true, ...snapshot };
  }
  if (!payload.approvalFingerprint) throw new Error('exact_approval_required');
  const published = await run(tab.id, () => {
    const buttons = [...document.querySelectorAll('button,[role="button"]')];
    const target = buttons.find((element) => /^(Publish|פרסום|פרסם)$/i.test((element.innerText || element.getAttribute('aria-label') || '').trim()) && !element.disabled);
    if (!target) return false;
    target.click();
    return true;
  });
  if (!published) throw new Error('meta_publish_button_missing');
  await sleep(3500);
  return { published: true, url: tab.url || location.href, ...await run(tab.id, composerSnapshot) };
}

async function execute(command) {
  if (command.type === 'health') return { ok: true, version: chrome.runtime.getManifest().version, build: '2026-11-07.3' };
  if (command.type === 'syncGooglePhotos') return syncGooglePhotos(command.payload || {});
  if (command.type === 'prepareMetaPost' || command.type === 'publishMeta') return prepareMetaPost({ ...command.payload, commandId: command.id, live: command.type === 'publishMeta' });
  throw new Error(`unknown_command:${command.type}`);
}

async function poll() {
  try {
    const response = await fetch(`${BRIDGE.baseUrl}/next`, { headers: headers() });
    if (!response.ok) throw new Error(`bridge_${response.status}`);
    const { command } = await response.json();
    if (!command) return;
    try {
      const result = await execute(command);
      await fetch(`${BRIDGE.baseUrl}/complete/${command.id}`, {
        method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ success: true, result }),
      });
    } catch (error) {
      await fetch(`${BRIDGE.baseUrl}/complete/${command.id}`, {
        method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ success: false, error: String(error.message || error) }),
      });
    }
  } catch { /* The local worker may be offline while the Mac is asleep. */ }
}

chrome.alarms.create('poll', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(poll);
chrome.runtime.onStartup.addListener(poll);
chrome.runtime.onInstalled.addListener(poll);
poll();
