import { BRIDGE } from './config.js';

const headers = () => ({ 'x-browser-bridge-token': BRIDGE.token });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function profileCapability() {
  const profile = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
  return String(profile?.email || '').toLowerCase() === 'ihud.shoham@gmail.com' ? 'google,meta' : 'none';
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

async function openFreshComposer(url, commandId) {
  const query = new URL(url);
  query.searchParams.set('shoham_automation', '1');
  query.searchParams.set('command_id', commandId);
  const tab = await chrome.tabs.create({ url: query.toString(), active: true });
  return waitForTab(tab.id);
}

async function run(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func, args, world: 'MAIN' });
  const mainFrameResult = results.find(({ frameId }) => frameId === 0 && results.length > 1)?.result;
  if (mainFrameResult !== undefined && mainFrameResult !== null) return mainFrameResult;
  const meaningful = results.find(({ result }) => {
    if (result === true || (typeof result === 'string' && result)) return true;
    if (Array.isArray(result)) return result.length > 0;
    if (result && typeof result === 'object') return result.hasCreatePost
      || result.hasPublish
      || result.src
      || result.prepared
      || result.published
      || Object.hasOwn(result, 'mediaCount')
      || Object.hasOwn(result, 'facebook');
    return false;
  });
  return meaningful?.result ?? results.find(({ result }) => result !== undefined && result !== null)?.result;
}

function findFileInputNode(node) {
  const attributes = Object.fromEntries(Array.from({ length: (node.attributes || []).length / 2 }, (_, index) => [
    node.attributes[index * 2], node.attributes[index * 2 + 1],
  ]));
  if (node.nodeName === 'INPUT' && attributes.type === 'file') return node;
  for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
    const found = findFileInputNode(child);
    if (found) return found;
  }
  if (node.contentDocument) return findFileInputNode(node.contentDocument);
  return null;
}

function nodeAttributes(node) {
  return Object.fromEntries(Array.from({ length: (node.attributes || []).length / 2 }, (_, index) => [
    node.attributes[index * 2], node.attributes[index * 2 + 1],
  ]));
}

function nodeText(node) {
  const attributes = nodeAttributes(node);
  return [node.nodeValue || '', attributes['aria-label'] || '', ...(node.children || []).map(nodeText)].join(' ');
}

function findUploadButtonNode(node) {
  const attributes = nodeAttributes(node);
  const buttonLike = node.nodeName === 'BUTTON' || attributes.role === 'button';
  if (buttonLike && /Add photo\/video|הוספת תמונה|הוסף תמונה/i.test(nodeText(node))) return node;
  for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
    const found = findUploadButtonNode(child);
    if (found) return found;
  }
  if (node.contentDocument) return findUploadButtonNode(node.contentDocument);
  return null;
}

