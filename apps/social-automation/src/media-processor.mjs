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
  }
  return { ...media, originalPath: media.path, variants: outputs, processing: 'resize_only_no_crop' };
}
