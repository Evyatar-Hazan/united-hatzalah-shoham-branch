import { createServer } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

function tokenMatches(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function ensureBridgeToken(config) {
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  if (!existsSync(config.browserBridgeTokenPath)) {
    writeFileSync(config.browserBridgeTokenPath, `${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  }
  chmodSync(config.browserBridgeTokenPath, 0o600);
  return readFileSync(config.browserBridgeTokenPath, 'utf8').trim();
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

async function readBody(req, limit = MAX_MEDIA_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function startBrowserBridge(config) {
  const token = ensureBridgeToken(config);
  const pending = [];
  const inflight = new Map();
  let lastSeenAt = null;

  function requestCommand(type, payload = {}, { timeoutMs = 90_000 } = {}) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        const queued = pending.findIndex((item) => item.id === id);
        if (queued >= 0) pending.splice(queued, 1);
        inflight.delete(id);
        reject(new Error('browser_extension_timeout'));
      }, timeoutMs);
      timer.unref?.();
      pending.push({
        id,
        type,
        payload,
        createdAt: new Date().toISOString(),
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
        toJSON() { return { id, type, payload, createdAt: this.createdAt }; },
      });
    });
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${config.browserBridgePort}`);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type,x-browser-bridge-token,x-media-key,x-media-source,x-file-name',
        });
        res.end();
        return;
      }
      const suppliedToken = req.headers['x-browser-bridge-token'] || url.searchParams.get('token');
      if (!tokenMatches(suppliedToken, token)) return json(res, 401, { success: false, error: 'unauthorized' });
      lastSeenAt = new Date().toISOString();

      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { success: true, connected: true, lastSeenAt, pending: pending.length, inflight: inflight.size });
      }
      if (req.method === 'GET' && url.pathname === '/next') {
        const command = pending.shift() || null;
        if (command) inflight.set(command.id, command);
        return json(res, 200, { success: true, command });
      }
      if (req.method === 'POST' && url.pathname.startsWith('/request/')) {
        const type = url.pathname.split('/').pop();
        const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
        const result = await requestCommand(type, payload, { timeoutMs: 180_000 });
        return json(res, 200, { success: true, result });
      }
      if (req.method === 'POST' && url.pathname.startsWith('/complete/')) {
        const id = url.pathname.split('/').pop();
        const command = inflight.get(id);
        if (!command) return json(res, 404, { success: false, error: 'command_not_found' });
        const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
        inflight.delete(id);
        if (payload.success) command.resolve(payload.result || {});
        else command.reject(new Error(payload.error || 'browser_command_failed'));
        return json(res, 200, { success: true });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/command-media/')) {
        const [, , id, rawIndex] = url.pathname.split('/');
        const command = inflight.get(id);
        const media = command?.payload?.media || [];
        const item = media[Number(rawIndex)];
        const requestedPath = item?.uploadPath || item?.variants?.[command?.payload?.channel] || item?.path;
        if (!requestedPath) return json(res, 404, { success: false, error: 'media_not_found' });
        const allowedRoot = `${resolve(config.mediaDir)}/`;
        const fullPath = resolve(requestedPath);
        if (!fullPath.startsWith(allowedRoot)) return json(res, 403, { success: false, error: 'media_path_not_allowed' });
        const body = readFileSync(fullPath);
        const extension = extname(fullPath).toLowerCase();
        const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
        res.writeHead(200, { 'content-type': contentType, 'content-length': body.length, 'access-control-allow-origin': '*' });
        res.end(body);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/media') {
        const mediaKey = String(req.headers['x-media-key'] || randomUUID()).replace(/[^a-zA-Z0-9._-]/g, '_');
        const source = String(req.headers['x-media-source'] || 'chrome');
        const fileName = basename(String(req.headers['x-file-name'] || `${mediaKey}.jpg`)).replace(/[^a-zA-Z0-9._-]/g, '_');
        const body = await readBody(req);
        if (!String(req.headers['content-type'] || '').startsWith('image/')) return json(res, 415, { success: false, error: 'image_required' });
        const path = join(config.mediaDir, `${mediaKey}-${fileName}`);
        writeFileSync(path, body, { mode: 0o600 });
        return json(res, 200, { success: true, media: { key: mediaKey, source, path, bytes: body.length } });
      }
      return json(res, 404, { success: false, error: 'not_found' });
    } catch (error) {
      return json(res, 500, { success: false, error: String(error.message || error) });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.browserBridgePort, '127.0.0.1', resolve);
  });
  const actualPort = server.address().port;

  return {
    token,
    port: actualPort,
    get lastSeenAt() { return lastSeenAt; },
    request: requestCommand,
    async close() {
      for (const command of [...pending, ...inflight.values()]) command.reject(new Error('browser_bridge_closed'));
      pending.length = 0;
      inflight.clear();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
