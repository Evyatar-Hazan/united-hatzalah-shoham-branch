import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const require = createRequire(import.meta.url);
const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.TS_NODE_PROJECT = fileURLToPath(
  new URL('../apps/server/tsconfig.json', import.meta.url)
);
require('ts-node/register');

const { AuthTokenService } = require('../apps/server/src/services/AuthTokenService.ts');
const { authMiddleware } = require('../apps/server/src/middleware/auth.ts');
const { AuthService } = require('../apps/server/src/services/AuthService.ts');
const { DonationService } = require('../apps/server/src/services/DonationService.ts');
const prisma = require('../apps/server/src/db/prisma.ts').default;

const GOOGLE_CLIENT_ID = 'express-auth-test.apps.googleusercontent.com';
const SESSION_SECRET = 'express-test-session-secret-with-at-least-32-characters';
const SESSION_ISSUER = 'united-hatzalah-shoham-branch';
const SESSION_AUDIENCE = 'admin-api';
const ADMIN = {
  id: 'express-admin-1',
  email: 'admin@example.test',
  name: 'Express Admin',
  picture: null,
  isActive: true,
  lastLogin: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const originalFetch = globalThis.fetch;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalSessionSecret = process.env.SESSION_SECRET;

process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
process.env.SESSION_SECRET = SESSION_SECRET;

const googleKeys = await generateKeyPair('RS256');
const attackerKeys = await generateKeyPair('RS256');
const googleJwk = await exportJWK(googleKeys.publicKey);
Object.assign(googleJwk, { kid: 'google-test-key', alg: 'RS256', use: 'sig' });

globalThis.fetch = async (input) => {
  assert.equal(String(input), 'https://www.googleapis.com/oauth2/v3/certs');
  return new Response(JSON.stringify({ keys: [googleJwk] }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
};

after(() => {
  globalThis.fetch = originalFetch;

  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;

  if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;

  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSessionSecret;
});

const signGoogleToken = ({
  key = googleKeys.privateKey,
  issuer = 'https://accounts.google.com',
  audience = GOOGLE_CLIENT_ID,
  expires = '5m',
} = {}) =>
  new SignJWT({
    email: ADMIN.email,
    email_verified: true,
    name: ADMIN.name,
    picture: 'https://example.test/admin.png',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'google-test-key' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('google-user-1')
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);

const signSession = ({
  secret = SESSION_SECRET,
  issuer = SESSION_ISSUER,
  audience = SESSION_AUDIENCE,
  expires = '5m',
} = {}) =>
  new SignJWT({ email: ADMIN.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(ADMIN.id)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(secret));

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('Express Google verifier accepts a valid token from the mocked JWKS', async () => {
  const identity = await AuthTokenService.verifyGoogleIdToken(await signGoogleToken());

  assert.deepEqual(identity, {
    email: ADMIN.email,
    name: ADMIN.name,
    picture: 'https://example.test/admin.png',
  });
});

test('Express Google verifier rejects invalid signature, issuer, audience, and expiry', async () => {
  const invalidTokens = [
    await signGoogleToken({ key: attackerKeys.privateKey }),
    await signGoogleToken({ issuer: 'https://attacker.example.test' }),
    await signGoogleToken({ audience: 'wrong-client.apps.googleusercontent.com' }),
    await signGoogleToken({ expires: '0s' }),
  ];

  for (const token of invalidTokens) {
    await assert.rejects(AuthTokenService.verifyGoogleIdToken(token));
  }
});

test('Express session verification rejects the legacy email bearer and invalid signed claims', async () => {
  const invalidTokens = [
    ADMIN.email,
    await signSession({ secret: 'different-session-secret-with-at-least-32-characters' }),
    await signSession({ issuer: 'wrong-session-issuer' }),
    await signSession({ audience: 'wrong-session-audience' }),
    await signSession({ expires: '0s' }),
  ];

  for (const token of invalidTokens) {
    assert.equal(await AuthTokenService.verifyAdminSession(token), null);
  }

  assert.deepEqual(await AuthTokenService.verifyAdminSession(await signSession()), {
    adminId: ADMIN.id,
    email: ADMIN.email,
  });
});

test('Express middleware rechecks active admin state on every request', async () => {
  const originalGetAdminById = AuthService.getAdminById;
  const token = await AuthTokenService.issueAdminSession(ADMIN);

  try {
    AuthService.getAdminById = async () => ({
      success: true,
      data: { ...ADMIN, isActive: false },
      timestamp: new Date(),
    });

    const request = { headers: { authorization: `Bearer ${token}` } };
    const response = createResponse();
    let nextCalled = false;

    await authMiddleware(request, response, () => {
      nextCalled = true;
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.payload.success, false);
    assert.equal(nextCalled, false);
  } finally {
    AuthService.getAdminById = originalGetAdminById;
  }
});

test('Express middleware accepts a valid session for an active matching admin', async () => {
  const originalGetAdminById = AuthService.getAdminById;
  const token = await AuthTokenService.issueAdminSession(ADMIN);

  try {
    AuthService.getAdminById = async () => ({
      success: true,
      data: ADMIN,
      timestamp: new Date(),
    });

    const request = { headers: { authorization: `Bearer ${token}` } };
    const response = createResponse();
    let nextCalled = false;

    await authMiddleware(request, response, () => {
      nextCalled = true;
    });

    assert.equal(response.statusCode, 200);
    assert.equal(nextCalled, true);
    assert.equal(request.user.id, ADMIN.id);
    assert.equal(request.user.isAdmin, true);
  } finally {
    AuthService.getAdminById = originalGetAdminById;
  }
});

test('Express donation creation always persists a pending non-payment request', async () => {
  const originalCreate = prisma.donation.create;
  let persistedData;

  try {
    prisma.donation.create = async ({ data }) => {
      persistedData = data;
      return {
        id: 'donation-request-1',
        ...data,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
    };

    const result = await DonationService.createDonation({
      amount: 250,
      donorName: 'Anonymous',
      donorEmail: 'donor@example.test',
      message: 'Donation request',
    });

    assert.equal(result.success, true);
    assert.equal(result.data.status, 'pending');
    assert.equal(persistedData.status, 'pending');
    assert.match(result.message, /No payment was processed/);
  } finally {
    prisma.donation.create = originalCreate;
  }
});
