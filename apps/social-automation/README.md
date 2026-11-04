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

Live mode requires both `SOCIAL_DRY_RUN=false` and a verified `SOCIAL_META_PUBLISH_COMMAND`. The publisher must read JSON from stdin and return JSON containing a live `url`; otherwise the publication is not marked successful.
