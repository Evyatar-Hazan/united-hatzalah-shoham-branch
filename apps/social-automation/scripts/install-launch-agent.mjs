import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const groupId = option('--group-id');
const ownerId = option('--owner-id');
const projectRoot = resolve(option('--project-root') || new URL('../../..', import.meta.url).pathname);
if (!groupId || !ownerId) throw new Error('--group-id and --owner-id are required');

const appDir = join(homedir(), 'Library/Application Support/ShohamSocial');
const logsDir = join(appDir, 'logs');
const envPath = join(appDir, 'runtime.env');
const runnerPath = join(appDir, 'run-worker.sh');
const hookRunnerPath = join(appDir, 'run-hook.sh');
const plistPath = join(homedir(), 'Library/LaunchAgents/org.ihud-shoham.social-automation.plist');
await mkdir(logsDir, { recursive: true, mode: 0o700 });
await mkdir(dirname(plistPath), { recursive: true });

const env = [
  `export SOCIAL_DATA_DIR=${JSON.stringify(appDir)}`,
  `export SOCIAL_GROUP_ID=${JSON.stringify(groupId)}`,
  `export SOCIAL_OWNER_ID=${JSON.stringify(ownerId)}`,
  'export SOCIAL_HERMES_DB="$HOME/.hermes/state.db"',
  'export SOCIAL_HERMES_COMMAND="$HOME/.local/bin/hermes"',
  'export SOCIAL_BRIDGE_URL="http://127.0.0.1:3021"',
  'export SOCIAL_DRY_RUN="true"',
  'export SOCIAL_WHATSAPP_DRY_RUN="true"',
  'export SOCIAL_META_DRY_RUN="true"',
  `export SOCIAL_BROWSER_PROFILE_DIR=${JSON.stringify(join(appDir, 'browser-profile'))}`,
  'export SOCIAL_META_BUSINESS_ID="1529945614496132"',
  'export SOCIAL_META_PAGE_ID="113365775203359"',
  'export SOCIAL_POLL_INTERVAL_MS="5000"',
].join('\n');
await writeFile(envPath, `${env}\n`, { mode: 0o600 });
await chmod(envPath, 0o600);

await writeFile(runnerPath, `#!/bin/zsh\nset -a\nsource ${JSON.stringify(envPath)}\nset +a\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(projectRoot, 'apps/social-automation/src/worker.mjs'))}\n`, { mode: 0o700 });
await chmod(runnerPath, 0o700);

await writeFile(hookRunnerPath, `#!/bin/zsh\nset -a\nsource ${JSON.stringify(envPath)}\nset +a\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(projectRoot, 'apps/social-automation/scripts/hermes-ingest-hook.mjs'))}\n`, { mode: 0o700 });
await chmod(hookRunnerPath, 0o700);

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>org.ihud-shoham.social-automation</string>
  <key>ProgramArguments</key><array><string>${runnerPath}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>WorkingDirectory</key><string>${projectRoot}</string>
  <key>StandardOutPath</key><string>${join(logsDir, 'worker.log')}</string>
  <key>StandardErrorPath</key><string>${join(logsDir, 'worker.error.log')}</string>
</dict></plist>\n`;
await writeFile(plistPath, plist);

const domain = `gui/${process.getuid()}`;
spawnSync('launchctl', ['bootout', domain, plistPath], { stdio: 'ignore' });
const loaded = spawnSync('launchctl', ['bootstrap', domain, plistPath], { encoding: 'utf8' });
if (loaded.status !== 0) throw new Error(loaded.stderr || 'launchctl bootstrap failed');
console.log(JSON.stringify({ installed: true, label: 'org.ihud-shoham.social-automation', dryRun: true, plistPath, hookRunnerPath }, null, 2));
