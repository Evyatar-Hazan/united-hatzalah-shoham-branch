import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const expandHome = (value) => value?.replace(/^~(?=$|\/)/, homedir());

export function loadConfig(env = process.env) {
  const dataDir = resolve(expandHome(env.SOCIAL_DATA_DIR || join(homedir(), 'Library/Application Support/ShohamSocial')));
  return {
    dataDir,
    dbPath: join(dataDir, 'social.db'),
    mediaDir: join(dataDir, 'media'),
    browserProfileDir: resolve(expandHome(env.SOCIAL_BROWSER_PROFILE_DIR || join(dataDir, 'browser-profile'))),
    chromeExecutable: expandHome(env.SOCIAL_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    chromeDebugPort: Number(env.SOCIAL_CHROME_DEBUG_PORT || 9237),
    metaBusinessId: env.SOCIAL_META_BUSINESS_ID || '',
    metaPageId: env.SOCIAL_META_PAGE_ID || '',
    groupId: env.SOCIAL_GROUP_ID || '',
    ownerId: env.SOCIAL_OWNER_ID || '',
    hermesDb: resolve(expandHome(env.SOCIAL_HERMES_DB || join(homedir(), '.hermes/state.db'))),
    hermesCommand: resolve(expandHome(env.SOCIAL_HERMES_COMMAND || join(homedir(), '.local/bin/hermes'))),
    bridgeUrl: env.SOCIAL_BRIDGE_URL || 'http://127.0.0.1:3021',
    metaPublishCommand: env.SOCIAL_META_PUBLISH_COMMAND || '',
    dryRun: env.SOCIAL_DRY_RUN !== 'false',
    whatsappDryRun: env.SOCIAL_WHATSAPP_DRY_RUN ? env.SOCIAL_WHATSAPP_DRY_RUN !== 'false' : env.SOCIAL_DRY_RUN !== 'false',
    metaDryRun: env.SOCIAL_META_DRY_RUN ? env.SOCIAL_META_DRY_RUN !== 'false' : env.SOCIAL_DRY_RUN !== 'false',
    pollIntervalMs: Math.max(1000, Number(env.SOCIAL_POLL_INTERVAL_MS || 5000)),
    signature: 'נכתב על ידי ג׳רוויס הבוט של אביתר',
    timezone: 'Asia/Jerusalem',
  };
}
