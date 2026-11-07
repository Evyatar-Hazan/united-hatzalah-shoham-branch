# Shoham Social Automation

Local, checkpointed workflow for the WhatsApp approval group and organic Facebook/Instagram publishing.

## Safety defaults

- Starts in `SOCIAL_DRY_RUN=true`; no WhatsApp or Meta write is performed.
- Every inbound message and job is idempotent.
- Approval is accepted only as a direct reply to the active draft.
- A changed draft gets a new immutable version and requires fresh approval.
- Each channel has a separate publication ledger, so a successful channel is never posted twice.
- Secrets and WhatsApp message bodies are stored only in the local application database, never in the repository.

## Commands

```bash
npm run social -- init
npm run social -- status
echo '{"id":"m1","chatId":"...@g.us","senderId":"...","text":"טקסט לפוסט"}' | npm run social -- ingest
npm run social -- tick
npm run social:test
```

Hermes calls `ingest` for each message in the configured group. The launch agent runs `worker` while the Mac is logged in. On restart, pending jobs and outbox messages resume from SQLite.

Live mode requires `SOCIAL_DRY_RUN=false`, `SOCIAL_META_DRY_RUN=false`, an exact approved draft fingerprint, and either the connected local Chrome bridge or a verified `SOCIAL_META_PUBLISH_COMMAND`. A publication is never marked successful without a verified live URL.

## Existing Shoham Chrome profile

The live browser adapter is a local unpacked Chrome extension installed only in the `סניף שוהם והמושבים` profile. It polls a token-protected loopback bridge on `127.0.0.1`; no password or browser cookie is copied to the repository, database, or vault.

```bash
npm run browser:extension:prepare --workspace @united-hatzalah-shoham-branch/social-automation
npm run browser:extension:check --workspace @united-hatzalah-shoham-branch/social-automation
npm run browser:dry-run --workspace @united-hatzalah-shoham-branch/social-automation
```

The generated extension lives under the private application data directory. Chrome requires a one-time human confirmation to load it as an unpacked extension. The automation always prepares and cancels dry-run composers; the Publish button is reachable only from an approved immutable draft fingerprint.

## Legacy dedicated browser profile

The Meta and Google sessions live in a private Chrome profile under the local application directory. Passwords and cookies are never copied into the repository, SQLite database, or vault.

```bash
npm run browser:login --workspace @united-hatzalah-shoham-branch/social-automation
npm run browser:verify --workspace @united-hatzalah-shoham-branch/social-automation
```

The login command opens ordinary Chrome without Playwright or remote-debugging flags, so Google receives a normal browser login. Log in once and close the entire browser window. Verification then reopens the same private profile and attaches locally through Chrome DevTools; it reports only whether each session is present and does not publish or download media.