async function debuggerClickPublish(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const { result } = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', {
      expression: `(() => {
        const candidates = [...document.querySelectorAll('button,[role="button"]')];
        const button = candidates.find((element) => {
          const label = (element.innerText || element.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
          return /^(Publish|פרסום|פרסם)$/i.test(label) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
        });
        if (!button) return 'missing';
        button.click();
        return 'clicked';
      })()`,
      userGesture: true,
      returnByValue: true,
    });
    if (result.value !== 'clicked') throw new Error('meta_publish_button_missing');
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function debuggerFillComposerText(tabId, text) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const { result } = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', {
      expression: `(() => {
        const editors = [...document.querySelectorAll('[contenteditable="true"],textarea,[role="combobox"]')]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const label = element.getAttribute('aria-label') || '';
            return rect.width > 100 && rect.height > 10
              && (/include text|write|טקסט|כתוב/i.test(label)
                || element.isContentEditable
                || element instanceof HTMLTextAreaElement);
          });
        const editor = editors.at(-1);
        if (!editor) return 'missing';
        editor.focus();
        if (editor instanceof HTMLTextAreaElement) editor.select();
        else {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return 'focused';
      })()`,
      userGesture: true,
      returnByValue: true,
    });
    if (result.value !== 'focused') throw new Error('meta_composer_missing');
    await chrome.debugger.sendCommand(target, 'Input.insertText', { text });
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function debuggerFileUpload(tabId, filePath) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  let timeout;
  let listener;
  try {
    await chrome.debugger.sendCommand(target, 'DOM.enable');
    let { root } = await chrome.debugger.sendCommand(target, 'DOM.getDocument', { depth: -1, pierce: true });
    let input = findFileInputNode(root);
    if (!input) {
      const button = findUploadButtonNode(root);
      if (!button) throw new Error('meta_media_button_backend_missing');
      await chrome.debugger.sendCommand(target, 'Page.enable');
      await chrome.debugger.sendCommand(target, 'Page.setInterceptFileChooserDialog', { enabled: true });
      const chooser = new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('meta_file_chooser_missing')), 5_000);
        listener = (source, method, params) => {
          if (source.tabId === tabId && method === 'Page.fileChooserOpened') resolve(params);
        };
        chrome.debugger.onEvent.addListener(listener);
      });
      const { object } = await chrome.debugger.sendCommand(target, 'DOM.resolveNode', { backendNodeId: button.backendNodeId });
      await chrome.debugger.sendCommand(target, 'Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: 'function() { this.click(); }',
        userGesture: true,
      });
      const opened = await chooser;
      if (opened.backendNodeId) {
        await Promise.race([
          chrome.debugger.sendCommand(target, 'DOM.setFileInputFiles', { files: [filePath], backendNodeId: opened.backendNodeId }),
          sleep(2_000),
        ]);
        return;
      }
      ({ root } = await chrome.debugger.sendCommand(target, 'DOM.getDocument', { depth: -1, pierce: true }));
      input = findFileInputNode(root);
    }
    if (!input) throw new Error('meta_file_input_backend_missing');
    await chrome.debugger.sendCommand(target, 'DOM.setFileInputFiles', { files: [filePath], backendNodeId: input.backendNodeId });
  } finally {
    clearTimeout(timeout);
    if (listener) chrome.debugger.onEvent.removeListener(listener);
    await chrome.debugger.sendCommand(target, 'Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => {});
    await chrome.debugger.detach(target).catch(() => {});
  }
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

function verificationNeedle(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
}

async function findFacebookPostUrl(text) {
  const needle = verificationNeedle(text);
  if (!needle) return null;
  const tab = await openOrReuse('https://www.facebook.com/ihud.shoham/');
  for (let step = 0; step < 6; step += 1) {
    const found = await run(tab.id, (expected) => {
      const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const matches = [...document.querySelectorAll('div,span')]
        .filter((element) => normalized(element.innerText).includes(expected));
      for (const match of matches) {
        let container = match;
        for (let depth = 0; depth < 10 && container; depth += 1, container = container.parentElement) {
          const link = [...container.querySelectorAll('a[href]')]
            .find((candidate) => /\/posts\/\d+\/?(?:[?#]|$)/.test(candidate.href));
          if (link) {
            const url = new URL(link.href);
            return `${url.origin}${url.pathname}`;
          }
          const boost = [...container.querySelectorAll('a[href*="target_id="]')][0];
          if (boost) {
            const targetId = new URL(boost.href).searchParams.get('target_id');
            if (targetId) return `https://www.facebook.com/61553182522441/posts/${targetId}/`;
          }
        }
      }
      return null;
    }, [needle]);
    if (found) return found;
    await run(tab.id, () => { window.scrollBy(0, Math.max(700, window.innerHeight * 0.8)); return true; });
    await sleep(900);
  }
  return null;
}

async function findInstagramPostUrl(text) {
  const needle = verificationNeedle(text);
  if (!needle) return null;
  const tab = await openOrReuse('https://www.instagram.com/ihud.shoham/');
  await sleep(900);
  const candidates = await run(tab.id, () => [...new Set([...document.querySelectorAll('a[href*="/p/"]')]
    .map((link) => link.href))].slice(0, 6));
  for (const candidate of candidates || []) {
    await chrome.tabs.update(tab.id, { url: candidate, active: true });
    await waitForTab(tab.id);
    await sleep(700);
    const matches = await run(tab.id, (expected) => String(document.body.innerText || '')
      .replace(/\s+/g, ' ').includes(expected), [needle]);
    if (matches) {
      const url = new URL(candidate);
      return `${url.origin}${url.pathname}`;
    }
  }
  return null;
}

async function verifiedPublishedUrl(payload) {
  return payload.channel === 'facebook'
    ? findFacebookPostUrl(payload.text)
    : findInstagramPostUrl(payload.text);
}

function externalIdFromUrl(channel, url) {
  const match = channel === 'facebook' ? String(url).match(/\/posts\/(\d+)/) : String(url).match(/\/p\/([^/]+)/);
  return match?.[1] || null;
}

async function prepareMetaPost(payload) {
  if (!String(payload.text || '').trim()) throw new Error('meta_text_required');
  if ((payload.media || []).length !== 1) throw new Error('meta_exactly_one_media_required');
  if (!['facebook', 'instagram'].includes(payload.channel)) throw new Error('meta_channel_invalid');
  if (payload.live && payload.verifyExisting) {
    const existingUrl = await verifiedPublishedUrl(payload);
    if (existingUrl) return { published: true, recovered: true, id: externalIdFromUrl(payload.channel, existingUrl), url: existingUrl };
  }
  const query = new URLSearchParams({ business_id: payload.businessId, asset_id: payload.pageId });
  const tab = await openFreshComposer(`https://business.facebook.com/latest/composer/?${query}`, payload.commandId);
  const destination = await run(tab.id, async (channel) => {
    const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim();
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
        const optionDeadline = Date.now() + 10_000;
        while (Date.now() < optionDeadline) {
          const choices = [...document.querySelectorAll('[aria-selected]')];
          const facebook = choices.find((element) => normalized(element.innerText) === 'איחוד הצלה סניף שוהם והמושבים');
          const instagram = choices.find((element) => normalized(element.innerText) === 'ihud.shoham');
          if (facebook && instagram) {
            const selected = (element) => element.getAttribute('aria-selected') === 'true';
            const wanted = channel === 'facebook' ? facebook : instagram;
            const unwanted = channel === 'facebook' ? instagram : facebook;
            if (!selected(wanted)) wanted.click();
            if (selected(unwanted)) unwanted.click();
            await new Promise((resolve) => setTimeout(resolve, 500));
            const result = {
              facebook: selected(facebook),
              instagram: selected(instagram),
            };
            if (combo.getAttribute('aria-expanded') === 'true') combo.click();
            return result;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return null;
  }, [payload.channel]);
  if (!destination) throw new Error('meta_destination_selector_missing');
  if (destination.facebook !== (payload.channel === 'facebook')
    || destination.instagram !== (payload.channel === 'instagram')) throw new Error('meta_channel_selection_failed');
  await sleep(500);
  await debuggerFillComposerText(tab.id, payload.text);
  const response = await fetch(`${BRIDGE.baseUrl}/command-media/${payload.commandId}/0`, { headers: headers() });
  if (!response.ok) throw new Error('meta_media_fetch_failed');
  await response.arrayBuffer();
  const item = payload.media[0];
  const filePath = item.uploadPath || item.variants?.[payload.channel] || item.path;
  if (!filePath) throw new Error('meta_media_path_missing');
  await debuggerFileUpload(tab.id, filePath);
  const preflight = await run(tab.id, async ({ channel, expectedText }) => {
    const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const accessibleText = (element) => {
      const labelledBy = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent || '').join(' ');
      return [element.getAttribute('aria-label') || '', labelledBy, element.innerText || ''].join(' ');
    };
    const deadline = Date.now() + 15_000;
    let last = { mediaCount: 0, textMatches: false, channelMatches: false, publishReady: false };
    while (Date.now() < deadline) {
      const removeButtons = [...document.querySelectorAll('button,[role="button"]')]
        .filter((element) => /(Remove photo|הסרת תמונה|הסר תמונה)/i
          .test(normalized(`${element.innerText || ''} ${element.getAttribute('aria-label') || ''}`)));
      const editor = [...document.querySelectorAll('[contenteditable="true"],textarea,[role="combobox"]')]
        .find((element) => /include text|write|טקסט|כתוב/i.test(element.getAttribute('aria-label') || ''));
      const combo = [...document.querySelectorAll('[role="combobox"][aria-expanded]')]
        .find((element) => /Post to|פרסום ב/i.test(accessibleText(element)));
      if (combo?.getAttribute('aria-expanded') !== 'true') {
        combo.click();
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const choices = [...document.querySelectorAll('[aria-selected]')];
      const facebook = choices.find((element) => normalized(element.innerText) === 'איחוד הצלה סניף שוהם והמושבים');
      const instagram = choices.find((element) => normalized(element.innerText) === 'ihud.shoham');
      const selected = (element) => element?.getAttribute('aria-selected') === 'true';
      const textMatches = normalized(editor?.value || editor?.innerText || editor?.textContent) === normalized(expectedText);
      const channelMatches = selected(facebook) === (channel === 'facebook')
        && selected(instagram) === (channel === 'instagram');
      const publish = [...document.querySelectorAll('button,[role="button"]')]
        .find((element) => /^(Publish|פרסום|פרסם)$/i.test(normalized(element.innerText || element.getAttribute('aria-label'))));
      const publishReady = Boolean(publish && !publish.disabled && publish.getAttribute('aria-disabled') !== 'true');
      last = { mediaCount: removeButtons.length, textMatches, channelMatches, publishReady };
      if (removeButtons.length === 1 && textMatches && channelMatches && publishReady) {
        if (combo?.getAttribute('aria-expanded') === 'true') combo.click();
        return last;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return last;
  }, [{ channel: payload.channel, expectedText: payload.text }]);
  if (preflight?.mediaCount !== 1) throw new Error(`meta_media_count_preflight_failed:${JSON.stringify(preflight)}`);
  if (!preflight.textMatches) throw new Error(`meta_text_preflight_failed:${JSON.stringify(preflight)}`);
  if (!preflight.channelMatches) throw new Error(`meta_channel_preflight_failed:${JSON.stringify(preflight)}`);
  if (!preflight.publishReady) throw new Error(`meta_publish_preflight_failed:${JSON.stringify(preflight)}`);
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
  await debuggerClickPublish(tab.id);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(attempt ? 5_000 : 3_500);
    const url = await verifiedPublishedUrl(payload);
    if (url) return { published: true, id: externalIdFromUrl(payload.channel, url), url };
  }
  throw new Error('meta_public_url_not_verified');
}

async function execute(command) {
  if (command.type === 'health') return { ok: true, version: chrome.runtime.getManifest().version, build: '2026-11-16.14' };
  if (command.type === 'syncGooglePhotos') return syncGooglePhotos(command.payload || {});
  if (command.type === 'prepareMetaPost' || command.type === 'publishMeta') return prepareMetaPost({ ...command.payload, commandId: command.id, live: command.type === 'publishMeta' });
  throw new Error(`unknown_command:${command.type}`);
}

async function poll() {
  try {
    const capability = await profileCapability();
    const response = await fetch(`${BRIDGE.baseUrl}/next?capability=${encodeURIComponent(capability)}`, { headers: headers() });
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
