import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import { onRequest } from '../functions/api/[[path]].js';

const SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
const ADMIN = {
  id: 'admin-1',
  email: 'admin@example.test',
  name: 'Test Admin',
  picture: null,
  isActive: 1,
};

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    if (this.sql.includes('FROM admins WHERE id = ? AND lower(email) = ? AND isActive = 1')) {
      const [id, email] = this.params;
      return this.db.admin.isActive && id === this.db.admin.id && email === this.db.admin.email
        ? this.db.admin
        : null;
    }

    if (this.sql.startsWith('SELECT * FROM donations WHERE id = ?')) {
      return this.db.donations.find((donation) => donation.id === this.params[0]) || null;
    }

    if (this.sql.includes('COUNT(*) as totalRequests')) {
      const requests = this.db.donations.filter((donation) => donation.status !== 'failed');
      return {
        totalRequests: requests.length,
        requestedAmount: requests.reduce((sum, donation) => sum + Number(donation.amount), 0),
      };
    }

    return null;
  }

  async all() {
    if (this.sql.includes('FROM admins WHERE isActive = 1')) {
      return { results: this.db.admin.isActive ? [this.db.admin] : [] };
    }
    return { results: [] };
  }

  async run() {
    if (this.sql.startsWith('INSERT INTO donations')) {
      const columns = this.sql
        .slice(this.sql.indexOf('(') + 1, this.sql.indexOf(')'))
        .split(',')
        .map((column) => column.trim());
      this.db.donations.push(Object.fromEntries(columns.map((column, index) => [column, this.params[index]])));
    }
    return { success: true };
  }
}

class FakeDb {
  constructor() {
    this.admin = { ...ADMIN };
    this.donations = [];
  }

  async exec() {}

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

const callApi = (path, { method = 'GET', token, body, env = {} } = {}) => {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (body) headers.set('content-type', 'application/json');

  return onRequest({
    request: new Request(`https://example.test/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: { DB: env.DB || new FakeDb(), SESSION_SECRET: env.SESSION_SECRET, ...env },
    params: { path: path.split('/').filter(Boolean) },
  });
};

const signSession = ({ secret = SESSION_SECRET, expires = '5m', email = ADMIN.email, subject = ADMIN.id } = {}) =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('united-hatzalah-shoham-branch')
    .setAudience('admin-api')
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(secret));

const tamperSignature = (token) => {
  const [header, payload, signature] = token.split('.');
  const bytes = Buffer.from(signature, 'base64url');
  bytes[0] ^= 1;
  return `${header}.${payload}.${bytes.toString('base64url')}`;
};

test('admin API rejects missing authorization and the legacy plain-email bearer', async () => {
  const db = new FakeDb();
  const missing = await callApi('/admin/admins', { env: { DB: db, SESSION_SECRET } });
  const forgedEmail = await callApi('/admin/admins', {
    token: ADMIN.email,
    env: { DB: db, SESSION_SECRET },
  });

  assert.equal(missing.status, 403);
  assert.equal(forgedEmail.status, 403);
});

test('admin API rejects tampered, expired, mismatched, and unconfigured sessions', async () => {
  const db = new FakeDb();
  const valid = await signSession();
  const cases = [
    tamperSignature(valid),
    await signSession({ expires: '0s' }),
    await signSession({ email: 'other@example.test' }),
  ];

  for (const token of cases) {
    const response = await callApi('/admin/admins', { token, env: { DB: db, SESSION_SECRET } });
    assert.equal(response.status, 403);
  }

  const missingSecret = await callApi('/admin/admins', { token: valid, env: { DB: db } });
  assert.equal(missingSecret.status, 403);
});

test('admin API preserves access for a valid signed session belonging to an active admin', async () => {
  const db = new FakeDb();
  const token = await signSession();
  const response = await callApi('/admin/admins', { token, env: { DB: db, SESSION_SECRET } });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.data[0].id, ADMIN.id);
});

test('admin API rejects a validly signed session after the admin is deactivated', async () => {
  const db = new FakeDb();
  db.admin.isActive = 0;
  const token = await signSession();
  const response = await callApi('/admin/admins', { token, env: { DB: db, SESSION_SECRET } });

  assert.equal(response.status, 403);
});

test('donation submissions are recorded as pending requests and never claim payment', async () => {
  const db = new FakeDb();
  const response = await callApi('/donations', {
    method: 'POST',
    body: { amount: 100, donorName: 'Anonymous', donorEmail: 'donor@example.test' },
    env: { DB: db },
  });
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.data.status, 'pending');
  assert.match(result.message, /No payment was processed/);
  assert.equal(db.donations[0].status, 'pending');

  const statsResponse = await callApi('/donations/stats', { env: { DB: db } });
  const statsResult = await statsResponse.json();
  assert.deepEqual(statsResult.data, {
    totalRequests: 1,
    requestedAmount: 100,
    paymentProcessed: false,
  });
  assert.equal('totalDonations' in statsResult.data, false);
  assert.equal('totalAmount' in statsResult.data, false);
});

test('admin creation cannot mark a donation request as paid', async () => {
  const db = new FakeDb();
  const token = await signSession();
  const response = await callApi('/admin/donations', {
    method: 'POST',
    token,
    body: {
      amount: 250,
      donorName: 'Admin entry',
      donorEmail: 'admin-entry@example.test',
      status: 'completed',
    },
    env: { DB: db, SESSION_SECRET },
  });
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.data.status, 'pending');
  assert.equal(db.donations[0].status, 'pending');
});
