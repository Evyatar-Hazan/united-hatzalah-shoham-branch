import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWhatsAppSenderIds } from '../src/whatsapp-identity.mjs';

test('resolves a group LID to its verified phone JID from the Hermes roster', async () => {
  const ids = await resolveWhatsAppSenderIds({
    bridgeUrl: 'http://bridge.local',
    chatId: 'group@g.us',
    senderId: '999999999999@lid',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ participantDetails: [{ id: '999999999999@lid', phoneNumber: '972500000000@s.whatsapp.net' }] }),
    }),
  });
  assert.deepEqual(ids, ['999999999999@lid', '972500000000@s.whatsapp.net']);
});

test('fails closed to the original sender id when the Hermes roster is unavailable', async () => {
  const ids = await resolveWhatsAppSenderIds({
    bridgeUrl: 'http://bridge.local',
    chatId: 'group@g.us',
    senderId: '999999999999@lid',
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.deepEqual(ids, ['999999999999@lid']);
});
