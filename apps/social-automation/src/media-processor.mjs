import { access, copyFile, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} exited ${code}`)));
  });
}

function runOutput(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `${command} exited ${code}`)));
  });
}

export function instagramSafeCrop(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('invalid_media_dimensions');
  const ratio = width / height;
  if (ratio < 0.8) return { width, height: Math.max(1, Math.floor(width / 0.8)) };
  if (ratio > 1.91) return { width: Math.max(1, Math.floor(height * 1.91)), height };
  return { width, height };
}

async function dimensions(path) {
  const output = await runOutput('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path]);
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!width || !height) throw new Error('media_dimensions_unavailable');
  return { width, height };
}

export async function prepareMediaVariants(config, media, key = Date.now().toString()) {
  if (!media?.path) return media;
  await access(media.path);
  const targetDir = join(config.mediaDir, 'prepared');
  await mkdir(targetDir, { recursive: true, mode: 0o700 });
  const extension = extname(media.path) || '.jpg';
  const safeBase = basename(key).replace(/[^a-zA-Z0-9._-]/g, '_');
  const outputs = {
    facebook: join(targetDir, `${safeBase}-facebook${extension}`),
    instagram: join(targetDir, `${safeBase}-instagram${extension}`),
  };
  for (const [channel, path] of Object.entries(outputs)) {
    await copyFile(media.path, path);
    await run('/usr/bin/sips', ['-Z', channel === 'facebook' ? '1600' : '1350', path]);
    if (channel === 'instagram') {
      const current = await dimensions(path);
      const crop = instagramSafeCrop(current.width, current.height);
      if (crop.width !== current.width || crop.height !== current.height) {
        await run('/usr/bin/sips', ['--cropToHeightWidth', String(crop.height), String(crop.width), path]);
      }
    }
  }
  return { ...media, originalPath: media.path, variants: outputs, processing: 'resize_and_instagram_safe_crop' };
}
