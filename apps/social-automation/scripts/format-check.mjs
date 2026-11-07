import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}

const targets = (await files(new URL('../src', import.meta.url))).filter((path) => path.endsWith('.mjs'));
for (const path of targets) {
  const text = await readFile(path, 'utf8');
  if (!text.endsWith('\n')) throw new Error(`${path} must end with a newline`);
  if (/\t/.test(text)) throw new Error(`${path} contains tabs`);
}
